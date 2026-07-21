/**
 * canonicalId must always mint a storage-safe id. Core-only assertions here; the cross-layer
 * contract ("every canonicalId passes the studio's isSafeStudioId gate") lives in
 * src/studio/path-policy.test.ts so a core test never imports an outer layer.
 */
import { describe, expect, test } from "bun:test";
import { canonicalId } from "./canonical";

describe("canonicalId", () => {
  test("empty falls back to character", () => {
    expect(canonicalId("")).toBe("character");
    expect(canonicalId(null)).toBe("character");
  });

  test("strips path separators and unsafe runs", () => {
    expect(canonicalId("a/b\\c")).not.toContain("/");
    expect(canonicalId("a/b\\c")).not.toContain("\\");
    expect(canonicalId("../etc/passwd")).not.toMatch(/\.\./);
  });

  test("reserved device names get a safe suffix", () => {
    expect(canonicalId("CON").toLowerCase()).not.toBe("con");
  });

  test("unicode names stay usable", () => {
    expect(canonicalId("한국 이름").length).toBeGreaterThan(0);
  });
});
