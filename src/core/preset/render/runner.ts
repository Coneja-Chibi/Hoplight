/**
 * The imperative half of rendering: spawn a declared renderer, hand it a request on stdin, read one JSON
 * reply from stdout. contract.ts owns the shapes and the parsing; this owns the process.
 *
 * The split mirrors sidecar-status.ts and sidecar-manager.ts, for the same reason: everything worth
 * testing exhaustively lives on the pure side, and this file stays thin enough to read in one sitting.
 *
 * A RENDERER IS SOMEONE ELSE'S APPLICATION. It is another platform's macro engine, loaded with whatever
 * dependencies and globals that platform needs. Three consequences are designed for rather than hoped
 * against: it can hang, it can print megabytes, and it can die. All three are bounded here, and all three
 * come back as values, because a caller asking "is this conversion clean" must never receive a stack
 * trace in place of an answer.
 */
import { refuse, parseRenderReply, type RenderOutcome, type RenderRequest } from "./contract";

/** How a renderer is invoked. Declared by the user, never guessed. */
export interface RendererCommand {
  /** the executable, e.g. "node" or "bun" */
  readonly command: string;
  /** its arguments, e.g. ["tools/renderers/sillytavern/render.mjs"] */
  readonly args: readonly string[];
  /** working directory; the renderer's own tree, since it will resolve its engine relative to itself */
  readonly cwd?: string;
}

export interface RunOptions {
  /**
   * Wall-clock budget. A macro engine assembling a large preset is fast; a hung one is indistinguishable
   * from a slow one without a bound, and this runs inside an interactive tool.
   */
  readonly timeoutMs?: number;
  /** Cap on stdout, so a renderer stuck in a print loop cannot exhaust memory. */
  readonly maxBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

/** Read a stream to a string, refusing past the cap rather than after it. */
async function readCapped(
  stream: ReadableStream<Uint8Array> | null,
  cap: number,
): Promise<{ text: string; overflowed: boolean }> {
  if (!stream) return { text: "", overflowed: false };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) return { text: "", overflowed: true };
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return { text: new TextDecoder().decode(out), overflowed: false };
}

/**
 * Run one render. Every failure path returns a refusal.
 *
 * The request goes over STDIN rather than argv. A preset path is user data and argv is world-readable in
 * the process table, but the deciding reason is simpler: state is an open-ended map, and a command line
 * is the wrong place for one.
 */
export async function runRenderer(
  renderer: RendererCommand,
  request: RenderRequest,
  options: RunOptions = {},
): Promise<RenderOutcome> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let child: ReturnType<typeof Bun.spawn>;
  try {
    child = Bun.spawn([renderer.command, ...renderer.args], {
      cwd: renderer.cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      // A renderer is a background helper; on Windows it must not flash a console at an interactive user.
      windowsHide: true,
    });
  } catch (err) {
    return refuse(
      "spawn-failed",
      `could not start the renderer "${renderer.command}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  try {
    const stdin = child.stdin;
    if (stdin && typeof stdin !== "number") {
      stdin.write(JSON.stringify(request));
      await stdin.end();
    }
  } catch {
    // A renderer that exits before reading stdin closes the pipe under us. That is not the failure worth
    // reporting; whatever it printed or the exit code it chose is, so fall through and read those.
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeoutMs);

  let out: { text: string; overflowed: boolean };
  let errText = "";
  let code: number;
  try {
    const [o, e] = await Promise.all([
      readCapped(child.stdout as ReadableStream<Uint8Array>, maxBytes),
      readCapped(child.stderr as ReadableStream<Uint8Array>, 64 * 1024),
    ]);
    out = o;
    errText = e.text;
    code = await child.exited;
  } finally {
    clearTimeout(timer);
  }

  if (timedOut) {
    return refuse("timeout", `the renderer did not answer within ${Math.round(timeoutMs / 1000)}s`);
  }
  if (out.overflowed) {
    return refuse("too-large", "the renderer produced more output than expected and was stopped");
  }
  if (code !== 0) {
    // stderr is where an engine explains itself, so it is the detail rather than the exit code alone.
    const why = errText.trim().split("\n").slice(-3).join(" ").slice(0, 200);
    return refuse("engine-error", `the renderer exited ${code}${why ? `: ${why}` : ""}`);
  }
  return parseRenderReply(out.text);
}
