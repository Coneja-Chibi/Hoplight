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

test("nativeBentoParts spreads small cards across all three columns and full-spans the big ones", () => {
  const items = nativeItemsFor(["rolecall"], read, noop, noop);
  const parts = nativeBentoParts(items);
  expect(parts.columns.length).toBe(3);
  const smalls = items.filter((i) => !i.big).length;
  const bigs = items.filter((i) => i.big).length;
  expect(parts.columns.flat().length).toBe(smalls); // every small card is placed exactly once
  expect(parts.spanRow === null).toBe(bigs === 0); // the span row exists iff there are big cards
  if (smalls >= 3) expect(parts.columns.every((c) => c.length > 0)).toBe(true); // not dumped in one column
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
