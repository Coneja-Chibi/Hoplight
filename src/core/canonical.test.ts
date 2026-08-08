/**
 * canonicalId must always mint a storage-safe id. Core-only assertions here; the cross-layer
 * contract ("every canonicalId passes the studio's isSafeStudioId gate") lives in
 * src/studio/path-policy.test.ts so a core test never imports an outer layer.
 */
import { describe, expect, test } from "bun:test";
import { canonicalId, primaryOriginalId, primaryOriginalRaw } from "./canonical";

describe("primaryOriginalId", () => {
  test("names the first entry's key, the same entry primaryOriginalRaw reads the value of", () => {
    const original = {
      lumiverse: { raw: { a: 1 } },
      "lumiverse-archive": { raw: { b: 2 } },
    };
    expect(primaryOriginalId(original)).toBe("lumiverse");
    expect(primaryOriginalRaw(original)).toEqual({ a: 1 });
  });

  test("undefined for a from-scratch entity with no original at all", () => {
    expect(primaryOriginalId(undefined)).toBeUndefined();
  });

  test("undefined for an entity whose original is present but empty", () => {
    expect(primaryOriginalId({})).toBeUndefined();
  });
});

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
