/**
 * Listening to the studio folder from the browser.
 *
 * ANSWERS BOTH QUESTIONS AT ONCE. "Does it reload when the agent changes something" and "does it
 * know when I change something" are the same subscription, because the watcher on the other end
 * reports the disk rather than reporting an actor.
 *
 * WHAT IT DOES NOT DO is decide what to re-read. It hands back the kinds that changed and a version
 * number that increments; the app that cares re-reads its own deck the way it already does on mount.
 * A hook that fetched on the app's behalf would be a second loading path competing with the first.
 */
import { useEffect, useRef, useState } from "react";

export interface StudioChanges {
  /** Increments on every change burst; use it as an effect dependency to re-read. */
  readonly version: number;
  /** Which decks were touched by the most recent burst. */
  readonly kinds: readonly string[];
  /**
   * Is anything actually watching?
   *
   * False means the stream is down or the filesystem refused a recursive watch. Surfaced rather than
   * hidden: a window that quietly stopped noticing changes while still looking live is worse than
   * one that says it is not watching, because the first invites you to trust a stale screen.
   */
  readonly watching: boolean;
}

export function useStudioChanges(
  /** Injected for tests; the app passes nothing and gets the real one. */
  connect: (url: string) => EventSource = (url) => new EventSource(url),
): StudioChanges {
  const [version, setVersion] = useState(0);
  const [kinds, setKinds] = useState<readonly string[]>([]);
  const [watching, setWatching] = useState(false);
  const connectRef = useRef(connect);
  connectRef.current = connect;

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    /** Stops the reconnect loop from outliving the component that started it. */
    let live = true;
    /** Consecutive failures, for the backoff. */
    let failures = 0;
    /** Did this connection ever succeed? A stream that never opened is probably not allowed to. */
    let everReady = false;

    /**
     * Try again, slower each time, and give up rather than hammering forever.
     *
     * A FIXED THREE SECONDS FOREVER WAS WRONG IN A WAY THE HOST-ONLY RULE MADE WORSE. This route is
     * refused outright to remote and LAN devices, so on those the retry was not waiting for a
     * server to come back - it was re-requesting a permanently forbidden route every three seconds,
     * for the life of the session, each one a full round trip through the Tailscale sidecar. And a
     * stream that has never once opened is far more likely to be forbidden than to be briefly down.
     */
    const scheduleRetry = (): void => {
      if (!live || retry) return;
      failures++;
      // Never opened at all after a few tries: treat it as refused rather than flapping.
      if (!everReady && failures >= 3) return;
      if (failures > 8) return;
      const wait = Math.min(3000 * 2 ** (failures - 1), 60_000);
      retry = setTimeout(() => { retry = null; open(); }, wait);
    };

    const open = (): void => {
      if (!live) return;
      try {
        source = connectRef.current("/api/agent/events");
      } catch {
        // Construction itself threw (CSP, mixed content, a polyfill). The error listener below was
        // never attached, so without this the stream stayed dead for the life of the component.
        setWatching(false);
        scheduleRetry();
        return;
      }

      source.addEventListener("ready", () => {
        setWatching(true);
        failures = 0;
        /**
         * A RECONNECT MEANS A GAP, AND THE GAP HAD CHANGES IN IT. The stream carries no replay, so
         * anything written while it was down was missed. Bumping the version on every reconnect
         * after the first makes subscribers re-read once, which is exactly the recovery they would
         * do on mount - without it the header went back to saying "watching" over a screen showing
         * a studio that had moved on.
         */
        if (everReady) setVersion((n) => n + 1);
        everReady = true;
      });
      source.addEventListener("degraded", () => { setWatching(false); });
      source.addEventListener("changed", (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as { kinds?: unknown };
          setKinds(Array.isArray(data.kinds) ? data.kinds.filter((k): k is string => typeof k === "string") : []);
        } catch {
          // A malformed frame still means SOMETHING changed; the version bump is the useful part.
          setKinds([]);
        }
        setVersion((n) => n + 1);
      });

      source.addEventListener("error", () => {
        // The server restarts during development and the machine sleeps. "Not watching" goes up
        // immediately so the gap is visible rather than looking like a quiet studio.
        setWatching(false);
        source?.close();
        source = null;
        scheduleRetry();
      });
    };

    open();
    return () => {
      live = false;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, []);

  return { version, kinds, watching };
}

/**
 * Re-read one open piece when its file changes underneath, and NEVER over unsaved work.
 *
 * WHY IT IS NOT JUST "RELOAD ON CHANGE". The Library can re-read freely: it shows a list, and the
 * worst a reload costs is a scroll position. An editor holds a draft. Re-reading a piece somebody
 * has half-rewritten would discard their edits to show them a fresher copy, which is a trade nobody
 * would take. Kit's preset rail settled this rule first, in its own words: a stale view is an
 * annoyance, losing a rearrange is not.
 *
 * So it declines while the piece is dirty. That leaves a stale editor open in exactly one case -
 * you have unsaved edits AND something else changed the same file - and that case wants a conflict
 * at save time, which the revision check already gives, rather than a silent overwrite either way.
 *
 * FILTERED BY KIND, so editing a preset does not re-read every open lorebook. The stream says which
 * decks moved; anything finer would mean the watcher describing entity contents, which is a second
 * description of the studio drifting away from the first.
 */
export function useReopenOnStudioChange(
  piece: { readonly id: string; readonly kind: string },
  isDirty: () => boolean,
  reopen: () => void,
): void {
  const { version, kinds } = useStudioChanges();
  /** Held rather than depended on: both are rebuilt by the room on every render. */
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const reopenRef = useRef(reopen);
  reopenRef.current = reopen;

  useEffect(() => {
    // Version 0 is the initial subscription; the editor has already loaded by then.
    if (version === 0) return;
    if (kinds.length > 0 && !kinds.includes(piece.kind)) return;
    if (dirtyRef.current()) return;
    reopenRef.current();
  }, [version, kinds, piece.id, piece.kind]);
}
