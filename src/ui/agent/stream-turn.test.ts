/**
 * Reading a turn's stream, including all the ways one ends badly.
 *
 * The parsing is the boring half. The half worth testing is what happens when a frame arrives in
 * two pieces, when one frame is corrupt, and when somebody presses stop - because those decide
 * whether the window recovers or sits on "thinking" forever.
 */
import { describe, expect, test } from "bun:test";
import { readTurnStream } from "./stream-turn";

/** A Response over the given chunks, delivered one read at a time. */
function streamOf(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i >= chunks.length) { controller.close(); return; }
        controller.enqueue(encoder.encode(chunks[i++] ?? ""));
      },
    }),
  );
}

const frame = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe("readTurnStream", () => {
  test("deltas arrive in order and build the answer", async () => {
    const got: string[] = [];
    await readTurnStream(
      streamOf([frame("delta", { kind: "text", text: "Hel" }), frame("delta", { kind: "text", text: "lo" })]),
      { onDelta: (_k, t) => got.push(t) },
    );
    expect(got.join("")).toBe("Hello");
  });

  test("A FRAME SPLIT ACROSS TWO CHUNKS IS NOT TORN IN HALF", async () => {
    /**
     * Network reads land wherever they land, not on frame boundaries. Parsing each chunk on its own
     * would drop the tail of every message that happened to straddle one - and the longer the
     * answer, the likelier that is.
     */
    const whole = frame("say", { text: "a complete sentence" });
    const cut = Math.floor(whole.length / 2);
    const got: string[] = [];

    await readTurnStream(streamOf([whole.slice(0, cut), whole.slice(cut)]), {
      onSay: (t) => got.push(t),
    });

    expect(got).toEqual(["a complete sentence"]);
  });

  test("a last frame with no trailing blank line still counts", async () => {
    // A clean end often leaves the final frame without its separator.
    const got: string[] = [];
    await readTurnStream(streamOf([`event: say\ndata: ${JSON.stringify({ text: "last" })}`]), {
      onSay: (t) => got.push(t),
    });
    expect(got).toEqual(["last"]);
  });

  test("ONE CORRUPT FRAME DOES NOT END THE TURN", async () => {
    // Dropping the bad frame costs one message. Throwing would cost the rest of the answer.
    const got: string[] = [];
    await readTurnStream(
      streamOf([frame("say", { text: "before" }), "event: say\ndata: {not json\n\n", frame("say", { text: "after" })]),
      { onSay: (t) => got.push(t) },
    );
    expect(got).toEqual(["before", "after"]);
  });

  test("THE GATE FRAME REACHES THE WINDOW WHOLE", async () => {
    /**
     * This is the frame the dispatch loop is parked on. Everything in it - the warnings especially -
     * is what somebody is being asked to decide about, so nothing may be summarised away in transit.
     */
    let seen: Record<string, unknown> | null = null;
    await readTurnStream(
      streamOf([frame("gate", {
        id: "t1:1:0",
        name: "change_apply",
        verdict: { level: "write" },
        review: { warnings: ["this replaces 3 blocks"] },
      })]),
      { onGate: (r) => { seen = r as Record<string, unknown>; } },
    );

    expect(seen).not.toBeNull();
    expect((seen as unknown as { id: string }).id).toBe("t1:1:0");
    expect((seen as unknown as { review: { warnings: string[] } }).review.warnings)
      .toEqual(["this replaces 3 blocks"]);
  });

  test("A CANCEL IS NOT AN ERROR", async () => {
    /**
     * Stopping is something somebody chose. Reporting it in the red box used for a failed key or a
     * dead host would put an alarm on screen for the button working exactly as labelled.
     */
    const controller = new AbortController();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull() { throw Object.assign(new Error("aborted"), { name: "AbortError" }); },
      }),
    );
    controller.abort();

    let failed = "";
    let stopped = "";
    await readTurnStream(response, {
      onFailed: (e) => { failed = e; },
      onStopped: (r) => { stopped = r; },
    });

    expect(failed).toBe("");
    expect(stopped).toBe("Stopped.");
  });

  test("a response with no body says so instead of hanging", async () => {
    let failed = "";
    await readTurnStream(new Response(null, { status: 204 }), { onFailed: (e) => { failed = e; } });
    expect(failed).toContain("no stream");
  });

  test("an unknown event is ignored rather than throwing", async () => {
    // The server may learn new frames before this file does. Old windows should keep working.
    let failed = "";
    await readTurnStream(streamOf([frame("something-new", { x: 1 }), frame("say", { text: "ok" })]), {
      onFailed: (e) => { failed = e; },
    });
    expect(failed).toBe("");
  });

  test("A TOOL'S QUESTION REACHES THE WINDOW, instead of being dropped here", async () => {
    /**
     * `ask_choice` puts its list on the tool frame and the server has always sent it. This parser
     * read only the name and the summary, so the question arrived as the sentence "ask_choice: 2
     * options" and the options themselves were thrown away one line before the shell could draw
     * them - a whole tool that could not do the thing it exists to do.
     */
    let seen: unknown = null;
    await readTurnStream(
      streamOf([frame("tool", {
        name: "ask_choice",
        summary: "ask_choice: 2 options",
        choices: { question: "Which?", options: [{ value: "a" }, { value: "b" }] },
      })]),
      { onTool: (_n, _s, choices) => { seen = choices; } },
    );
    expect(seen).toEqual({ question: "Which?", options: [{ value: "a" }, { value: "b" }] });
  });

  test("an ordinary tool frame carries no question, and that is not an error", async () => {
    let called = false;
    let seen: unknown = "unset";
    await readTurnStream(
      streamOf([frame("tool", { name: "studio_read", summary: "2 pieces" })]),
      { onTool: (_n, _s, choices) => { called = true; seen = choices; } },
    );
    expect(called).toBe(true);
    expect(seen).toBeUndefined();
  });
});
