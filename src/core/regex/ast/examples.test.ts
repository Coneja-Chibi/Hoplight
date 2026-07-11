/**
 * Tests for execution-verified example generation (REGEX-JEWEL-PLAN.md Phase R2X, QOL 21). The core
 * property is engine truth: EVERY emitted match must actually match the real compiled regex, and
 * EVERY emitted near-miss must actually fail it. The oracle here compiles the ORIGINAL pattern text
 * (not the printer's output), so the suite also guards against a printer that drifts from the source
 * grammar. Corpus flags are already normalized (u present, no g/y) so the oracle equals the verifier
 * examples.ts builds. A seeded rng keeps every run deterministic.
 */
import { describe, expect, it } from "bun:test";
import { parseRegex } from "./parser";
import type { Alternation } from "./ast-types";
import { examplesFor } from "./examples";

/** Deterministic unit generator (mulberry32) so tests never touch Math.random. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function astOf(pattern: string, flags: string): Alternation {
  const result = parseRegex(pattern, flags);
  if ("error" in result) throw new Error(`corpus pattern failed to parse: ${pattern} (${result.error})`);
  return result.ast;
}

interface Case {
  pattern: string;
  flags: string;
}

// Mixed corpus: literals, alternation, classes, quantifiers, anchors, lookahead, lookbehind,
// numeric + named backreferences, unicode properties, dot. Flags are pre-normalized (u, no g/y).
const CORPUS: Case[] = [
  { pattern: "abc", flags: "u" },
  { pattern: "^abc$", flags: "u" },
  { pattern: "a|b|c", flags: "u" },
  { pattern: "\\d+", flags: "u" },
  { pattern: "[a-z]+", flags: "u" },
  { pattern: "[^0-9]+", flags: "u" },
  { pattern: "(cat|dog)s?", flags: "u" },
  { pattern: "colou?r", flags: "iu" },
  { pattern: "\\bword\\b", flags: "u" },
  { pattern: "gr[ae]y", flags: "u" },
  { pattern: "\\w+@\\w+", flags: "u" },
  { pattern: "(?=.*\\d)\\w{3,8}", flags: "u" },
  { pattern: "(?<=\\$)\\d+", flags: "u" },
  { pattern: "foo(?!bar)\\w*", flags: "u" },
  { pattern: "(['\"]).*?\\1", flags: "u" },
  { pattern: "(?<q>['\"])\\w+\\k<q>", flags: "u" },
  { pattern: "\\p{L}+", flags: "u" },
  { pattern: "a.c", flags: "u" },
  { pattern: "^\\[status\\][\\s\\S]*?\\[/status\\]$", flags: "u" },
];

describe("examplesFor - engine truth (the load-bearing property)", () => {
  for (const { pattern, flags } of CORPUS) {
    it(`every emitted string obeys the compiled regex: /${pattern}/${flags}`, () => {
      const oracle = new RegExp(pattern, flags);
      const ast = astOf(pattern, flags);
      const { matches, nearMisses } = examplesFor(ast, { rng: seededRng(42), count: 8, flags });

      for (const s of matches) {
        oracle.lastIndex = 0;
        expect(oracle.test(s)).toBe(true);
        expect(s.length).toBeGreaterThan(0);
      }
      for (const s of nearMisses) {
        oracle.lastIndex = 0;
        expect(oracle.test(s)).toBe(false);
        expect(s.length).toBeGreaterThan(0);
      }
    });
  }
});

describe("examplesFor - non-vacuous yield (guards a hollow all-empty pass)", () => {
  it("produces real matches for a plain pattern", () => {
    const ast = astOf("abc", "u");
    const { matches } = examplesFor(ast, { rng: seededRng(1), count: 8, flags: "u" });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("produces real matches for a digit-run pattern (fuzz-rescued as needed)", () => {
    const ast = astOf("\\d+", "u");
    const { matches } = examplesFor(ast, { rng: seededRng(1), count: 8, flags: "u" });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("produces real matches for a leading-lookahead pattern", () => {
    const ast = astOf("(?=.*\\d)\\w{3,8}", "u");
    const { matches } = examplesFor(ast, { rng: seededRng(7), count: 8, flags: "u" });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("produces real near-misses for an anchored exact pattern", () => {
    const ast = astOf("^abc$", "u");
    const { nearMisses } = examplesFor(ast, { rng: seededRng(1), count: 8, flags: "u" });
    expect(nearMisses.length).toBeGreaterThan(0);
  });

  it("produces real near-misses for a whole-word pattern", () => {
    const ast = astOf("\\bword\\b", "u");
    const { nearMisses } = examplesFor(ast, { rng: seededRng(3), count: 8, flags: "u" });
    expect(nearMisses.length).toBeGreaterThan(0);
  });
});

describe("examplesFor - honest degradation", () => {
  it("returns no near-misses for a pattern that matches everything", () => {
    const ast = astOf(".*", "u");
    const { nearMisses } = examplesFor(ast, { rng: seededRng(9), count: 8, flags: "u" });
    expect(nearMisses).toEqual([]);
  });

  it("respects the count bound on both buckets", () => {
    const ast = astOf("[a-z]+", "u");
    const { matches, nearMisses } = examplesFor(ast, { rng: seededRng(5), count: 3, flags: "u" });
    expect(matches.length).toBeLessThanOrEqual(3);
    expect(nearMisses.length).toBeLessThanOrEqual(3);
  });

  it("count 0 yields empty buckets", () => {
    const ast = astOf("abc", "u");
    const result = examplesFor(ast, { rng: seededRng(1), count: 0, flags: "u" });
    expect(result).toEqual({ matches: [], nearMisses: [] });
  });
});

describe("examplesFor - determinism (purity guard: same seed, same output)", () => {
  for (const { pattern, flags } of CORPUS) {
    it(`is stable across seeds for /${pattern}/${flags}`, () => {
      const ast = astOf(pattern, flags);
      const first = examplesFor(ast, { rng: seededRng(123), count: 6, flags });
      const second = examplesFor(ast, { rng: seededRng(123), count: 6, flags });
      expect(second).toEqual(first);
    });
  }
});

describe("examplesFor - default flags force u", () => {
  it("compiles a unicode-property pattern even when flags are omitted", () => {
    const ast = astOf("\\p{L}+", "u");
    // No flags passed: normalizeFlags must force "u" or the RegExp compile would throw and both
    // buckets would come back empty. A non-empty match set proves the u-forcing works.
    const { matches } = examplesFor(ast, { rng: seededRng(2), count: 8 });
    for (const s of matches) {
      const oracle = new RegExp("\\p{L}+", "u");
      expect(oracle.test(s)).toBe(true);
    }
    expect(matches.length).toBeGreaterThan(0);
  });
});
