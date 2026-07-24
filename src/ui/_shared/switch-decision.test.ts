/** Tests for the pure switch-direction + data-change classifier (both endpoints of the bump span). */
import { describe, expect, test } from "bun:test";
import { classifyDataChange, switchKind } from "./switch-decision";

describe("switchKind", () => {
  test("handles bare-vs-v-prefixed and both directions", () => {
    expect(switchKind("0.1.9", "v0.1.9")).toBe("current"); // same version, different spelling
    expect(switchKind("0.1.9", "v0.1.11")).toBe("update");
    expect(switchKind("v0.1.11", "v0.1.9")).toBe("rollback");
  });
});

describe("classifyDataChange", () => {
  test("no bumps configured -> never a data change", () => {
    expect(classifyDataChange("v0.2.0", "v0.1.0", [])).toBe(false);
  });
  test("rolling back FROM the bump release crosses it (leaving its schema)", () => {
    expect(classifyDataChange("v0.2.0", "v0.1.11", ["0.2.0"])).toBe(true);
  });
  test("rolling back TO the bump release does NOT cross it (it reads its own schema)", () => {
    expect(classifyDataChange("v0.2.3", "v0.2.0", ["0.2.0"])).toBe(false);
  });
  test("a span that straddles a bump crosses it, in either direction", () => {
    expect(classifyDataChange("v0.1.9", "v0.2.1", ["0.2.0"])).toBe(true);
    expect(classifyDataChange("v0.2.1", "v0.1.9", ["0.2.0"])).toBe(true);
  });
  test("a span entirely below or above the bump does not cross it", () => {
    expect(classifyDataChange("v0.1.5", "v0.1.9", ["0.2.0"])).toBe(false);
    expect(classifyDataChange("v0.2.1", "v0.2.5", ["0.2.0"])).toBe(false);
  });
});
