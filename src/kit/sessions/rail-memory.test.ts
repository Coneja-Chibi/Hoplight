/**
 * A session remembers which preset it was working on.
 *
 * It did not, and that was not a restore failure: the rail was never written down at all. Resume
 * brought back the conversation and left the rail shut, so coming back to a piece you had open meant
 * finding it again by name every time.
 *
 * The part that needs pinning hardest is the OLD FILES. Every session written before this has no
 * such field, and a strict whole-session parser that denied them would eat somebody's history.
 */
import { describe, expect, test } from "bun:test";
import { appendTurn, buildTurn, emptySession, forkFrom, withRail } from "./session-model";
import { parseSession } from "./store";

const session = () => appendTurn(emptySession("s1", 1000), buildTurn("hello", [], 1000));

describe("withRail", () => {
  test("records the preset the rail is on", () => {
    expect(withRail(session(), "paramnesia").rail).toBe("paramnesia");
  });

  test("null is a real answer, not a missing one", () => {
    // Somebody who shut the rail should not have it reopen on them next time.
    expect(withRail(withRail(session(), "paramnesia"), null).rail).toBeNull();
  });

  test("setting the same preset changes nothing", () => {
    // Same object back, so a per-turn stamp does not churn the record it is written into.
    const s = withRail(session(), "paramnesia");
    expect(withRail(s, "paramnesia")).toBe(s);
  });

  test("a fork inherits what was on screen", () => {
    // Branching from a conversation about a preset should land on that preset.
    const s = withRail(session(), "paramnesia");
    expect(forkFrom(s, 1, "s2", 2000).rail).toBe("paramnesia");
  });
});

describe("parseSession", () => {
  const stored = (over: Record<string, unknown> = {}) => ({
    version: 1, id: "s1", title: null, createdAt: 1, updatedAt: 2, parent: null, turns: [], ...over,
  });

  test("a session written before the rail was remembered still loads", () => {
    // THE ONE THAT MATTERS. A denial here would be somebody's whole history refusing to open.
    const parsed = parseSession(stored());
    expect(parsed).not.toBeNull();
    expect(parsed!.rail).toBeNull();
  });

  test("a stored rail comes back", () => {
    expect(parseSession(stored({ rail: "paramnesia" }))!.rail).toBe("paramnesia");
  });

  test("a rail of the wrong shape is dropped, not trusted", () => {
    // It reaches a storage lookup, so a number or an object must not travel any further than here.
    for (const junk of [42, {}, [], true, ""]) {
      expect(parseSession(stored({ rail: junk }))!.rail).toBeNull();
    }
  });

  test("a round trip through JSON keeps it", () => {
    const s = withRail(session(), "paramnesia");
    expect(parseSession(JSON.parse(JSON.stringify(s)))!.rail).toBe("paramnesia");
  });
});
