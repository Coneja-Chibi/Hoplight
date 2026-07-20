/** Regression coverage for the trigger-edit.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import { patchTriggerAt } from "./trigger-edit";
import type { Trigger } from "../../../../entities/lorebook/schema";

const base = (): Trigger[] => [
  { keyword: "revival", isRegex: false },
  { keyword: "pow.*", isRegex: true, flags: "i" },
];

describe("patchTriggerAt", () => {
  test("sets riders on the indexed trigger only", () => {
    const out = patchTriggerAt(base(), 0, { frequency: 3, probability: 50 });
    expect(out[0]).toEqual({ keyword: "revival", isRegex: false, frequency: 3, probability: 50 });
    expect(out[1]).toEqual(base()[1]);
  });

  test("undefined removes a rider key instead of writing undefined", () => {
    const withRiders = patchTriggerAt(base(), 0, { frequency: 3 });
    const out = patchTriggerAt(withRiders, 0, { frequency: undefined });
    expect("frequency" in out[0]!).toBe(false);
  });

  test("turning regex off drops flags", () => {
    const out = patchTriggerAt(base(), 1, { isRegex: false });
    expect(out[1]!.isRegex).toBe(false);
    expect("flags" in out[1]!).toBe(false);
  });

  test("out-of-range index is a no-op", () => {
    const t = base();
    expect(patchTriggerAt(t, 5, { isRegex: true })).toBe(t);
    expect(patchTriggerAt(t, -1, { isRegex: true })).toBe(t);
  });
});
