/**
 * Regex set linter (REGEX-JEWEL-PLAN.md R4, QOL 5/10/17) - the lore inspect pattern: pure
 * body -> findings, optional fixes are pure body -> body. Six checks:
 *
 *   broken-pattern  - validateRule refused it (syntax, empty, catastrophic backtracking)
 *   slow-pattern    - complexity in the warn band below validate's hard cap (the "slow" chip)
 *   no-phase        - phases: [] runs at no point in the pipeline (the Risu omitted-type honesty:
 *                     we never invent a phase on import, so the linter says it out loud instead)
 *   never-matches   - impossible anchors: required text after a line-END anchor or before a
 *                     line-START anchor in the same sequence (skipped under the m flag, where a
 *                     line boundary can legitimately sit mid-text)
 *   duplicate-rule  - same find/flags/replace/phases as an earlier enabled rule; fix-as-data
 *                     (disable the later copy) per the plan - reordering is never auto-fixed
 *   shadowed        - QOL 10, ENGINE-PROVEN: generate execution-verified examples for the rule's
 *                     own pattern, run the real chain over each, and flag the rule only when it
 *                     never fires on its own examples in ANY of its phases while an earlier rule
 *                     did fire. No static guessing: if examples cannot be generated or the run is
 *                     indeterminate (skips/timeouts), there is NO finding (a detector returns
 *                     nothing on bad input, never a false alarm).
 *
 * Purity: deterministic (seeded rng derived from the pattern), no IO, no clock dependence in
 * results (engine timings are bounded but never surfaced as findings here).
 */
import type { RegexPhase, RegexRule, RegexSetBody } from "../../entities/regex/schema";
import { validateRule } from "./validate";
import { applyRules } from "./apply";
import { parseRegex } from "./ast/parser";
import { parseFlagTokens } from "./ast/dialect";
import { examplesFor } from "./ast/examples";
import type { Alternation, Node } from "./ast/ast-types";
import { mulberry32 } from "../lore/rng";

export type RegexFindingRule =
  | "broken-pattern"
  | "slow-pattern"
  | "no-phase"
  | "never-matches"
  | "duplicate-rule"
  | "shadowed";

export interface RegexFinding {
  rule: RegexFindingRule;
  severity: "problem" | "worth-a-look";
  /** Absent = set-level finding (none today; kept for shape parity with lore). */
  ruleId?: string;
  /** The other rule involved (the earlier duplicate, the rule doing the shadowing). */
  relatedRuleId?: string;
  /** Plain language, no jargon. */
  message: string;
  /** Present = safe to apply as data (Fix eligible). */
  fix?: (body: RegexSetBody) => RegexSetBody;
}

/** Below validate's hard refusal (50) but heavy enough to drag on long chats: the chip band. */
export const SLOW_COMPLEXITY = 20;

/** Probes per rule for the shadowing run; small and bounded - this runs at author time. */
const SHADOW_PROBES = 3;

/** Engine budgets for the shadowing runs. Injectable because a loaded machine can blow a tight
 *  budget, which honestly reads as indeterminate (no finding) - tests pass generous values so the
 *  verdict is deterministic under any load. */
export interface InspectOptions {
  timeoutMs?: number;
  setBudgetMs?: number;
}
const DEFAULT_TIMEOUT_MS = 25;
const DEFAULT_SET_BUDGET_MS = 250;

const label = (r: RegexRule): string => (r.label ? `"${r.label}"` : "an unnamed rule");

// ---------------------------------------------------------------------------------------------
// minimum match width (for the impossible-anchor walk)
// ---------------------------------------------------------------------------------------------

function minWidth(node: Node): number {
  switch (node.type) {
    case "alternation":
      return node.alternatives.length === 0
        ? 0
        : Math.min(...node.alternatives.map(minWidth));
    case "sequence":
      return node.elements.reduce((sum, el) => sum + minWidth(el), 0);
    case "quantifier":
      return node.min * minWidth(node.body);
    case "group":
      return minWidth(node.body);
    case "literal":
      return node.value.length;
    case "dot":
    case "char-class":
    case "class-escape":
    case "unicode-property":
      return 1;
    case "anchor":
    case "lookaround":
    case "backreference": // \1 can legally match empty
      return 0;
  }
}

/** True when matching `node` always finishes AT a line-end anchor - so any required text after it
 *  is unreachable. Propagates through groups, min>=1 quantifiers, and all-branches alternations,
 *  and skips trailing zero-width elements inside sequences. */
