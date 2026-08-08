/**
 * The history of what Kit did to itself.
 *
 * The property that matters most is survivability: this file is appended one line at a time, so a
 * crash mid-write is ordinary, and a truncated tail must cost one line rather than the whole record.
 */
import { describe, expect, test } from "bun:test";
import { alreadyDeclined, journalLine, parseEvent, readJournal, rollbackTarget } from "./harness-journal";
import type { HarnessEvent } from "./harness-core";

const event = (over: Partial<HarnessEvent> = {}): HarnessEvent => ({
  id: "ev1",
  at: "2026-08-06T10:00:00.000Z",
  trigger: "you corrected the same thing twice",
  changes: ["added memory \"Chi skims long replies\""],
  evidence: "Said so directly, twice, in this session.",
  outcome: "applied",
  ...over,
});

describe("parseEvent", () => {
  test("a full event round-trips", () => {
    const e = event({ rollbackOf: "ev0" });
    expect(parseEvent(JSON.parse(journalLine(e)))).toEqual(e);
  });

  test("anything without an id, a time, or a known outcome is not an event", () => {
    expect(parseEvent({ ...event(), id: "" })).toBeNull();
    expect(parseEvent({ ...event(), at: 7 })).toBeNull();
    expect(parseEvent({ ...event(), outcome: "maybe" })).toBeNull();
    expect(parseEvent("nope")).toBeNull();
    expect(parseEvent(null)).toBeNull();
  });

  test("soft fields degrade instead of denying the line", () => {
    // The trigger and the changes are for a person reading later; losing them is not worth losing
    // the record that something happened at all.
    const parsed = parseEvent({ ...event(), trigger: 42, changes: ["kept", 9, null] });
    expect(parsed).toMatchObject({ trigger: "", changes: ["kept"] });
  });
});

describe("readJournal", () => {
  test("it reads what it can and counts what it cannot", () => {
    /**
     * A BAD LINE COSTS ONE LINE. Refusing the whole history over a truncated tail would throw away
     * the record exactly when something has already gone wrong.
     */
    const text = [
      journalLine(event({ id: "a" })),
      "{ truncated mid-write",
      journalLine(event({ id: "b" })),
      JSON.stringify({ id: "c" }),
    ].join("\n");
    const { events, skipped } = readJournal(text);
    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(skipped).toBe(2);
  });

  test("an empty or blank journal is empty, not an error", () => {
    expect(readJournal("").events).toEqual([]);
    expect(readJournal("\n\n  \n").events).toEqual([]);
  });
});

describe("alreadyDeclined", () => {
  test("a refusal stops the same observation coming back", () => {
    // Without this Kit proposes the same rejected memory every session.
    const events = [event({ outcome: "declined" })];
    expect(alreadyDeclined(events, "Said so directly, twice, in this session.")).toBe(true);
  });

  test("it ignores case and surrounding space, because the model rephrases", () => {
    const events = [event({ outcome: "declined", evidence: "  Said So Directly.  " })];
    expect(alreadyDeclined(events, "said so directly.")).toBe(true);
  });

  test("different evidence is a different question and may be asked", () => {
    // Something new happened; that earns another go.
    const events = [event({ outcome: "declined" })];
    expect(alreadyDeclined(events, "It came up again after the rebuild.")).toBe(false);
  });

  test("an accepted event does not block anything", () => {
    expect(alreadyDeclined([event({ outcome: "applied" })], event().evidence)).toBe(false);
  });

  test("empty evidence blocks nothing", () => {
    expect(alreadyDeclined([event({ outcome: "declined", evidence: "" })], "   ")).toBe(false);
  });
});

describe("rollbackTarget", () => {
  test("an applied event can be undone", () => {
    expect(rollbackTarget([event({ id: "a" })], "a")?.id).toBe("a");
  });

  test("a declined or failed event has nothing to undo", () => {
    expect(rollbackTarget([event({ id: "a", outcome: "declined" })], "a")).toBeNull();
    expect(rollbackTarget([event({ id: "a", outcome: "failed" })], "a")).toBeNull();
  });

  test("something already rolled back cannot be rolled back again", () => {
    // Rolling back a rollback is a new decision, not the same key pressed twice.
    const events = [event({ id: "a" }), event({ id: "b", rollbackOf: "a" })];
    expect(rollbackTarget(events, "a")).toBeNull();
  });

  test("a rollback that was itself declined leaves the target undoable", () => {
    const events = [event({ id: "a" }), event({ id: "b", rollbackOf: "a", outcome: "declined" })];
    expect(rollbackTarget(events, "a")?.id).toBe("a");
  });

  test("an unknown id has nothing to undo", () => {
    expect(rollbackTarget([event()], "nope")).toBeNull();
  });
});
