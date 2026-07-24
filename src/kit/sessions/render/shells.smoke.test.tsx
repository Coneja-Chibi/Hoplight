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
