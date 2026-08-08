/** @jsxImportSource @opentui/react */
/**
 * Aliveness, proven in two halves: the pure event-to-view mapping (thinking accumulates, typing
 * accumulates, say/tool land in the transcript and reset the live row), and the widgets rendered
 * for real (the status row shows who is thinking; markdown renders bold WITHOUT its ** markers).
 */
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { settleRender as tick, settleUntil, testRender } from "./test-render";
import { applyTurnEvent, settleTurn, toggleTrace, type TurnView } from "./turn-events";
import { App } from "./app";
import type { Session } from "../session";
import { discoverCommands } from "../commands/discover";
import type { SessionStore } from "../sessions/store";
import type { Session as MemorySession } from "../sessions/session-model";
import { summarize } from "../sessions/projection";
import type { StudioChange } from "../watch/watch-core";
import type { StudioWatchSource } from "../watch/watcher";

setDefaultTimeout(30000);

// React commits on a real macrotask the harness pumping does not reliably yield (see the settings
// tests); a short real-timer tick after mount lets the widget paint before we read frames.
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

  test("toggleTrace reopens and folds the latest settled long reply", () => {
    const longReply = "long answer ".repeat(140);
    let v = applyTurnEvent(view(), { type: "say", text: longReply }, 0);
    v = toggleTrace(v);
    expect(v.lines.at(-1)).toEqual({ role: "say", text: longReply, open: true });
    v = toggleTrace(v);
    expect(v.lines.at(-1)).toEqual({ role: "say", text: longReply, open: false });
  });

  test("an interrupted text stream keeps the partial answer before the error", () => {
    let v = applyTurnEvent(view(), { type: "delta", kind: "text", text: "partial answer" }, 0);
    v = applyTurnEvent(v, { type: "error", message: "stream interrupted" }, 1000);
    v = settleTurn(v, 1000);
    expect(v.lines).toEqual([
      { role: "say", text: "partial answer" },
      { role: "error", text: "stream interrupted" },
    ]);
  });
});

