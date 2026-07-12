/**
 * Pure logic for the regex test bench (design/vs-regex-tryit.html): the word-level diff that draws
 * each applied step, the per-rule "before/after against your sample" for the import preview, the
 * plain-language skip reasons, and the fresh-id/sortOrder staging that appends imported rules into
 * the open set. No React, no CSS, no IO - the bench-pane / bench-import components render these and
 * the chain itself runs through the budgeted engine (core/regex/apply.ts), never a second matcher.
 */
import type { RegexPhase, RegexRule } from "../../../../entities/regex/schema";
import { applyRules } from "../../../../core/regex";
import { newUiId } from "../../../_shared/new-id";

/** The phase select in the sample card, mapped to the engine's phase vocabulary (naive-user words). */
export interface ChainPhaseOption {
  label: string;
  phase: RegexPhase;
}

export const CHAIN_PHASES: readonly ChainPhaseOption[] = [
  { label: "Model output", phase: "output" },
  { label: "User input", phase: "input" },
  { label: "Display", phase: "display" },
  { label: "Prompt", phase: "prompt" },
];

/** Friendly label for a raw phase key (for the "runs on X only" skip line). */
export function phaseLabel(phase: RegexPhase): string {
  const known = CHAIN_PHASES.find((p) => p.phase === phase);
  if (known) return known.label;
  return String(phase);
}

// -- word-level diff (whitespace-token LCS, the house granularity from core/lore/diff.ts) ----------

export type DiffKind = "same" | "del" | "ins";
export interface DiffToken {
  text: string;
  kind: DiffKind;
}

/** Split into alternating whitespace / non-whitespace runs so a rejoin reproduces the text exactly. */
const tokenize = (s: string): string[] => s.match(/\s+|\S+/g) ?? [];

/** Merge neighbouring same-kind tokens so the render emits one span per run, not one per word. */
function coalesce(tokens: readonly DiffToken[]): DiffToken[] {
  const out: DiffToken[] = [];
  for (const t of tokens) {
    const last = out.at(-1);
    if (last && last.kind === t.kind) last.text += t.text;
    else out.push({ ...t });
  }
  return out;
}

/**
 * Ordered before/after diff over whitespace tokens (classic LCS backtrack). Common runs render
 * plain, removed runs strike (del), added runs highlight (ins) - the chain step body. Reused by the
 * import preview only for effect detection (matched vs no change), never for its own render.
 */
export function diffTokens(before: string, after: string): DiffToken[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        a[i] === b[j] ? (dp[i + 1]![j + 1] ?? 0) + 1 : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }
  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ text: a[i]!, kind: "same" });
      i += 1;
      j += 1;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      out.push({ text: a[i]!, kind: "del" });
      i += 1;
    } else {
      out.push({ text: b[j]!, kind: "ins" });
      j += 1;
    }
  }
  while (i < n) {
    out.push({ text: a[i]!, kind: "del" });
    i += 1;
  }
  while (j < m) {
    out.push({ text: b[j]!, kind: "ins" });
    j += 1;
  }
  return coalesce(out);
}

// -- per-rule effect (import preview: this rule alone against your sample) --------------------------

export interface RuleEffect {
  before: string;
  after: string;
  matched: boolean;
  error?: string;
}

/**
 * Run ONE rule in isolation against the sample, forced on and in its own first phase, so the import
 * preview shows what it would do regardless of the run phase. Drops cross-rule condition + overlay so
 * a previewed rule produces its concrete replacement. Never throws - a bad pattern returns as error.
 */
export function perRuleEffect(sample: string, rule: RegexRule): RuleEffect {
  const phase = rule.phases[0] ?? "input";
  const solo: RegexRule = { ...rule, enabled: true, phases: [phase], condition: undefined, overlay: false };
  const trace = applyRules(sample, [solo], { phase }).traces[0];
  if (!trace) return { before: sample, after: sample, matched: false };
  if (trace.error) return { before: sample, after: sample, matched: false, error: trace.error };
  return { before: trace.before, after: trace.after, matched: trace.matchCount > 0 };
}

// -- staged import (append picked rules into the open set with fresh ids + increasing sortOrder) ----

/**
 * Clone the picked imported rules with a brand-new id each and a strictly increasing sortOrder past
 * the set's current tail, so appending never collides an id or ties an order. Pure: the caller writes
 * nothing until the Import button hands these to a session op.
 */
export function stageRules(
  picked: readonly RegexRule[],
  existing: readonly RegexRule[],
): RegexRule[] {
  const tail = existing.at(-1)?.sortOrder ?? 0;
  return picked.map((rule, i) => ({
    ...structuredClone(rule),
    id: newUiId("rule_"),
    sortOrder: tail + 10 * (i + 1),
  }));
}

// -- plain-language skip reasons (the chain's skipped steps) ----------------------------------------

export interface SkipContext {
  rulePhases: readonly RegexPhase[];
  currentPhaseLabel: string;
}

/** Turn an engine skipReason into a naive-user line, no jargon. */
export function skipReasonText(skip: string, ctx: SkipContext): string {
  switch (skip) {
    case "disabled":
      return "rule is off";
    case "phase": {
      const runs = ctx.rulePhases.map(phaseLabel).join(", ");
      return runs ? `runs on ${runs} only, this is ${ctx.currentPhaseLabel}` : `not for ${ctx.currentPhaseLabel}`;
    }
    case "target":
      return "a different target channel than this run";
    case "min-depth":
      return "below its message-depth window";
    case "max-depth":
      return "above its message-depth window";
    case "not-run-on-edit":
      return "only runs when a message is edited";
    case "condition":
      return "the rule it waits on did not fire this pass";
    case "set-budget":
      return "the whole set ran out of its time budget";
    default:
      return "skipped";
  }
}

/** A capture group's colour lane (cycled 1..4); the CSS module owns the actual token per lane. */
export const captureLane = (groupIndex: number): 1 | 2 | 3 | 4 =>
  ((groupIndex % 4) + 1) as 1 | 2 | 3 | 4;
