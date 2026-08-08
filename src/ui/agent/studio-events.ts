/**
 * The studio folder, pushed to the window as it changes.
 *
 * ONE MECHANISM, TWO QUESTIONS. "Does it reload when the agent changes something" and "does it know
 * when I change something" have the same answer, because the disk does not care who wrote. A watcher
 * on the studio folder serves both, and an event bus that only carried the agent's own writes would
 * be wrong the moment somebody dragged a file in - which is exactly how this studio is used.
 *
 * WHY NOT THE EXISTING REFRESH PATH. There isn't one. The desktop UI reloads when an app calls
 * reload() after its OWN action; nothing watches the folder, so an edit made anywhere else is
 * invisible until a manual revisit. That was true before the agent window and is the reason a file
 * changed underneath somebody could sit stale on screen indefinitely.
 *
 * COARSE ON PURPOSE. The event says "the preset deck changed", not which field of which prompt. The
 * client already knows how to re-read a deck, and a payload describing the change would be a second
 * description of studio contents drifting away from the first. Cheap to send, impossible to be
 * subtly wrong about.
 */
import { watch, type FSWatcher } from "node:fs";

/** Collapse a burst of writes into one message. An atomic save is several fs events. */
const QUIET_MS = 150;
/** A ping often enough to keep proxies and sleeping tabs from dropping the stream. */
const HEARTBEAT_MS = 25_000;

/**
 * How many of these may exist at once.
 *
 * EVERY OTHER GET HERE IS READ-AND-DONE. This one allocates a persistent kernel object per call - a
 * recursive directory watch, which on Windows is a ReadDirectoryChangesW handle and on Linux is an
 * inotify watch per subdirectory - and it answers without a session token, because the token is
 * only required on writes. So a local script, or a page in a loop, could open them without limit
 * until the process ran out of handles or the machine ran out of inotify watches, which breaks
 * every OTHER watcher on the box, not just this one.
 *
 * A handful is plenty: one window needs one. Refused rather than queued, because a client that
 * cannot watch should be told so and fall back to its own reloads.
 */
const MAX_STREAMS = 8;
let openStreams = 0;

/** For tests: how many watchers are currently live. */
export const liveStreamCount = (): number => openStreams;

/** Which deck a changed path belongs to, or null for anything outside the kind folders. */
export function kindOfPath(relative: string): string | null {
  // Windows gives back backslashes; the wire uses one spelling.
  const parts = relative.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const kind = parts[0];
  /**
   * The LAST segment is the filename, not the second. A recursive watch reports nested paths, and
   * reading `parts[1]` called `sub` the file in `preset/sub/thing.json` - so it failed the .json
   * check and the change was dropped entirely.
   */
  const file = parts[parts.length - 1];
  if (!kind || !file) return null;
  /**
   * Dotfiles are artifacts, not somebody's work: atomic replacement leaves .tmp orphans, and
   * announcing those would have the window re-reading the folder on every save twice over.
   */
  if (file.startsWith(".") || !file.toLowerCase().endsWith(".json")) return null;
  return kind;
}

/**
 * A server-sent-events stream of studio changes.
 *
 * The watcher is torn down when the request aborts. That matters more than it looks: a stream per
 * open tab times a watcher that outlives it is how a machine ends up with hundreds of handles on one
 * folder, and this app is left running all day.
 */
export function studioEvents(studioDir: string, signal?: AbortSignal): Response {
  if (openStreams >= MAX_STREAMS) {
    // 503 rather than 429: this is a capacity limit on the host, not a rate the client exceeded,
    // and the client's correct response is to keep working without a watcher.
    return new Response("too many studio watchers open", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }

  const encoder = new TextEncoder();
  let watcher: FSWatcher | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let quiet: ReturnType<typeof setTimeout> | null = null;
  /** Closed once and only once, and every path out goes through shutdown(). */
  let closed = false;

  /**
   * ONE TEARDOWN, reachable from everywhere.
   *
   * There used to be two: a shutdown() that closed everything, and a cancel() that closed most of
   * it, and a send() failure path that set a flag and closed NOTHING. That last one left a 25s
   * interval running forever against a dead stream and leaked the directory watch, in a process
   * this app expects to leave running all day. Divergent teardown is the defect whether or not the
   * unreachable-looking path is reachable.
   */
  const shutdown = (): void => {
    if (closed) return;
    closed = true;
    openStreams--;
    watcher?.close();
    watcher = null;
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
    if (quiet) { clearTimeout(quiet); quiet = null; }
  };

  openStreams++;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown): void => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // The client went away mid-write. Everything comes down, not just the flag.
          shutdown();
        }
      };

      const finish = (): void => {
        const wasOpen = !closed;
        shutdown();
        if (wasOpen) { try { controller.close(); } catch { /* the client already left */ } }
      };

      // Said immediately so the client knows the stream is live rather than merely open.
      send("ready", { watching: true });

      /** Kinds touched since the last flush, so a burst becomes one message naming all of them. */
      const pending = new Set<string>();
      const flush = (): void => {
        quiet = null;
        if (pending.size === 0) return;
        send("changed", { kinds: [...pending] });
        pending.clear();
      };

      try {
        watcher = watch(studioDir, { recursive: true }, (_event, filename) => {
          if (!filename) return;
          const kind = kindOfPath(String(filename));
          if (!kind) return;
          pending.add(kind);
          if (quiet) clearTimeout(quiet);
          quiet = setTimeout(flush, QUIET_MS);
        });
        /**
         * A watcher that dies must not take the page with it. Some filesystems (network shares,
         * some containers) refuse recursive watches; the window keeps working, it just stops being
         * told, and it is told THAT rather than left believing it is current.
         */
        watcher.on("error", () => {
          // The watcher is finished; keeping the handle registered would leave it emitting on every
          // subsequent error for a folder that has gone. Say it once, drop it, keep the stream up
          // so the client learns it is no longer being told.
          watcher?.close();
          watcher = null;
          send("degraded", { watching: false });
        });
      } catch {
        send("degraded", { watching: false });
      }

      // Only worth pinging a stream that can still deliver something. When the watch never opened,
      // the client has already been told it is degraded and a heartbeat would just assert liveness.
      if (watcher) heartbeat = setInterval(() => { send("ping", {}); }, HEARTBEAT_MS);
      signal?.addEventListener("abort", finish, { once: true });
    },
    // The one teardown, same as every other exit.
    cancel() { shutdown(); },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
      // Told not to buffer: a proxy holding the stream would make every change arrive in a clump.
      "x-accel-buffering": "no",
    },
  });
}
