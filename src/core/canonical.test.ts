/**
 * canonicalId must always mint a storage-safe id.
 */
import { describe, expect, test } from "bun:test";
import { isSafeStudioId } from "../studio/path-policy";
import { canonicalId } from "./canonical";

describe("canonicalId", () => {
  test("empty falls back to character", () => {
    expect(canonicalId("")).toBe("character");
    expect(canonicalId(null)).toBe("character");
    expect(isSafeStudioId(canonicalId(""))).toBe(true);
  });

  test("strips path separators and unsafe runs", () => {
    expect(isSafeStudioId(canonicalId("Vera Sandoval"))).toBe(true);
    expect(canonicalId("a/b\\c")).not.toContain("/");
    expect(canonicalId("a/b\\c")).not.toContain("\\");
    expect(isSafeStudioId(canonicalId("a/b\\c"))).toBe(true);
    expect(isSafeStudioId(canonicalId("../etc/passwd"))).toBe(true);
    expect(canonicalId("../etc/passwd")).not.toMatch(/\.\./);
  });

  test("reserved device names get a safe suffix", () => {
    const id = canonicalId("CON");
    expect(isSafeStudioId(id)).toBe(true);
    expect(id.toLowerCase()).not.toBe("con");
  });

  test("unicode names stay usable", () => {
    const id = canonicalId("한국 이름");
    expect(isSafeStudioId(id)).toBe(true);
  });
});
