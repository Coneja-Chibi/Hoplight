/** @jsxImportSource @opentui/react */
/**
 * Aliveness, proven in two halves: the pure event-to-view mapping (thinking accumulates, typing
 * accumulates, say/tool land in the transcript and reset the live row), and the widgets rendered
 * for real (the status row shows who is thinking; markdown renders bold WITHOUT its ** markers).
 */
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { applyTurnEvent, settleTurn, toggleTrace, type TurnView } from "./turn-events";
import { SayLine } from "./primitives/say-line";
import { StatusRow } from "./primitives/status-row";
import { ThoughtRow } from "./primitives/thought-row";
import { BackstageRow } from "./primitives/backstage-row";

setDefaultTimeout(30000);

// React commits on a real macrotask the harness pumping does not reliably yield (see the settings
// tests); a short real-timer tick after mount lets the widget paint before we read frames.
const tick = (ms = 60): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const view = (): TurnView => ({
  lines: [],
  live: { phase: "waiting" },
  label: "",
  tools: null,
  toolsSeen: false,
});

describe("applyTurnEvent", () => {
  test("begin sets the label; reasoning deltas accumulate the live thought", () => {
    let v = applyTurnEvent(view(), { type: "begin", label: "NanoGPT · deepseek-r1" }, 1000);
    expect(v.label).toBe("NanoGPT · deepseek-r1");
    v = applyTurnEvent(v, { type: "delta", kind: "reasoning", text: "hmm, " }, 1000);
    v = applyTurnEvent(v, { type: "delta", kind: "reasoning", text: "let me count" }, 3000);
    expect(v.live).toEqual({ phase: "thinking", text: "hmm, let me count", since: 1000 });
  });

  test("a finished thought lands as a collapsed trace with its duration", () => {
    let v = applyTurnEvent(view(), { type: "delta", kind: "reasoning", text: "walk the sheets" }, 1000);
    v = applyTurnEvent(v, { type: "delta", kind: "text", text: "You have " }, 9000);
    expect(v.lines).toEqual([
      { role: "thought", text: "walk the sheets", seconds: 8, open: false },
    ]);
    expect(v.live).toEqual({ phase: "typing", text: "You have " });
  });

  test("text deltas accumulate typing; say lands the line and resets to waiting", () => {
    let v = applyTurnEvent(view(), { type: "delta", kind: "text", text: "You have " }, 0);
    v = applyTurnEvent(v, { type: "delta", kind: "text", text: "13." }, 0);
    expect(v.live).toEqual({ phase: "typing", text: "You have 13." });
    v = applyTurnEvent(v, { type: "say", text: "You have 13." }, 0);
    expect(v.lines).toEqual([{ role: "say", text: "You have 13." }]);
    expect(v.live).toEqual({ phase: "waiting" }); // the turn may continue into tools
  });

  test("a standalone tool (no cluster, e.g. /test) lands as a plain teal row", () => {
    const v = applyTurnEvent(view(), { type: "tool", name: "test", summary: "test NanoGPT · 340ms" }, 0);
    expect(v.lines).toEqual([{ role: "tool", text: "test NanoGPT · 340ms" }]);
  });

  test("loop tools gather in a live cluster, then seal into one backstage line on the reply", () => {
    // first tool-start opens the cluster and drops the stagehand
    let v = applyTurnEvent(view(), { type: "tool-start", name: "list characters" }, 1000);
    expect(v.tools?.moves).toEqual([{ name: "list characters" }]);
    expect(v.toolsSeen).toBe(true);
    expect(v.live).toEqual({ phase: "idle" });
    // the tool settles in place, a second runs, settles
    v = applyTurnEvent(v, { type: "tool", name: "list", summary: "list character: 13" }, 1600);
    expect(v.tools?.moves).toEqual([{ name: "list characters", summary: "list character: 13" }]);
    v = applyTurnEvent(v, { type: "tool-start", name: "read Basil" }, 1700);
    v = applyTurnEvent(v, { type: "tool", name: "read", summary: "read character: Basil" }, 2600);
    expect(v.tools?.moves.length).toBe(2);
    // the reply seals the whole cluster into one collapsed backstage line, then lands the say
    v = applyTurnEvent(v, { type: "say", text: "Basil haunts the Half-Moon." }, 6000);
    expect(v.tools).toBeNull();
    expect(v.lines).toEqual([
      { role: "backstage", moves: ["list character: 13", "read character: Basil"], seconds: 5, open: false },
      { role: "say", text: "Basil haunts the Half-Moon." },
    ]);
    // the stagehand stays suppressed for the rest of the turn
    expect(v.toolsSeen).toBe(true);
  });

  test("settleTurn lands a mid-flight thought; toggleTrace reopens and folds traces", () => {
    let v = applyTurnEvent(view(), { type: "delta", kind: "reasoning", text: "unfinished" }, 1000);
    v = settleTurn(v, 4000);
    expect(v.live).toEqual({ phase: "idle" });
    expect(v.lines.at(-1)).toEqual({ role: "thought", text: "unfinished", seconds: 3, open: false });
    v = toggleTrace(v); // no index: the latest trace
    expect((v.lines.at(-1) as { open: boolean }).open).toBe(true);
    v = toggleTrace(v, v.lines.length - 1);
    expect((v.lines.at(-1) as { open: boolean }).open).toBe(false);
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

  test("ThoughtRow: collapsed shows the invitation, open shows the thought", async () => {
    const t = await testRender(
      <ThoughtRow text="walk the sheets and compare" seconds={8} open={false} onToggle={() => {}} />,
      { width: 70, height: 4 },
    );
    try {
      await tick();
      const frame = await t.waitForFrame((f) => f.includes("rehearsed"), { maxPasses: 300 });
      expect(frame).toContain("rehearsed for 8s");
      expect(frame).toContain("ctrl+o");
      expect(frame).not.toContain("walk the sheets"); // folded traces keep the thought put away
    } finally {
      await t.renderer.destroy();
    }
  });

  test("BackstageRow collapsed shows the fold invitation, not the moves", async () => {
    const t = await testRender(
      <BackstageRow moves={["list character: 13", "read character: Basil"]} seconds={6} open={false} onToggle={() => {}} />,
      { width: 72, height: 4 },
    );
    try {
      await tick();
      const frame = await t.waitForFrame((f) => f.includes("backstage"), { maxPasses: 300 });
      expect(frame).toContain("backstage · 2 moves · 6s");
      expect(frame).toContain("ctrl+o");
      expect(frame).not.toContain("read character"); // folded moves stay put away
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
