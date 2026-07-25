/** Marquee layout and twinkle-pattern regression tests. */
import { expect, test } from "bun:test";
import { compactPlaybill, lampPattern } from "./playbill-core";

test("wide, tall terminals keep the full marquee", () => {
  expect(compactPlaybill(110, 32)).toBe(false);
  expect(compactPlaybill(59, 32)).toBe(true);
  expect(compactPlaybill(110, 15)).toBe(true);
});

test("lamp rows fill the width and visibly change between ticks", () => {
  const first = lampPattern(81, 0, 0);
  const next = lampPattern(81, 1, 0);
  expect(first).toHaveLength(41);
  expect(first.some(Boolean)).toBe(true);
  expect(next).not.toEqual(first);
});
