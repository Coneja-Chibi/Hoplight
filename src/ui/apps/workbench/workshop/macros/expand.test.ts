/**
 * Macro expand + chips.
 */
import { test, expect } from "bun:test";
import { expandAgainstVars, MACRO_CHIPS, stillHasMacro } from "./expand";

test("MACRO_CHIPS are non-empty inserts", () => {
  expect(MACRO_CHIPS.length).toBeGreaterThan(3);
  for (const c of MACRO_CHIPS) {
    expect(c.insert.includes("{{")).toBe(true);
  }
});

test("expandAgainstVars resolves getvar", () => {
  const out = expandAgainstVars("HP is {{getvar::hp}}", [{ name: "hp", value: "42" }]);
  expect(out).toBe("HP is 42");
});

test("stillHasMacro detects leftover braces", () => {
  expect(stillHasMacro("{{nope}}")).toBe(true);
  expect(stillHasMacro("plain")).toBe(false);
});