describe("App turn lifecycle", () => {
  const renderApp = (
    session: Session,
    options: {
      commands?: Awaited<ReturnType<typeof discoverCommands>>;
      sessionStore?: SessionStore;
      makeSessionId?: () => string;
      width?: number;
      height?: number;
      watchStudio?: StudioWatchSource;
    } = {},
  ) =>
    testRender(
      <App
        studioName="Studio"
        totalPieces={0}
        decks={[]}
        session={session}
        commands={options.commands ?? []}
        onQuit={() => {}}
        sessionStore={options.sessionStore}
        makeSessionId={options.makeSessionId}
        watchStudio={options.watchStudio}
        now={() => 1000}
      />,
      { width: options.width ?? 80, height: options.height ?? 24 },
    );

  test("two rapid submissions queue the second until the first settles", async () => {
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: string[] = [];
    const session: Session = {
      async runTurn(input, history) {
        calls.push(input);
        await gate;
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session);
    try {
      await tick();
      await t.mockInput.typeText("first");
      t.mockInput.pressEnter();
      await t.mockInput.typeText("second");
      t.mockInput.pressEnter();
      await tick();
      expect(calls).toEqual(["first"]);
      expect(t.captureCharFrame()).toContain("QUEUED");
      expect(t.captureCharFrame()).toContain("second");
      release();
      await tick(180);
      expect(calls).toEqual(["first", "second"]);
      expect(t.captureCharFrame()).not.toContain("QUEUED");
    } finally {
      release();
      await tick();
      await t.renderer.destroy();
    }
  });

  test("Escape aborts the active turn", async () => {
    let release = (): void => {};
    let aborted = false;
    const session: Session = {
      async runTurn(_input, history, _onEvent, signal?: AbortSignal) {
        await new Promise<void>((resolve) => {
          release = resolve;
          signal?.addEventListener("abort", () => {
            aborted = true;
            resolve();
          }, { once: true });
        });
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session);
    try {
      await tick();
      await t.mockInput.typeText("cancel me");
      t.mockInput.pressEnter();
      await tick();
      t.mockInput.pressKey("ESCAPE");
      await tick();
      expect(aborted).toBe(true);
    } finally {
      release();
      await tick();
      await t.renderer.destroy();
    }
  });

  test("Down Arrow on the live draft leaves it unchanged", async () => {
    const session: Session = {
      async runTurn(_input, history) {
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session);
    try {
      await tick();
      await t.mockInput.typeText("keep this draft");
      t.mockInput.pressKey("ARROW_DOWN");
      await tick();
      expect(t.captureCharFrame()).toContain("keep this draft");
    } finally {
      await t.renderer.destroy();
    }
  });

  test("Ctrl+F round-trip preserves the live draft", async () => {
    const session: Session = {
      async runTurn(_input, history) {
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session);
    try {
      await tick();
      await t.mockInput.typeText("unsent draft");
      t.mockInput.pressKey("f", { ctrl: true });
      await tick();
      expect(t.captureCharFrame()).toContain("SEARCH");
      t.mockInput.pressEscape();
      await tick();
      expect(t.captureCharFrame()).toContain("unsent draft");
    } finally {
      await t.renderer.destroy();
    }
  });

  test("a sixth paste is visibly rejected instead of silently dropped", async () => {
    const session: Session = {
      async runTurn(_input, history) {
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session);
    try {
      await tick();
      for (let i = 1; i <= 6; i += 1) {
        await t.mockInput.pasteBracketedText(`paste ${i}\na\nb\nc\nd`);
        await tick(10);
      }
      await tick();
      expect(t.captureCharFrame()).toContain("Paste not added");
    } finally {
      await t.renderer.destroy();
    }
  });

  test("clicking a paste card removes only that pending card", async () => {
    const session: Session = {
      async runTurn(_input, history) {
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session);
    try {
      await tick();
      await t.mockInput.pasteBracketedText("pending paste\na\nb\nc\nd");
      await tick();
      const rows = t.captureCharFrame().split("\n");
      const y = rows.findIndex((row) => row.includes("remove"));
      const x = rows[y]?.indexOf("remove") ?? -1;
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeGreaterThanOrEqual(0);
      await t.mockMouse.click(x, y);
      await tick();
      expect(t.captureCharFrame()).not.toContain("pasted text");
    } finally {
      await t.renderer.destroy();
    }
  });

  test("an unknown slash command stays local and never reaches the provider", async () => {
    const calls: string[] = [];
    const session: Session = {
      async runTurn(input, history) {
        calls.push(input);
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session);
    try {
      await tick();
      await t.mockInput.typeText("/quut");
      t.mockInput.pressEnter();
      await tick();
      expect(calls).toEqual([]);
      expect(t.captureCharFrame()).toContain("Unknown command");
    } finally {
      await t.renderer.destroy();
    }
  });

  test("a completed turn persists and /resume restores it after restart", async () => {
    const records = new Map<string, MemorySession>();
    const store: SessionStore = {
      async list() {
        return [...records.values()].map(summarize).sort((a, b) => b.updatedAt - a.updatedAt);
      },
      async read(id) {
        return records.get(id) ?? null;
      },
      async write(record) {
        records.set(record.id, record);
      },
      async remove(id) {
        return records.delete(id);
      },
      async writeExport(_dir, filename) {
        return filename;
      },
    };
    const session: Session = {
      async runTurn(input, history, onEvent) {
        const next = [
          ...history,
          { role: "user" as const, content: input },
          { role: "assistant" as const, content: `reply ${input}` },
        ];
        onEvent({ type: "say", text: `reply ${input}` });
        return next;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const commands = await discoverCommands();
    const ids = ["first", "second"];
    const first = await renderApp(session, {
      commands,
      sessionStore: store,
      makeSessionId: () => ids.shift() ?? "extra",
    });
    try {
      await tick();
      await first.mockInput.typeText("hello");
      first.mockInput.pressEnter();
      await settleUntil(() => (records.get("first")?.turns?.length ?? 0) > 0);
      expect(records.get("first")?.turns).toHaveLength(1);
    } finally {
      await first.renderer.destroy();
    }

    const second = await renderApp(session, {
      commands,
      sessionStore: store,
      makeSessionId: () => ids.shift() ?? "extra",
    });
    try {
      await tick();
      await second.mockInput.typeText("/resume");
      second.mockInput.pressEnter();
      await settleUntil(() => second.captureCharFrame().includes("reply hello"));
      expect(second.captureCharFrame()).toContain("reply hello");
    } finally {
      await second.renderer.destroy();
    }
  });

  test("compact terminal chrome keeps labels separate and the opening actionable", async () => {
    const session: Session = {
      async runTurn(_input, history) {
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session, { width: 30, height: 12 });
    try {
      await tick();
      const frame = t.captureCharFrame();
      expect(frame).toContain("Kit.");
      expect(frame).toContain("Ready?");
      expect(frame).toContain("Go make something you love.");
      expect(frame).toContain("/model");
      expect(frame).not.toContain("Kitstudio");
    } finally {
      await t.renderer.destroy();
    }
  });

  test("/help opens the full reference stage and escape returns to the composer", async () => {
    const session: Session = {
      async runTurn(_input, history) {
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session, { commands: await discoverCommands() });
    try {
      await tick();
      await t.mockInput.typeText("/help");
      t.mockInput.pressEnter();
      await tick();
      expect(t.captureCharFrame()).toContain("Kit.");
      expect(t.captureCharFrame()).toContain("help");
      expect(t.captureCharFrame()).toContain("MOVING AROUND");
      t.mockInput.pressEscape();
      await tick();
      expect(t.captureCharFrame()).toContain("talk to your studio");
    } finally {
      await t.renderer.destroy();
    }
  });

  test("an outside studio change lands one non-modal notice and refreshes the composer", async () => {
    const watcher: { emit?: (change: StudioChange) => void } = {};
    const watchStudio: StudioWatchSource = (onChange) => {
      watcher.emit = onChange;
      return () => {};
    };
    const session: Session = {
      async runTurn(_input, history) {
        return history;
      },
      async probe() {}, async summarise() { return null; },
      async activeProvider() {
        return null;
      },
    };
    const t = await renderApp(session, { watchStudio });
    try {
      await tick();
      const after = [{ id: "mira", kind: "character", name: "Mira" }];
      if (!watcher.emit) throw new Error("studio watcher did not mount");
      watcher.emit({ added: after, removed: [], updated: [], after });
      await settleUntil(() => t.captureCharFrame().includes("NOTICED"));
      const frame = t.captureCharFrame();
      expect(frame).toContain("NOTICED");
      expect(frame).toContain("Mira");
      expect(frame).toContain("try: what should I improve about Mira?");
    } finally {
      await t.renderer.destroy();
    }
  });

});
