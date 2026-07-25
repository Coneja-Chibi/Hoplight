/** Verifies the deterministic threshold used to fold settled long assistant replies. */
import { expect, test } from "bun:test";
import { isLongSay, LONG_SAY_CHARS } from "./say-fold";

test("only replies beyond the long-say threshold fold", () => {
  expect(isLongSay("x".repeat(LONG_SAY_CHARS))).toBe(false);
  expect(isLongSay("x".repeat(LONG_SAY_CHARS + 1))).toBe(true);
});
