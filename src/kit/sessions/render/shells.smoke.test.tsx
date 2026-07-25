/** @jsxImportSource @opentui/react */
/**
 * Mount smoke for the two screen shells: prove they render real frames without throwing, against a
 * stubbed SessionActions (no store, no clock coupling). The navigation + derivation logic itself is
 * covered by the pure-core tests; this only guards the view wiring (nesting, tokens, async list load).
 */
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
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

const tick = (ms = 60): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
