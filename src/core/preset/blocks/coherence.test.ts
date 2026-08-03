/**
 * The coherence checker.
 *
 * Every case here is a preset that renders completely and is still wrong, which is the whole reason
 * the checker exists: preset_verify would call all of these clean, because their macros resolve
 * perfectly. The risk in the other direction is noise, so the disabled-block and no-findings cases
 * matter just as much as the detections.
 */
import { describe, expect, test } from "bun:test";
import { checkCoherence, formatCoherence, type ClassifiedBlock } from "./coherence";
import { BLOCK_PATTERNS, findPattern, silentPatterns } from "./patterns";

const block = (
  identifier: string,
  pattern: string,
  enabled = true,
): ClassifiedBlock => ({ identifier, pattern, enabled });

const kinds = (blocks: ClassifiedBlock[]): string[] =>
  checkCoherence(blocks).map((f) => `${f.kind}:${f.identifier}`);

describe("ordering", () => {
  test("a module ordered after the assembler is enabled and never read", () => {
    // The defect the survey found in the wild, with exactly one author detecting it by hand.
    const findings = checkCoherence([
      block("init", "variable-init"),
      block("render", "assembler"),
      block("pov", "option-exclusive"),
    ]);
    expect(findings.some((f) => f.kind === "out-of-order")).toBe(true);
    expect(findings.some((f) => f.detail.includes("assembler"))).toBe(true);
  });

  test("the correct order is silent", () => {
    expect(kinds([
      block("init", "variable-init"),
      block("pov", "option-exclusive"),
      block("render", "assembler"),
    ])).toEqual([]);
  });

  test("an assembler with no initializer is a missing dependency", () => {
    const findings = checkCoherence([block("render", "assembler")]);
    expect(findings.some((f) => f.kind === "missing-dependency")).toBe(true);
  });

  test("a settings mirror before the assembler has nothing to mirror", () => {
    const findings = checkCoherence([
      block("init", "variable-init"),
      block("mirror", "settings-mirror"),
      block("render", "assembler"),
    ]);
    expect(findings.some((f) => f.identifier === "mirror" && f.kind === "out-of-order")).toBe(true);
  });

  test("DISABLED blocks are ignored, or every option a person ever turned off becomes noise", () => {
    expect(kinds([
      block("render", "assembler", true),
      block("init", "variable-init", false),
      block("pov", "option-exclusive", false),
    ])).toEqual(["missing-dependency:render"]);
  });

  test("an unrecognised block is not a fault", () => {
    // Most blocks in a real preset will not match a catalog pattern, and that is fine.
    expect(checkCoherence([
      { identifier: "mystery", enabled: true },
      { identifier: "other", enabled: true, pattern: "anti-slop" },
    ])).toEqual([]);
  });
});

describe("exclusive groups", () => {
  test("two enabled options are reported WITHOUT guessing which wins", () => {
    // First-enabled-wins and last-write-wins both occur in the corpus and no preset declares which,
    // so asserting a winner would be worse than naming the ambiguity.
    const findings = checkCoherence([
      block("init", "variable-init"),
      block("pov-first", "option-exclusive"),
      block("pov-third", "option-exclusive"),
      block("render", "assembler"),
    ]);
    const ambiguous = findings.filter((f) => f.kind === "ambiguous-choice");
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0]!.detail).toContain("first-enabled");
    expect(ambiguous[0]!.detail).toContain("last-write");
  });

  test("one enabled option is not ambiguous", () => {
    const findings = checkCoherence([
      block("init", "variable-init"),
      block("pov", "option-exclusive"),
      block("render", "assembler"),
    ]);
    expect(findings.filter((f) => f.kind === "ambiguous-choice")).toHaveLength(0);
  });
});

describe("formatCoherence", () => {
  test("a clean preset says what was NOT checked, so it is not read as a full pass", () => {
    const text = formatCoherence([]);
    expect(text).toContain("preset_verify");
    expect(text).toContain("does not check");
  });

  test("findings name the block and the consequence", () => {
    const text = formatCoherence(checkCoherence([block("render", "assembler")]));
    expect(text).toContain("render");
    expect(text).toContain("missing-dependency");
  });
});

describe("the catalog", () => {
  test("every ordering rule points at a pattern that exists", () => {
    // A typo in a dependency id would silently disable the rule it belongs to.
    for (const pattern of BLOCK_PATTERNS) {
      const rule = pattern.ordering;
      for (const id of [...(rule?.after ?? []), ...(rule?.before ?? []), ...(rule?.requires ?? [])]) {
        expect(findPattern(id), `${pattern.id} references ${id}`).toBeDefined();
      }
    }
  });

  test("prevalence is recorded for every pattern, out of the 13 surveyed", () => {
    // Without it a reader cannot tell a near-universal convention from one author's idea.
    for (const pattern of BLOCK_PATTERNS) {
      expect(pattern.prevalence).toBeGreaterThan(0);
      expect(pattern.prevalence).toBeLessThanOrEqual(13);
    }
  });

  test("the silent majority is representable, since that is the survey's headline", () => {
    expect(silentPatterns().length).toBeGreaterThan(0);
    expect(findPattern("variable-init")!.emits).toBe("nothing");
    expect(findPattern("assembler")!.emits).toBe("text");
  });
});
