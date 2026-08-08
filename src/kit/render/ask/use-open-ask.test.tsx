/** @jsxImportSource @opentui/react */
/**
 * The shell's side of a question: finding the open one, answering it, and closing it.
 *
 * Worth testing at this seam rather than only under it, because the wiring is where this broke while
 * being built: the sender was reached through a ref that nothing ever assigned, so every part passed
 * its own test and answering did nothing at all.
 */
import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { settleRender, testRender } from "../test-render";
import { useOpenAsk } from "./use-open-ask";
import type { RenderLine, TurnView } from "../turn-events";

const question = (q: string, answered?: string): RenderLine =>
  ({
    role: "choices",
    question: q,
    options: [{ value: "Story Director", note: "The invisible hand." }, { value: "Trackers" }],
    ...(answered ? { answered } : {}),
  });

/** Mounts the hook over a transcript the test can watch change. */
function harness(initial: RenderLine[], sent: string[]) {
  let api: ReturnType<typeof useOpenAsk> | null = null;
  let view: TurnView = { lines: initial, live: { phase: "idle" }, label: "", tools: null, toolsSeen: false };
  function Harness(): ReactNode {
    const result = useOpenAsk(view.lines, (update) => { view = update(view); }, (m) => { sent.push(m); });
    api = result;
    return <text>{`open=${result.open ? result.open.question : "-"}`}</text>;
  }
  return { Harness, get: () => api!, lines: () => view.lines };
}

describe("useOpenAsk", () => {
  test("it finds the question waiting on an answer", async () => {
    const h = harness([question("which one?")], []);
    const { renderer, captureCharFrame } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      expect(captureCharFrame()).toContain("open=which one?");
    } finally { await renderer.destroy(); }
  });

  test("answering sends it and marks the line answered", async () => {
    /**
     * BOTH HALVES, because they are what the wiring gets wrong. The send is what the model needs;
     * marking the line is what stops the options staying live in the scrollback and inviting a
     * second answer to a question that has moved on.
     */
    const sent: string[] = [];
    const h = harness([question("which one?")], sent);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      h.get().ask.select(1, "option");
      await settleRender();
      h.get().ask.handleKey("return");
      await settleRender();
      expect(sent).toEqual(["Trackers"]);
      expect(h.lines()[0]).toMatchObject({ role: "choices", answered: "Trackers" });
    } finally { await renderer.destroy(); }
  });

  test("a note goes out in the same message", async () => {
    const sent: string[] = [];
    const h = harness([question("which one?")], sent);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      h.get().ask.editNote();
      await settleRender();
      for (const ch of "art only") h.get().ask.handleKey(ch, ch);
      await settleRender();
      h.get().ask.handleKey("return");
      await settleRender();
      expect(sent).toEqual(["Story Director\n\nNote: art only"]);
    } finally { await renderer.destroy(); }
  });

  test("an already-answered question is not open", async () => {
    const h = harness([question("which one?", "Trackers")], []);
    const { renderer, captureCharFrame } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      expect(captureCharFrame()).toContain("open=-");
      // And it takes no keys, so a stray enter cannot re-answer it.
      expect(h.get().ask.handleKey("return")).toBe(false);
    } finally { await renderer.destroy(); }
  });

  test("with no question at all the keys are left alone", async () => {
    // Otherwise every arrow in an ordinary conversation would be swallowed by a panel that is not there.
    const h = harness([{ role: "say", text: "hello" }], []);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      expect(h.get().ask.handleKey("return")).toBe(false);
      expect(h.get().ask.handleKey("1", "1")).toBe(false);
    } finally { await renderer.destroy(); }
  });
});
