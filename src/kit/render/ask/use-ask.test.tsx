/** @jsxImportSource @opentui/react */
/**
 * Answering a question, driven by the keys a person actually presses.
 *
 * The two properties worth pinning are opposites: a click must NOT send, and enter must. That pair
 * is the whole design - the two visible steps are what make sending straight to the model safe,
 * and it replaces a rule that filled the composer and explained itself in a grey footer afterwards.
 */
import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { settleRender, testRender } from "../test-render";
import { useAsk } from "./use-ask";
import type { AskOption } from "./ask-core";

const OPTIONS: AskOption[] = [
  { value: "Story Director", note: "The invisible hand." },
  { value: "Compendium", note: "Accumulated memory." },
];

/** Mounts the hook, points it at a question, and exposes it for driving. */
function harness(sent: string[]) {
  let api: ReturnType<typeof useAsk> | null = null;
  function Harness(): ReactNode {
    const ask = useAsk((message) => { sent.push(message); });
    if (!ask.live) ask.follow(OPTIONS);
    api = ask;
    return <text>{`cursor=${ask.state.cursor} note=${ask.state.note || "-"} own=${ask.state.own || "-"}`}</text>;
  }
  return { Harness, get: () => api! };
}

describe("useAsk", () => {
  test("a click selects and sends nothing", async () => {
    // The half of the design that makes the other half safe.
    const sent: string[] = [];
    const h = harness(sent);
    const { renderer, captureCharFrame } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      h.get().select(1, "option");
      await settleRender();
      expect(captureCharFrame()).toContain("cursor=1");
      expect(sent).toEqual([]);
    } finally { await renderer.destroy(); }
  });

  test("enter sends the selected answer", async () => {
    const sent: string[] = [];
    const h = harness(sent);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      h.get().select(1, "option");
      await settleRender();
      h.get().handleKey("return");
      await settleRender();
      expect(sent).toEqual(["Compendium"]);
    } finally { await renderer.destroy(); }
  });

  test("a number selects, and only then does enter send it", async () => {
    const sent: string[] = [];
    const h = harness(sent);
    const { renderer, captureCharFrame } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      expect(h.get().handleKey("1", "1")).toBe(true);
      await settleRender();
      expect(captureCharFrame()).toContain("cursor=0");
      expect(sent).toEqual([]);
      h.get().handleKey("return");
      await settleRender();
      expect(sent).toEqual(["Story Director"]);
    } finally { await renderer.destroy(); }
  });

  test("a note is typed into the field and rides along with the answer", async () => {
    const sent: string[] = [];
    const h = harness(sent);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      h.get().editNote();
      await settleRender();
      for (const ch of "art only") h.get().handleKey(ch, ch === " " ? " " : ch);
      await settleRender();
      h.get().handleKey("return");
      await settleRender();
      expect(sent).toEqual(["Story Director\n\nNote: art only"]);
    } finally { await renderer.destroy(); }
  });

  test("a digit typed INTO the note stays a digit", async () => {
    // Otherwise "3 blocks" written as a caveat would jump the cursor to option three.
    const sent: string[] = [];
    const h = harness(sent);
    const { renderer, captureCharFrame } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      h.get().editNote();
      await settleRender();
      h.get().handleKey("2", "2");
      await settleRender();
      expect(captureCharFrame()).toContain("note=2");
      expect(captureCharFrame()).toContain("cursor=0");
    } finally { await renderer.destroy(); }
  });

  test("write-your-own sends nothing until something is written", async () => {
    // NULL IS A REAL STATE. An empty send would put a blank message in the conversation.
    const sent: string[] = [];
    const h = harness(sent);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      h.get().select(2, "own");
      await settleRender();
      h.get().handleKey("return");
      await settleRender();
      expect(sent).toEqual([]);

      for (const ch of "a fifth thing") h.get().handleKey(ch, ch);
      await settleRender();
      h.get().handleKey("return");
      await settleRender();
      expect(sent).toEqual(["a fifth thing"]);
    } finally { await renderer.destroy(); }
  });

  test("n opens the note, and escape hands the keys straight back", async () => {
    /**
     * The cost is accepted and bounded: a message beginning with n loses that letter while a
     * question is up. Escape is the one keystroke that undoes it, so it has to work.
     */
    const sent: string[] = [];
    const h = harness(sent);
    const { renderer, captureCharFrame } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      expect(h.get().handleKey("n", "n")).toBe(true);
      await settleRender();
      h.get().handleKey("x", "x");
      await settleRender();
      expect(captureCharFrame()).toContain("note=x");

      expect(h.get().handleKey("escape")).toBe(true);
      await settleRender();
      // Out of the field: an ordinary letter belongs to the message again.
      expect(h.get().handleKey("h", "h")).toBe(false);
    } finally { await renderer.destroy(); }
  });

  test("an ordinary letter is left alone when no field is open", async () => {
    // The panel takes only what it genuinely owns; eating letters is how the rail once felt broken.
    const sent: string[] = [];
    const h = harness(sent);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 6 });
    try {
      await settleRender();
      expect(h.get().handleKey("h", "h")).toBe(false);
      expect(h.get().handleKey("z", "z")).toBe(false);
    } finally { await renderer.destroy(); }
  });
});
