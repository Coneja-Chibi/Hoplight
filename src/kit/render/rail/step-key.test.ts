/**
 * The keys that flip presets, pinned.
 *
 * Reported broken twice, and twice I read the handler and concluded it was fine. These are the exact
 * events a terminal sends for the keys somebody actually presses.
 */
import { describe, expect, test } from "bun:test";
import { stepDelta } from "./step-key";

describe("stepDelta", () => {
  test("the angle brackets, as a terminal sends them", () => {
    // Shift is held and the key NAME is the unshifted character; the sequence carries what was typed.
    expect(stepDelta({ name: ".", sequence: ">", shift: true })).toBe(1);
    expect(stepDelta({ name: ",", sequence: "<", shift: true })).toBe(-1);
  });

  test("the arrow keys", () => {
    expect(stepDelta({ name: "right", sequence: "\u001b[C" })).toBe(1);
    expect(stepDelta({ name: "left", sequence: "\u001b[D" })).toBe(-1);
  });

  test("an unshifted comma or period is typing, not stepping", () => {
    expect(stepDelta({ name: ",", sequence: "," })).toBeNull();
    expect(stepDelta({ name: ".", sequence: "." })).toBeNull();
  });

  test("a modifier disqualifies an arrow, so resize and move are not also a flip", () => {
    // Ctrl+Shift+Left resizes the rail; alt+arrow moves a block. Neither may also step the shelf.
    expect(stepDelta({ name: "left", ctrl: true, shift: true })).toBeNull();
    expect(stepDelta({ name: "right", ctrl: true, shift: true })).toBeNull();
    expect(stepDelta({ name: "down", option: true })).toBeNull();
    expect(stepDelta({ name: "left", meta: true })).toBeNull();
  });

  test("everything else is somebody else's key", () => {
    for (const name of ["up", "down", "space", "return", "r", "e", "n", "tab"]) {
      expect(stepDelta({ name })).toBeNull();
    }
  });
});
