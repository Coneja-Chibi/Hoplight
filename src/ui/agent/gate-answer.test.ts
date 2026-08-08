/**
 * Reading the one request in this app that authorises a write.
 *
 * Everything else the window sends is a question. This is the "yes", so a malformed body must be
 * refused rather than coerced - the nearest valid shape to a broken answer is almost always the
 * permissive one, which is precisely the wrong way to guess.
 */
import { describe, expect, test } from "bun:test";
import { parseGateAnswer } from "./gate-answer";

const ok = (body: unknown) => {
  const got = parseGateAnswer(body);
  if (!got.ok) throw new Error(`expected ok, got: ${got.why}`);
  return got.value;
};

describe("parseGateAnswer", () => {
  test("the plain answers come through as themselves", () => {
    for (const type of ["allow-once", "allow-session", "deny", "abort", "hold"] as const) {
      expect(ok({ id: "t:1:0", type }).choice).toEqual({ type });
    }
  });

  test("HOLD IS ITS OWN ANSWER, not a synonym for deny", () => {
    // "I want to know more first" and "I decided against this" are different things to say back to
    // a model, and collapsing them would lose the only one that invites a follow-up.
    expect(ok({ id: "t:1:0", type: "hold" }).choice).toEqual({ type: "hold" });
  });

  test("an edited yes carries the correction", () => {
    // "Yes, but with this text instead." The draft is amended before the answer resolves, so what
    // was authorised and what gets written are the same thing.
    const value = ok({ id: "t:1:0", type: "allow-once", edit: { blockId: "b1", content: "mine" } });
    expect(value.choice).toEqual({ type: "allow-once", edit: { blockId: "b1", content: "mine" } });
  });

  test("A MALFORMED EDIT IS REFUSED, NEVER DEGRADED INTO A PLAIN YES", () => {
    /**
     * The sharpest failure in this file. If a broken edit fell back to `{type:"allow-once"}`, the
     * model's version would be applied while the person believed they had corrected it - a write
     * they authorised, but not the write they authorised.
     */
    for (const edit of [{ blockId: "b1" }, { content: "x" }, { blockId: "", content: "x" }, "nope", 3]) {
      expect(parseGateAnswer({ id: "t:1:0", type: "allow-once", edit }).ok).toBe(false);
    }
  });

  test("LOCKED CANNOT BE SET FROM A BROWSER", () => {
    /**
     * A mode that blocks everything, set by a mis-click, with no terminal open to undo it, is a way
     * to brick your own studio. Kit's own store refuses to persist it for the same reason.
     */
    const got = parseGateAnswer({ id: "t:1:0", type: "set-mode", mode: "locked" });
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.why).toContain("guarded");
  });

  test("the modes a person may actually choose are accepted", () => {
    for (const mode of ["guarded", "autopilot", "full"] as const) {
      expect(ok({ id: "t:1:0", type: "set-mode", mode }).choice).toEqual({ type: "set-mode", mode });
    }
  });

  test("AN UNKNOWN ANSWER IS NOT 'PROBABLY YES'", () => {
    // Closed by construction. A future answer type reaching an old server must not be guessed at.
    expect(parseGateAnswer({ id: "t:1:0", type: "allow-everything-forever" }).ok).toBe(false);
    expect(parseGateAnswer({ id: "t:1:0", type: "ALLOW-ONCE" }).ok).toBe(false);
  });

  test("rubbish is refused rather than coerced", () => {
    for (const body of [null, "yes", [], {}, { id: "x" }, { type: "deny" }, { id: 3, type: "deny" }]) {
      expect(parseGateAnswer(body).ok).toBe(false);
    }
  });

  test("bounded, because neither field is ever legitimately huge", () => {
    // The id is generated server-side and short; a megabyte of it is not a typo.
    expect(parseGateAnswer({ id: "x".repeat(500), type: "deny" }).ok).toBe(false);
    expect(parseGateAnswer({
      id: "t:1:0", type: "allow-once", edit: { blockId: "b", content: "x".repeat(300_000) },
    }).ok).toBe(false);
  });
});
