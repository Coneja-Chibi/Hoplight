/**
 * Pure regex validation (REGEX-JEWEL-PLAN.md Phase R2). Complexity heuristic + nested-quantifier
 * detection ported from RoleCall's engine.ts discipline (apps/rc/src/lib/regex/engine.ts
 * validateRegex/estimateComplexity), house style.
 *
 * This is the ONLY real defense a synchronous JS engine has against catastrophic backtracking: a
 * bomb pattern like (a+)+$ can hang inside a single native RegExp call with no way to interrupt it
 * mid-exec (no worker, no signal). apply.ts therefore never runs a pattern this module rejects -
 * refusing before the call is the only "clean timeout" a synchronous engine can offer.
 */
import type { RegexRule } from "../../entities/regex/schema";
import type { Span } from "./ast/ast-types";
import { jsFlagsForRule } from "./ast/dialect";
import { parseRegex } from "./ast/parser";
import { analyzeRedos } from "./ast/redos";

export const MAX_PATTERN_LENGTH = 10_000;
export const MAX_REPLACEMENT_LENGTH = 10_000;
export const COMPLEXITY_HARD_CAP = 50;

/** A group ending in +/* that itself contains a +/* quantifier: the classic ReDoS shape ((a+)+). */
const NESTED_QUANTIFIER = /\([^()]*[+*][^()]*\)[+*]/;

export interface RuleValidation {
  ok: boolean;
  error?: string;
  complexity: number;
  /** exact character range of the dangerous construct, when the AST analysis found one (R2X) */
  culprit?: Span;
}

function estimateComplexity(pattern: string): number {
  let score = 0;
  if (NESTED_QUANTIFIER.test(pattern)) score += 50;
  const backrefs = (pattern.match(/\\[0-9]/g) ?? []).length;
  score += backrefs * 10;
  const alternations = (pattern.match(/\|/g) ?? []).length;
  score += alternations * 2;
  const quantifiers = (pattern.match(/[+*?]|\{[0-9,]+\}/g) ?? []).length;
  score += quantifiers * 3;
  const lookarounds = (pattern.match(/\(\?[=!<]/g) ?? []).length;
  score += lookarounds * 5;
  score += Math.floor(pattern.length / 50);
  return score;
}

/**
 * Pattern-only safety vet for UNTRUSTED regexes compiled OUTSIDE the rule engine (lorebook
 * regex keys ride imported books straight onto the render thread). Same discipline as
 * validateRule minus the rule plumbing: length cap, AST ReDoS analysis when the pattern parses,
 * the complexity heuristic when the u-mode parser refuses it. Fail closed: a dangerous or
 * over-budget pattern comes back false and the caller must refuse to run it - refusing before
 * the call is the only clean timeout a synchronous engine has.
 */
export function vetPattern(pattern: string): boolean {
  if (!pattern.trim() || pattern.length > MAX_PATTERN_LENGTH) return false;
  const parsed = parseRegex(pattern);
  if ("ast" in parsed) return analyzeRedos(parsed.ast).severity !== "dangerous";
  return estimateComplexity(pattern) < COMPLEXITY_HARD_CAP;
}

/**
 * Validate a rule's find pattern and replacement BEFORE the engine ever compiles or runs them.
 * Never throws: syntax errors and dangerous shapes both come back as `{ ok: false, error }`.
 */
export function validateRule(rule: RegexRule): RuleValidation {
  const pattern = rule.find;
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      ok: false,
      error: `regex/validate: pattern exceeds ${MAX_PATTERN_LENGTH} characters`,
      complexity: 0,
    };
  }
  if (!pattern.trim()) {
    return { ok: false, error: "regex/validate: pattern is empty", complexity: 0 };
  }
  if ((rule.replace ?? "").length > MAX_REPLACEMENT_LENGTH) {
    return {
      ok: false,
      error: `regex/validate: replacement exceeds ${MAX_REPLACEMENT_LENGTH} characters`,
      complexity: 0,
    };
  }

  try {
    // Compile under the SAME flags apply.ts will use (one shared derivation): a pattern's validity
    // depends on its flags, so a flagless compile here let u-only syntax errors through to runtime.
    new RegExp(pattern, jsFlagsForRule(rule));
  } catch (err) {
    return {
      ok: false,
      error: `regex/validate: invalid pattern - ${err instanceof Error ? err.message : String(err)}`,
      complexity: estimateComplexity(pattern),
    };
  }

  // R2X: real static analysis on the AST when the pattern parses (nested unbounded quantifiers,
  // overlapping alternation under a star, quantified backreferences - with the culprit's exact
  // span). The regex heuristic below remains the fallback for patterns our u-mode parser refuses
  // (Annex-B legacy forms that the host engine still compiles).
  const parsed = parseRegex(pattern); // pattern-only analysis; flags don't change ReDoS shape
  if ("ast" in parsed) {
    const report = analyzeRedos(parsed.ast);
    const worst = report.findings[0];
    if (report.severity === "dangerous") {
      return {
        ok: false,
        error: "regex/validate: pattern has nested quantifiers that risk catastrophic backtracking",
        complexity: COMPLEXITY_HARD_CAP,
        ...(worst ? { culprit: worst.culpritSpan } : {}),
      };
    }
    const complexity = report.severity === "suspicious"
      ? Math.max(estimateComplexity(pattern), COMPLEXITY_HARD_CAP - 10)
      : estimateComplexity(pattern);
    return {
      ok: true,
      complexity,
      ...(worst ? { culprit: worst.culpritSpan } : {}),
    };
  }

  const complexity = estimateComplexity(pattern);
  if (complexity >= COMPLEXITY_HARD_CAP) {
    return {
      ok: false,
      error: "regex/validate: pattern has nested quantifiers that risk catastrophic backtracking",
      complexity,
    };
  }

  return { ok: true, complexity };
}
