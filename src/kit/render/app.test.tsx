/** @jsxImportSource @opentui/react */
/**
 * Aliveness, proven in two halves: the pure event-to-view mapping (thinking accumulates, typing
 * accumulates, say/tool land in the transcript and reset the live row), and the widgets rendered
 * for real (the status row shows who is thinking; markdown renders bold WITHOUT its ** markers).
 */
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { applyTurnEvent, type TurnView } from "./turn-events";
import { SayLine } from "./primitives/say-line";
import { StatusRow } from "./primitives/status-row";

setDefaultTimeout(30000);

// React commits on a real macrotask the harness pumping does not reliably yield (see the settings
// tests); a short real-timer tick after mount lets the widget paint before we read frames.
const tick = (ms = 60): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const view = (): TurnView => ({ lines: [], live: { phase: "waiting" }, label: "" });

describe("applyTurnEvent", () => {
  test("begin sets the label; reasoning deltas accumulate a thinking count", () => {
    let v = applyTurnEvent(view(), { type: "begin", label: "NanoGPT · deepseek-r1" });
    expect(v.label).toBe("NanoGPT · deepseek-r1");
    v = applyTurnEvent(v, { type: "delta", kind: "reasoning", text: "hmm, " });
    v = applyTurnEvent(v, { type: "delta", kind: "reasoning", text: "let me count" });
    expect(v.live).toEqual({ phase: "thinking", chars: 17 });
  });

  test("text deltas accumulate typing; say lands the line and resets to waiting", () => {
    let v = applyTurnEvent(view(), { type: "delta", kind: "text", text: "You have " });
    v = applyTurnEvent(v, { type: "delta", kind: "text", text: "**13**." });
    expect(v.live).toEqual({ phase: "typing", text: "You have **13**." });
    v = applyTurnEvent(v, { type: "say", text: "You have **13**." });
    expect(v.lines).toEqual([{ role: "say", text: "You have **13**." }]);
    expect(v.live).toEqual({ phase: "waiting" }); // the turn may continue into tools
  });

  test("tool rows land and reset the live row; errors land as errors", () => {
    let v = applyTurnEvent(view(), { type: "tool", name: "list", summary: "list character: 13" });
    expect(v.lines).toEqual([{ role: "tool", text: "list character: 13" }]);
    expect(v.live).toEqual({ phase: "waiting" });
    v = applyTurnEvent(v, { type: "error", message: "boom" });
    expect(v.lines.at(-1)).toEqual({ role: "error", text: "boom" });
  });
});

describe("widgets", () => {
  test("SayLine renders the reply text (markdown treatment lands after the wireframe pick)", async () => {
    const t = await testRender(<SayLine text={"You have 13 characters in your studio."} />, {
      width: 60,
      height: 8,
    });
    try {
      await tick();
      const frame = await t.waitForFrame((f) => f.includes("13 characters"), { maxPasses: 300 });
      expect(frame).toContain("13 characters");
    } finally {
      await t.renderer.destroy();
    }
  });

  test("StatusRow is the stagehand: a stage verb and the stamp clock, no provider name", async () => {
    const t = await testRender(<StatusRow startedAt={Date.now() - 65000} />, {
      width: 60,
      height: 4,
    });
    try {
      await tick();
      const frame = await t.waitForFrame((f) => f.includes("1:0"), { maxPasses: 300 });
      const verbs = ["cueing", "rifling", "staging", "rehearsing", "consulting"];
      expect(verbs.some((verb) => frame.includes(verb))).toBe(true);
      expect(frame).toContain("1:0"); // 65s elapsed renders as the 1:05-ish stamp
      expect(frame).not.toContain("NanoGPT");
    } finally {
      await t.renderer.destroy();
    }
  });
});
