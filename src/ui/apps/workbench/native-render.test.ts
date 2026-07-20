/** Regression coverage for the native-render.test behavior owned beside this file. */
import { expect, test } from "bun:test";
import { nativeItemsFor, nativeBentoParts, nativePlaybillNav } from "./native-render";

const noop = (): void => {};
const read = (): unknown => undefined;

// This is the regression the owner caught twice: native fields showing in one layout and vanishing in
// the other. Both layouts derive from nativeItemsFor, so these assertions guard that they can't diverge.

test("nativeItemsFor gathers a targeted platform's native fields, tagged with its label", () => {
  const items = nativeItemsFor(["rolecall"], read, noop, noop);
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => i.platform === "RoleCall")).toBe(true);
});

test("nativeBentoParts packs into middle+right only; left (portrait) stays empty; no full-span", () => {
  const items = nativeItemsFor(["rolecall"], read, noop, noop);
  const parts = nativeBentoParts(items);
  expect(parts.columns.length).toBe(3);
  expect(parts.columns[0]).toEqual([]); // sticky face column never gets twin fields
  expect(parts.columns.flat().length).toBe(items.length); // every card placed once in content cols
  expect(parts.spanRow).toBeNull();
  // with 2+ cards they balance across middle and right
  if (items.length >= 2) {
    expect(parts.columns[1]!.length + parts.columns[2]!.length).toBe(items.length);
    expect(parts.columns[1]!.length > 0 || parts.columns[2]!.length > 0).toBe(true);
  }
});

test("both layouts derive from the SAME items: the playbill gets one native section per platform", () => {
  const items = nativeItemsFor(["rolecall", "sillytavern"], read, noop, noop);
  expect(nativePlaybillNav(items).length).toBe(2); // one nav entry per platform present
});

test("no platform selected -> nothing in either layout", () => {
  const items = nativeItemsFor([], read, noop, noop);
  expect(items).toEqual([]);
  expect(nativeBentoParts(items).spanRow).toBeNull();
  expect(nativePlaybillNav(items)).toEqual([]);
});

test("an unknown platform key contributes nothing (no throw)", () => {
  expect(nativeItemsFor(["does-not-exist"], read, noop, noop)).toEqual([]);
});
