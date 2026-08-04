/**
 * The focus stack, tested on the negatives - because the bug it exists to prevent is a component
 * acting on a key it should never have seen, and every one of those reads as silence rather than as
 * an error.
 */
import { describe, expect, test } from "bun:test";
import { EMPTY_FOCUS, escapeTarget, hasFocus, isOpen, owner, pop, push } from "./focus";

describe("only one layer owns the keyboard", () => {
  test("the composer holds it when nothing else is open", () => {
    expect(owner(EMPTY_FOCUS)).toBe("composer");
    expect(hasFocus(EMPTY_FOCUS, "composer")).toBe(true);
  });

  test("an open rail takes focus AND the composer loses it", () => {
    // The second half is the one that broke live: the rail took keys while the composer also still
    // read them, so typing went two places and the composer appeared to eat characters.
    const withRail = push(EMPTY_FOCUS, "rail");
    expect(hasFocus(withRail, "rail")).toBe(true);
    expect(hasFocus(withRail, "composer")).toBe(false);
  });

  test("closing the rail hands focus back", () => {
    const state = pop(push(EMPTY_FOCUS, "rail"), "rail");
    expect(hasFocus(state, "composer")).toBe(true);
  });

  test("a layer that is open but not on top gets nothing", () => {
    const state = push(push(EMPTY_FOCUS, "rail"), "gate");
    expect(isOpen(state, "rail")).toBe(true);
    expect(hasFocus(state, "rail")).toBe(false);
  });
});

describe("the gate outranks everything, and that is a safety property", () => {
  test("a gate opening over the rail takes the keyboard immediately", () => {
    // A keystroke meant for an allow/deny question must never land in the composer and leave the
    // question sitting unanswered behind whatever the person then types into.
    const state = push(push(EMPTY_FOCUS, "rail"), "gate");
    expect(owner(state)).toBe("gate");
  });

  test("priority wins over push order, so a later rail cannot steal the gate's keys", () => {
    const state = push(push(EMPTY_FOCUS, "gate"), "rail");
    expect(owner(state)).toBe("gate");
    expect(hasFocus(state, "rail")).toBe(false);
  });
});

describe("the composer is the floor", () => {
  test("it cannot be popped, or nothing would own the keyboard", () => {
    expect(pop(EMPTY_FOCUS, "composer")).toEqual(EMPTY_FOCUS);
    expect(owner(pop(EMPTY_FOCUS, "composer"))).toBe("composer");
  });

  test("escape at the floor closes nothing - it stays a turn cancel", () => {
    expect(escapeTarget(EMPTY_FOCUS)).toBeNull();
  });

  test("escape closes the owner, innermost first", () => {
    const state = push(push(EMPTY_FOCUS, "rail"), "gate");
    expect(escapeTarget(state)).toBe("gate");
    expect(escapeTarget(pop(state, "gate"))).toBe("rail");
  });
});

describe("push and pop are total", () => {
  test("pushing an already-open layer changes nothing", () => {
    const once = push(EMPTY_FOCUS, "rail");
    expect(push(once, "rail")).toEqual(once);
  });

  test("popping a layer that was never open changes nothing", () => {
    expect(pop(EMPTY_FOCUS, "menu")).toEqual(EMPTY_FOCUS);
  });

  test("neither mutates the state it was given", () => {
    const before = push(EMPTY_FOCUS, "rail");
    const snapshot = [...before.stack];
    push(before, "gate");
    pop(before, "rail");
    expect([...before.stack]).toEqual(snapshot);
  });
});
