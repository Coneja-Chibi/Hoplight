/**
 * Word-family analysis (word-family.ts): shared stem, longest-first ordering, and the odd-one-out
 * warning that drives the optimize chip. House-rule check: the warning never carries an em dash.
 */
import { describe, expect, test } from "bun:test";
import { analyzeWordFamily } from "./word-family";

describe("analyzeWordFamily", () => {
  test("empty and single-word inputs", () => {
    expect(analyzeWordFamily([])).toMatchObject({ words: [], optimizedWords: [] });
    expect(analyzeWordFamily(["cat"])).toMatchObject({ root: "cat", description: 'Single word: "cat"' });
  });

  test("shared stem is detected as the root", () => {
    // bound/boundary/boundaries: one word sits inside another, so RC treats it as containment
    // (ordering matters), not a suffix family - hasPattern stays false but the root is still found.
    const a = analyzeWordFamily(["bound", "boundary", "boundaries"]);
    expect(a.root).toBe("bound");
    expect(a.coveringWords.length).toBeGreaterThan(0);
  });

  test("a non-containment suffix family reports hasPattern", () => {
    const a = analyzeWordFamily(["fighter", "fighting"]);
    expect(a.root).toBe("fight");
    expect(a.hasPattern).toBe(true);
  });

  test("longest-first ordering so a full word wins over its prefix", () => {
    const a = analyzeWordFamily(["dash", "dashing"]);
    expect(a.optimizedWords[0]).toBe("dashing");
    expect(a.optimizedWords.at(-1)).toBe("dash");
  });

  test("odd-one-out warning uses a colon, never an em dash", () => {
    const a = analyzeWordFamily(["dash", "dashing"]);
    expect(a.warning).toBeTruthy();
    expect(a.warning).not.toContain("—");
    expect(a.warning).toContain(":");
    expect(a.coveringWords).toContain("dashing");
  });

  test("dedupes and trims", () => {
    expect(analyzeWordFamily([" cat ", "cat", "dog"]).words.sort()).toEqual(["cat", "dog"]);
  });
});
