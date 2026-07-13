/**
 * Studio path policy: kinds, IDs, containment.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertSafeStudioId,
  assertStudioEntityKind,
  isSafeStudioId,
  isStudioEntityKind,
  resolveStudioPath,
  STUDIO_ENTITY_KINDS,
} from "./path-policy";
import { StudioValidationError } from "./errors";

describe("studio path-policy", () => {
  test("closed kinds", () => {
    expect(isStudioEntityKind("character")).toBe(true);
    expect(isStudioEntityKind("pack")).toBe(true);
    expect(isStudioEntityKind("preset")).toBe(true);
    expect(isStudioEntityKind("evil")).toBe(false);
    expect(() => assertStudioEntityKind("../x")).toThrow(StudioValidationError);
    expect(STUDIO_ENTITY_KINDS).toContain("lorebook");
    expect(STUDIO_ENTITY_KINDS).toContain("preset");
  });

  test("safe ids accept unicode and separators", () => {
    expect(isSafeStudioId("vera-sandoval")).toBe(true);
    expect(isSafeStudioId("한국여자")).toBe(true);
    expect(isSafeStudioId("a.b_c-1")).toBe(true);
  });

  test("safe ids reject traversal and reserved", () => {
    for (const bad of [
      "",
      ".",
      "..",
      "../x",
      "a/b",
      "a\\b",
      "foo..bar",
      "con",
      "COM1",
      "nul.txt",
      " trailing",
      "ends.",
      "a b",
      "x\u0000y",
    ]) {
      expect(isSafeStudioId(bad)).toBe(false);
    }
    expect(() => assertSafeStudioId("..")).toThrow(StudioValidationError);
  });

  test("resolveStudioPath stays under root", () => {
    const root = join(tmpdir(), "vaude-path-policy-root");
    const kindDir = resolveStudioPath(root, "character");
    expect(kindDir.endsWith(`${"character"}`) || kindDir.includes(`${"character"}`)).toBe(true);
    const file = resolveStudioPath(root, "character", "vera");
    expect(file.endsWith("vera.json")).toBe(true);
    expect(() => resolveStudioPath(root, "character", "../escape")).toThrow(StudioValidationError);
    expect(() => resolveStudioPath(root, "../etc", "passwd")).toThrow(StudioValidationError);
  });
});
