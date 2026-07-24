/** Tests for the updates route helpers. The fetch shell is thin (covered live); clampPage is the one
 *  piece of caller input near the fixed URL, so it is pinned here. */
import { describe, expect, test } from "bun:test";
import { clampPage } from "./server-updates";

describe("clampPage", () => {
  test("defaults to 1 for missing or junk input", () => {
    expect(clampPage(null)).toBe(1);
    expect(clampPage("")).toBe(1);
    expect(clampPage("abc")).toBe(1);
    expect(clampPage("0")).toBe(1);
    expect(clampPage("-5")).toBe(1);
  });
  test("passes a real page through and caps at 50", () => {
    expect(clampPage("3")).toBe(3);
    expect(clampPage("50")).toBe(50);
    expect(clampPage("999")).toBe(50);
  });
});
