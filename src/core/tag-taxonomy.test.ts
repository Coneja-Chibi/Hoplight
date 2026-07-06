/**
 * Tag taxonomy tests - the classifier is pure, so these pin the contract directly: normalization
 * folds separators/case/hash, known tags land in their category, unknown tags fall to "meta".
 */
import { describe, expect, test } from "bun:test";
import { categorizeTag, TAG_CATEGORIES } from "./tag-taxonomy";

describe("categorizeTag", () => {
  test("classifies representative tags into their category", () => {
    expect(categorizeTag("Male")).toBe("identity");
    expect(categorizeTag("Manipulative")).toBe("trait");
    expect(categorizeTag("Detective")).toBe("role");
    expect(categorizeTag("Fantasy")).toBe("genre");
    expect(categorizeTag("Slow Burn")).toBe("theme");
    expect(categorizeTag("AnyPOV")).toBe("pov");
    expect(categorizeTag("Humiliation")).toBe("kink");
    expect(categorizeTag("Dubious Consent")).toBe("warning");
  });

  test("normalization folds case, leading hash, and separator style", () => {
    expect(categorizeTag("#crime")).toBe("genre");
    expect(categorizeTag("slow-burn")).toBe("theme");
    expect(categorizeTag("slow_burn")).toBe("theme");
    expect(categorizeTag("  ENEMIES  TO  LOVERS ")).toBe("theme");
    expect(categorizeTag("Sci-Fi")).toBe("genre");
  });

  test("unrecognized tags fall to the neutral meta bucket, never a wrong color", () => {
    expect(categorizeTag("xyzzy-not-a-real-tag")).toBe("meta");
    expect(categorizeTag("")).toBe("meta");
    expect(categorizeTag("OC")).toBe("meta");
  });

  test("every seeded category is a declared TagCategory", () => {
    const known = new Set<string>(TAG_CATEGORIES);
    for (const t of ["Male", "Kind", "Doctor", "Romance", "Revenge", "Modern", "POV", "Angst", "Bondage", "Gore", "OC"]) {
      expect(known.has(categorizeTag(t))).toBe(true);
    }
  });
});
