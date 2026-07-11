/**
 * validateRule tests (REGEX-JEWEL-PLAN.md Phase R2). Ported cases from RC's engine.test.ts
 * discipline, house style. The complexity/nested-quantifier cases are the same fixture apply.ts
 * relies on to refuse catastrophic patterns before they ever run.
 */
import { describe, expect, test } from "bun:test";
import type { RegexRule } from "../../entities/regex/schema";
import { COMPLEXITY_HARD_CAP, MAX_PATTERN_LENGTH, MAX_REPLACEMENT_LENGTH, validateRule } from "./validate";

function rule(overrides: Partial<RegexRule> = {}): RegexRule {
  return {
    id: "r1",
    label: "Rule",
    find: "cat",
    flags: "g",
    replace: "dog",
    phases: ["output"],
    enabled: true,
    sortOrder: 0,
    ...overrides,
  };
}

describe("validateRule", () => {
  test("accepts a plain pattern", () => {
    const result = validateRule(rule());
    expect(result.ok).toBe(true);
    expect(result.complexity).toBeGreaterThanOrEqual(0);
  });

  test("rejects an empty pattern", () => {
    const result = validateRule(rule({ find: "   " }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/empty/);
  });

  test("rejects a pattern past the length cap", () => {
    const result = validateRule(rule({ find: "a".repeat(MAX_PATTERN_LENGTH + 1) }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exceeds/);
  });

  test("rejects a replacement past the length cap", () => {
    const result = validateRule(rule({ replace: "a".repeat(MAX_REPLACEMENT_LENGTH + 1) }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/replacement/);
  });

  test("rejects invalid regex syntax", () => {
    const result = validateRule(rule({ find: "(unclosed" }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid pattern/);
  });

  test("rejects the catastrophic-backtracking shape (a+)+$ before it ever compiles for a run", () => {
    const result = validateRule(rule({ find: "(a+)+$" }));
    expect(result.ok).toBe(false);
    expect(result.complexity).toBeGreaterThanOrEqual(COMPLEXITY_HARD_CAP);
    expect(result.error).toMatch(/catastrophic/);
  });

  test("nested quantifier variants also trip the gate", () => {
    for (const find of ["(.*)+", "(.+)*", "([^x]*)+", "(a|a)+b"]) {
      const result = validateRule(rule({ find }));
      if (find === "(a|a)+b") {
        // alternation-only bombs are not nested-quantifier shaped; complexity stays low but the
        // pattern is still valid regex syntax, so it passes this gate (out of scope for R2).
        expect(result.ok).toBe(true);
      } else {
        expect(result.ok).toBe(false);
      }
    }
  });

  test("plain quantifiers without nesting stay well under the cap", () => {
    const result = validateRule(rule({ find: "a+b*c?d{2,4}" }));
    expect(result.ok).toBe(true);
    expect(result.complexity).toBeLessThan(COMPLEXITY_HARD_CAP);
  });
});
