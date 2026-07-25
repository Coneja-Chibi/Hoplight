/** Coverage for the pure stop conditions. */
import { expect, test } from "bun:test";
import { callKey, observationKey, stopReason } from "./stop-core";

test("stops at the step cap, not before", () => {
  expect(stopReason({ step: 5, maxSteps: 5, recentCallKeys: [] })).toContain("5-step limit");
  expect(stopReason({ step: 4, maxSteps: 5, recentCallKeys: [] })).toBeNull();
});

test("stops on three identical calls in a row", () => {
  const k = callKey("list", { kind: "character" });
  expect(stopReason({ step: 3, maxSteps: 20, recentCallKeys: [k, k, k] })).toContain("same tool");
});

test("does not stop on fewer than three, or on varied calls", () => {
  const k = callKey("list", {});
  expect(stopReason({ step: 2, maxSteps: 20, recentCallKeys: [k, k] })).toBeNull();
  expect(stopReason({ step: 3, maxSteps: 20, recentCallKeys: [k, callKey("read", {}), k] })).toBeNull();
});

test("callKey is stable and distinguishes args", () => {
  expect(callKey("list", { a: 1 })).toBe(callKey("list", { a: 1 }));
  expect(callKey("list", { a: 1 })).not.toBe(callKey("list", { a: 2 }));
});

test("observationKey distinguishes changed results for the same call", () => {
  expect(observationKey("read", {}, "one")).not.toBe(observationKey("read", {}, "two"));
  expect(observationKey("read", {}, "one")).toBe(observationKey("read", {}, "one"));
});
