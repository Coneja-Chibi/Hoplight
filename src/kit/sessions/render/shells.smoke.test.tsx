/** @jsxImportSource @opentui/react */
/**
 * Mount smoke for the two screen shells: prove they render real frames without throwing, against a
 * stubbed SessionActions (no store, no clock coupling). The navigation + derivation logic itself is
 * covered by the pure-core tests; this only guards the view wiring (nesting, tokens, async list load).
 */
import { afterEach, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import {
  runRenderUpdate,
  settleRender as tick,
  testRender,
} from "../../render/test-render";
import { useState } from "react";
import type { ModelMessage } from "../../providers/provider";
import { appendTurn, buildTurn, emptySession, renameSession, type Session } from "../session-model";
import { summarize, type SessionSummary } from "../projection";
import type { SessionActions } from "../session-actions";
import { ResumePlaybill } from "./resume-playbill";
import { RewindRail } from "./rewind-rail";

setDefaultTimeout(30000);

const msg = (content: string): ModelMessage => ({ role: "user", content });

const twoTurns = (id: string, title: string): Session => {
  let s = emptySession(id, 1000);
  s = appendTurn(s, buildTurn("first turn here", [msg("first turn here")], 2000));
  s = appendTurn(s, buildTurn("second turn here", [msg("second turn here")], 3000));
  return renameSession(s, title, 3000);
};

const manyTurns = (id: string, count: number): Session => {
  let session = emptySession(id, 1000);
  for (let turn = 1; turn <= count; turn += 1) {
    session = appendTurn(
      session,
      buildTurn(`turn ${String(turn).padStart(2, "0")}`, [msg(`turn ${turn}`)], 1000 + turn),
    );
  }
  return session;
};

const stubActions = (summaries: SessionSummary[], current: Session): SessionActions => ({
  list: async () => summaries,
  open: async () => {},
  rename: async () => {},
  remove: async () => {},
  fresh: () => {},
  current: () => current,
  rewind: async () => {},
  fork: async () => {},
  exportTranscript: async () => {},
  openPlaybill: () => {},
  openRail: () => {},
});

let destroy: (() => void | Promise<void>) | null = null;
afterEach(async () => {
  if (destroy) await destroy();
  destroy = null;
});

test("ResumePlaybill renders saved rows and the action hints", async () => {
  const summaries = [twoTurns("a", "combat math"), twoTurns("b", "regex names")].map(summarize);
  const t = await testRender(
    <ResumePlaybill actions={stubActions(summaries, twoTurns("a", "combat math"))} busy={false} onClose={() => {}} />,
    { width: 90, height: 20 },
  );
  destroy = () => t.renderer.destroy();
  const frame = await t.waitForFrame((f) => f.includes("combat math"), { maxPasses: 300 });
  expect(frame).toContain("regex names");
  expect(frame).toContain("resume");
  expect(frame).toContain("2 saved");
});

test("ResumePlaybill shows the empty state when nothing is saved", async () => {
  const t = await testRender(
    <ResumePlaybill actions={stubActions([], emptySession("x", 1000))} busy={false} onClose={() => {}} />,
    { width: 90, height: 20 },
  );
  destroy = () => t.renderer.destroy();
  const frame = await t.waitForFrame((f) => f.includes("no saved sessions yet"), { maxPasses: 300 });
  expect(frame).toContain("new one");
});

test("ResumePlaybill ignores a pending list after it unmounts", async () => {
  let resolveList: ((summaries: SessionSummary[]) => void) | undefined;
  const pendingList = new Promise<SessionSummary[]>((resolve) => {
    resolveList = resolve;
  });
  const actions = {
    ...stubActions([], emptySession("x", 1000)),
    list: () => pendingList,
  };
  const error = spyOn(console, "error").mockImplementation(() => {});
  const t = await testRender(
    <ResumePlaybill actions={actions} busy={false} onClose={() => {}} />,
    { width: 90, height: 20 },
  );

  await t.renderer.destroy();
  error.mockClear();
  resolveList?.([summarize(twoTurns("late", "too late"))]);
  await pendingList;
  await tick();

  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

test("RewindRail renders the current session's turns and the branch action", async () => {
  const t = await testRender(
    <RewindRail actions={stubActions([], twoTurns("a", "combat math"))} busy={false} onClose={() => {}} />,
    { width: 90, height: 16 },
  );
  destroy = () => t.renderer.destroy();
  const frame = await t.waitForFrame((f) => f.includes("Rewind"), { maxPasses: 300 });
  expect(frame).toContain("first turn here");
  expect(frame).toContain("branch");
});

test("ResumePlaybill keeps a long-list selection visible and opens that row", async () => {
  const summaries = Array.from({ length: 20 }, (_, index) =>
    summarize(twoTurns(`s${index}`, `session ${String(index).padStart(2, "0")}`)));
  const opened: string[] = [];
  const actions = {
    ...stubActions(summaries, twoTurns("s0", "session 00")),
    open: async (id: string) => {
      opened.push(id);
    },
  };
  const t = await testRender(
    <ResumePlaybill actions={actions} busy={false} onClose={() => {}} />,
    { width: 50, height: 10 },
  );
  destroy = () => t.renderer.destroy();
  await t.waitForFrame((frame) => frame.includes("20 saved"), { maxPasses: 300 });
  for (let i = 0; i < 15; i += 1) t.mockInput.pressKey("ARROW_DOWN");
  await tick();
  expect(t.captureCharFrame()).toContain("session 15");
  t.mockInput.pressEnter();
  await tick();
  expect(opened).toEqual(["s15"]);
});

test("ResumePlaybill loads once but mutations and refreshes use the latest actions", async () => {
  const summaries = [summarize(twoTurns("a", "combat math"))];
  const firstCalls = { list: 0, rename: 0, remove: 0 };
  const secondCalls = { list: 0, rename: 0, remove: 0 };
  const first = {
    ...stubActions(summaries, twoTurns("a", "combat math")),
    list: async () => {
      firstCalls.list += 1;
      return summaries;
    },
    rename: async () => {
      firstCalls.rename += 1;
    },
    remove: async () => {
      firstCalls.remove += 1;
    },
  };
  const second = {
    ...stubActions(summaries, twoTurns("a", "combat math")),
    list: async () => {
      secondCalls.list += 1;
      return summaries;
    },
    rename: async () => {
      secondCalls.rename += 1;
    },
    remove: async () => {
      secondCalls.remove += 1;
    },
  };
  let useSecond = (): void => {
    throw new Error("harness not mounted");
  };
  const Harness = () => {
    const [actions, setActions] = useState<SessionActions>(first);
    useSecond = () => setActions(second);
    return <ResumePlaybill actions={actions} busy={false} onClose={() => {}} />;
  };

  const t = await testRender(<Harness />, { width: 90, height: 20 });
  destroy = () => t.renderer.destroy();
  await t.waitForFrame((frame) => frame.includes("combat math"), { maxPasses: 300 });
  expect(firstCalls.list).toBe(1);

  runRenderUpdate(() => useSecond());
  await t.flush();
  expect(firstCalls.list).toBe(1);
  expect(secondCalls.list).toBe(0);

  t.mockInput.pressKey("r");
  t.mockInput.pressEnter();
  await t.waitFor(() => secondCalls.list === 1);
  expect(firstCalls.rename).toBe(0);
  expect(secondCalls.rename).toBe(1);

  t.mockInput.pressKey("d");
  t.mockInput.pressEnter();
  await t.waitFor(() => secondCalls.list === 2);
  expect(firstCalls.remove).toBe(0);
  expect(secondCalls.remove).toBe(1);
});

test("RewindRail burst navigation forks the row selected by the key burst", async () => {
  const current = manyTurns("long", 20);
  const forked: number[] = [];
  const actions = {
    ...stubActions([], current),
    fork: async (turn: number) => {
      forked.push(turn);
    },
  };
  const t = await testRender(
    <RewindRail actions={actions} busy={false} onClose={() => {}} />,
    { width: 50, height: 10 },
  );
  destroy = () => t.renderer.destroy();
  await t.waitForFrame((frame) => frame.includes("20 turns"), { maxPasses: 300 });
  t.mockInput.pressKey("ARROW_UP");
  t.mockInput.pressKey("f");
  await tick();
  expect(forked).toEqual([18]);
  expect(t.captureCharFrame()).toContain("turn 18");
});
