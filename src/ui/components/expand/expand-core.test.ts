/** Regression coverage for the caret, Escape, and focus-trap rules the fullscreen box runs on. */
import { test, expect } from "bun:test";
import { applyCaret, clampCaret, isEscapeClose, readCaret, trapTarget, type TextTarget } from "./expand-core";

/** a stand-in for a textarea: records the range it was told to select. */
function fakeTarget(value: string, start: number | null, end: number | null, scrollTop = 0): TextTarget & { range: [number, number] | null } {
  return {
    value,
    selectionStart: start,
    selectionEnd: end,
    scrollTop,
    range: null,
    setSelectionRange(a: number, b: number) {
      this.range = [a, b];
    },
  };
}

test("readCaret keeps the selection and the scroll offset", () => {
  expect(readCaret(fakeTarget("hello world", 2, 7, 42))).toEqual({ start: 2, end: 7, scrollTop: 42 });
});

test("readCaret treats an unfocused control as a caret at the end", () => {
  expect(readCaret(fakeTarget("hello", null, null))).toEqual({ start: 5, end: 5, scrollTop: 0 });
});

test("clampCaret pulls a stale caret back inside shortened text", () => {
  expect(clampCaret({ start: 40, end: 90, scrollTop: 10 }, 6)).toEqual({ start: 6, end: 6, scrollTop: 10 });
});

test("clampCaret never returns an inverted or negative range", () => {
  expect(clampCaret({ start: 9, end: 2, scrollTop: -5 }, 20)).toEqual({ start: 9, end: 9, scrollTop: 0 });
  expect(clampCaret({ start: -3, end: -1, scrollTop: 0 }, 20)).toEqual({ start: 0, end: 0, scrollTop: 0 });
});

test("applyCaret restores the range and the scroll offset on the other control", () => {
  const el = fakeTarget("hello world", null, null);
  applyCaret(el, { start: 2, end: 7, scrollTop: 30 });
  expect(el.range).toEqual([2, 7]);
  expect(el.scrollTop).toBe(30);
});

test("applyCaret clamps against the text the receiving control actually holds", () => {
  const el = fakeTarget("hi", null, null);
  applyCaret(el, { start: 11, end: 11, scrollTop: 0 });
  expect(el.range).toEqual([2, 2]);
});

test("Escape closes the box", () => {
  expect(isEscapeClose({ key: "Escape" })).toBe(true);
});

test("an Escape the editor already used does not close the box", () => {
  // CodeEditor's macro popover eats Escape; dismissing it must not also exit fullscreen.
  expect(isEscapeClose({ key: "Escape", defaultPrevented: true })).toBe(false);
});

test("an IME composition cancel does not close the box", () => {
  expect(isEscapeClose({ key: "Escape", isComposing: true })).toBe(false);
});

test("other keys never close the box", () => {
  expect(isEscapeClose({ key: "Enter" })).toBe(false);
  expect(isEscapeClose({ key: "Esc" })).toBe(false);
});

test("trapTarget leaves the browser alone in the middle of the sheet", () => {
  expect(trapTarget(["a", "b", "c"], "b", false)).toBeNull();
  expect(trapTarget(["a", "b", "c"], "b", true)).toBeNull();
});

test("trapTarget wraps at both ends", () => {
  expect(trapTarget(["a", "b", "c"], "c", false)).toBe("a");
  expect(trapTarget(["a", "b", "c"], "a", true)).toBe("c");
});

test("trapTarget pulls focus back when it left the sheet", () => {
  expect(trapTarget(["a", "b", "c"], null, false)).toBe("a");
  expect(trapTarget(["a", "b", "c"], "gone", true)).toBe("a");
});

test("trapTarget with a single focusable keeps focus on it", () => {
  expect(trapTarget(["only"], "only", false)).toBe("only");
  expect(trapTarget(["only"], "only", true)).toBe("only");
});

test("trapTarget on an empty sheet does nothing", () => {
  expect(trapTarget([], null, false)).toBeNull();
});