function endsAtLineEnd(node: Node): boolean {
  switch (node.type) {
    case "anchor":
      return node.kind === "line-end";
    case "group":
      return endsAtLineEnd(node.body);
    case "quantifier":
      return node.min >= 1 && endsAtLineEnd(node.body);
    case "alternation":
      return node.alternatives.length > 0 && node.alternatives.every(endsAtLineEnd);
    case "sequence": {
      for (let i = node.elements.length - 1; i >= 0; i--) {
        const el = node.elements[i]!;
        if (endsAtLineEnd(el)) return true;
        if (minWidth(el) > 0) return false;
      }
      return false;
    }
    default:
      return false;
  }
}

/** True if any sequence in the AST demands text after a line-end anchor or before a line-start
 *  anchor - unmatchable without the m flag. Recurses through containers; lookaround bodies are
 *  their own little worlds (zero-width) and are walked independently. */
function hasImpossibleAnchor(root: Alternation): boolean {
  const sequences: Node[][] = [];
  const collect = (node: Node): void => {
    switch (node.type) {
      case "alternation":
        node.alternatives.forEach(collect);
        return;
      case "sequence":
        sequences.push(node.elements);
        node.elements.forEach(collect);
        return;
      case "quantifier":
        collect(node.body);
        return;
      case "group":
      case "lookaround":
        collect(node.body);
        return;
      default:
        return;
    }
  };
  collect(root);

  for (const elements of sequences) {
    let sawEnd = false;
    for (const el of elements) {
      if (el.type === "anchor" && el.kind === "line-start") {
        // required text BEFORE ^ in this sequence?
        const before = elements.slice(0, elements.indexOf(el));
        if (before.reduce((s, b) => s + minWidth(b), 0) > 0) return true;
        continue;
      }
      if (sawEnd && minWidth(el) > 0) return true;
      if (endsAtLineEnd(el)) sawEnd = true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// the shadowing run (QOL 10)
// ---------------------------------------------------------------------------------------------

/** Deterministic seed from the pattern text (same idea as the guided mode's seeded examples). */
const seedFrom = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Execution-verified probe texts for a rule's own pattern, or [] when none can be generated. */
function probesFor(rule: RegexRule, ast: Alternation): string[] {
  const { jsFlags } = parseFlagTokens(rule.flags);
  const result = examplesFor(ast, {
    rng: mulberry32(seedFrom(rule.find)),
    count: SHADOW_PROBES,
    flags: jsFlags || undefined,
  });
  return result.matches.slice(0, SHADOW_PROBES);
}

interface ShadowVerdict {
  shadowed: boolean;
  byRuleId?: string;
}

/**
 * Is `target` shadowed? True only when, for EVERY phase it runs in and EVERY probe, the chain up
 * to and including it leaves it unfired while an earlier rule fired. Any indeterminate probe
 * (target skipped by depth/timeout/budget) vetoes the finding - never guess.
 */
function shadowVerdict(
  rules: readonly RegexRule[],
  targetIndex: number,
  probes: readonly string[],
  opts: InspectOptions,
): ShadowVerdict {
  const target = rules[targetIndex]!;
  const chain = rules.slice(0, targetIndex + 1).filter((r) => r.enabled);
  const culprits = new Map<string, number>();

  for (const phase of target.phases) {
    for (const probe of probes) {
      const run = applyRules(probe, chain, {
        phase: phase as RegexPhase,
        depth: 0,
        timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        setBudgetMs: opts.setBudgetMs ?? DEFAULT_SET_BUDGET_MS,
      });
      const mine = run.traces.find((t) => t.ruleId === target.id);
      if (!mine || mine.skipReason) return { shadowed: false }; // indeterminate - no finding
      if (mine.matchCount > 0) return { shadowed: false }; // fired at least once - healthy
      const earlier = run.traces.find(
        (t) => t.ruleId !== target.id && t.applied && t.matchCount > 0,
      );
      if (!earlier) return { shadowed: false }; // nothing ate it; the generator just missed
      culprits.set(earlier.ruleId, (culprits.get(earlier.ruleId) ?? 0) + 1);
    }
  }

  const top = [...culprits.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? { shadowed: true, byRuleId: top[0] } : { shadowed: false };
}

// ---------------------------------------------------------------------------------------------
// the linter
// ---------------------------------------------------------------------------------------------

const disableRule = (ruleId: string) => (body: RegexSetBody): RegexSetBody => ({
  ...body,
  rules: body.rules.map((r) => (r.id === ruleId ? { ...r, enabled: false } : r)),
});

const duplicateKey = (r: RegexRule): string =>
  [r.find, parseFlagTokens(r.flags).jsFlags, r.replace, [...r.phases].sort().join(",")].join(" ");

/** Inspect a set. Flat list in check-priority order; disabled rules are left in peace. */
export function inspectSet(body: RegexSetBody, opts: InspectOptions = {}): RegexFinding[] {
  const findings: RegexFinding[] = [];
  const enabled = body.rules.filter((r) => r.enabled);

  const seenKeys = new Map<string, RegexRule>();
  for (const rule of enabled) {
    const v = validateRule(rule);
    if (!v.ok) {
      findings.push({
        rule: "broken-pattern",
        severity: "problem",
        ruleId: rule.id,
        message: `${label(rule)} cannot run: ${v.error ?? "the pattern is not valid"}.`,
      });
      continue; // downstream checks need a runnable pattern
    }
    if (v.complexity >= SLOW_COMPLEXITY) {
      findings.push({
        rule: "slow-pattern",
        severity: "worth-a-look",
        ruleId: rule.id,
        message: `${label(rule)} is a heavy pattern and may be slow on long texts.`,
      });
    }

    if (rule.phases.length === 0) {
      findings.push({
        rule: "no-phase",
        severity: "problem",
        ruleId: rule.id,
        message: `${label(rule)} runs at no point - pick where it runs, or it will never do anything.`,
      });
    }

    const { jsFlags } = parseFlagTokens(rule.flags);
    if (!jsFlags.includes("m")) {
      const parsed = parseRegex(rule.find, "");
      if ("ast" in parsed && hasImpossibleAnchor(parsed.ast)) {
        findings.push({
          rule: "never-matches",
          severity: "problem",
          ruleId: rule.id,
          message: `${label(rule)} demands text beyond a line edge (^ or $), so it can never match.`,
        });
      }
    }

    const key = duplicateKey(rule);
    const first = seenKeys.get(key);
    if (first) {
      findings.push({
        rule: "duplicate-rule",
        severity: "worth-a-look",
        ruleId: rule.id,
        relatedRuleId: first.id,
        message: `${label(rule)} does exactly what ${label(first)} already does. Safe fix: switch this copy off.`,
        fix: disableRule(rule.id),
      });
    } else {
      seenKeys.set(key, rule);
    }
  }

  // Shadowing last: it is the expensive check and needs the cheap ones' survivors. A perfect
  // duplicate is by construction also shadowed - the duplicate finding subsumes it (and carries
  // the safe fix), so dup-flagged rules are excluded rather than reported twice.
  const broken = new Set(
    findings
      .filter((f) => f.severity === "problem" || f.rule === "duplicate-rule")
      .map((f) => f.ruleId),
  );
  body.rules.forEach((rule, index) => {
    if (!rule.enabled || broken.has(rule.id)) return;
    if (index === 0 || rule.phases.length === 0) return;
    if (rule.overlay === true || rule.condition) return; // gated rules are gated on purpose
    const parsed = parseRegex(rule.find, "");
    if (!("ast" in parsed)) return;
    const probes = probesFor(rule, parsed.ast);
    if (probes.length === 0) return;
    const verdict = shadowVerdict(body.rules, index, probes, opts);
    if (!verdict.shadowed) return;
    const culprit = body.rules.find((r) => r.id === verdict.byRuleId);
    findings.push({
      rule: "shadowed",
      severity: "worth-a-look",
      ruleId: rule.id,
      relatedRuleId: verdict.byRuleId,
      message:
        `${label(rule)} never fires on its own examples - ${culprit ? label(culprit) : "an earlier rule"} ` +
        `runs first and changes the text. Reordering is a judgment call, so fix this one by hand.`,
    });
  });

  return findings;
}

/** Findings for one rule (the editor's per-rule Health card). */
export const findingsForRule = (findings: readonly RegexFinding[], ruleId: string): RegexFinding[] =>
  findings.filter((f) => f.ruleId === ruleId);

/** Rule ids wearing the slow chip (TOC rows, shelf count). */
export const slowRuleIds = (findings: readonly RegexFinding[]): string[] =>
  findings.filter((f) => f.rule === "slow-pattern" && f.ruleId).map((f) => f.ruleId!);

/**
 * Cheap slow-rule count for LIST surfaces (the shelf chip): complexity check only, no parsing
 * walks and no engine runs - the Library meta loader calls this once per set on every listing.
 * The full inspectSet (with the shadowing runs) is the editor's, where one set is in focus.
 */
export function slowRuleCount(body: RegexSetBody): number {
  let count = 0;
  for (const rule of body.rules) {
    if (!rule.enabled) continue;
    const v = validateRule(rule);
    if (v.ok && v.complexity >= SLOW_COMPLEXITY) count += 1;
  }
  return count;
}
