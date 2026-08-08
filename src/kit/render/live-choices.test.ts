/**
 * Which question is still waiting on you.
 *
 * The rule worth pinning is that only ONE question is ever live, and that it is closed by being
 * answered rather than by anything else happening in the transcript.
 */
import { describe, expect, test } from "bun:test";
import { liveAsk } from "./live-choices";
import type { RenderLine } from "./turn-events";

const ask = (question: string, answered?: string): RenderLine =>
  ({ role: "choices", question, options: [{ value: "a" }, { value: "b" }], ...(answered ? { answered } : {}) });
const you = (text: string): RenderLine => ({ role: "you", text });
const say = (text: string): RenderLine => ({ role: "say", text });

describe("liveAsk", () => {
  test("nothing asked means nothing live", () => {
    expect(liveAsk([say("hello")])).toBeNull();
  });

  test("an unanswered question is live", () => {
    const lines = [say("thinking"), ask("which one?")];
    expect(liveAsk(lines)?.question).toBe("which one?");
    expect(liveAsk(lines)?.index).toBe(1);
  });

  test("the newest question wins", () => {
    // A number key must not reach back into a question somebody has scrolled past.
    const lines = [ask("first?", "a"), say("ok"), ask("second?")];
    expect(liveAsk(lines)?.question).toBe("second?");
  });

  test("an answered question is not live", () => {
    expect(liveAsk([ask("which one?", "a")])).toBeNull();
  });

  test("saying something else does not close an open question", () => {
    /**
     * The old rule treated any user line as an answer, which would now strand a round set the moment
     * somebody typed anything at all. A question is closed by being ANSWERED.
     */
    const lines = [ask("which one?"), you("hang on, unrelated thought")];
    expect(liveAsk(lines)?.question).toBe("which one?");
  });

  test("an answered newest question closes even with an open older one", () => {
    // Only the newest is ever consulted, so an older unanswered one stays closed rather than
    // springing back to life after the conversation has moved on.
    const lines = [ask("older?"), say("..."), ask("newer?", "b")];
    expect(liveAsk(lines)).toBeNull();
  });
});
