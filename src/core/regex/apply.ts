/**
 * The budgeted regex engine (REGEX-JEWEL-PLAN.md Phase R2 + R2X extensions). Pure core: no eval, no
 * I/O, no Date/Math.random - the clock is injected and defaults to performance.now only at the public
 * entry point (the imperative edge). Transcribes the discipline of RoleCall's
 * apps/rc/src/lib/regex/engine.ts (validate-before-run, per-rule timeout + match cap, full
 * per-rule trace) into vaud's canonical RegexRule shape.
 *
 * R2X delegation: the replacement grammar lives once in replace-ops.ts (expandReplacement +
 * substituteFindMacros/substituteAfterMacros) and the flags split lives once in ast/dialect.ts
 * (parseFlagTokens). This module orchestrates - filter, compile, run, trace - and owns none of that
 * logic anymore. Traces now carry per-match d-flag index spans (whole match + numbered capture
 * groups) for editor highlighting, and a rule may request first-match-only replacement.
 *
 * A rule is DATA: applying one is String.replace, never eval. Rendering `replace` output (which
 * may carry HTML/CBS) happens elsewhere, only through SealedHtmlPreview.
 */
import type {
  RegexPhase,
  RegexRule,
  RegexSubstitution,
  RegexTargetChannel,
} from "../../entities/regex/schema";
import type { Span } from "./ast/ast-types";
import { jsFlagsForRule } from "./ast/dialect";
import { expandReplacement, substituteAfterMacros, substituteFindMacros } from "./replace-ops";
import { validateRule } from "./validate";

export const DEFAULT_TIMEOUT_MS = 100;
export const MAX_TIMEOUT_MS = 500;
export const DEFAULT_MAX_MATCHES = 1000;

export interface RegexRunOptions {
  phase: RegexPhase;
  target?: RegexTargetChannel;
  depth?: number;
  isEdit?: boolean;
  /** flat token map for substituteFind ({{key}} -> value); injected, engine stays pure */
  macros?: Record<string, string>;
  timeoutMs?: number;
  maxMatches?: number;
  /**
   * SET-level time budget across the whole rule list, on top of per-rule timeouts (R2X). When the
   * budget is spent, every remaining rule gets an honest "set-budget" skip trace - never a silent
   * truncation.
   */
  setBudgetMs?: number;
  /**
   * Injected monotonic clock; defaults to performance.now here at the imperative edge (not exposed
   * further down). Tests inject a fake clock to make timeout behavior deterministic. Deviation from
   * the plan's literal RegexRunOptions shape (which omitted `now`) - required by algorithm step 5's
   * "elapsed via injected now, never Date/random inside" rule; noted per the reality-wins clause.
   */
  now?: () => number;
}

/**
 * One match's source spans, indexing into the trace's `before` text (the rule's input this pass).
 * `whole` is the full match; `groups` holds each numbered capture group in order (null when the
 * group did not participate). Populated from the d-flag `.indices` array so the editor can highlight
 * matches and colour capture groups without re-running the pattern.
 */
export interface TraceMatch {
  whole: Span;
  groups: (Span | null)[];
}

export interface RuleTrace {
  ruleId: string;
  applied: boolean;
  skipReason?: string;
  matchCount: number;
  elapsedMs: number;
  error?: string;
  before: string;
  after: string;
  /** per-match d-flag index spans into `before`; present when the rule was applied (may be empty). */
  matches?: TraceMatch[];
}

/**
 * One overlay rule's contribution (R2X): match spans + the replacement to draw over them, with the
 * text UNTOUCHED. Spans index the rule's trace `before` text (identical to `after` for overlays).
 * The display layer composes; the engine never mutates for overlay rules.
 */
export interface RuleOverlay {
  ruleId: string;
  replacement: string;
  matches: TraceMatch[];
}

export interface RegexRunResult {
  text: string;
  traces: RuleTrace[];
  /** overlay-rule contributions in application order (empty when no overlay rules applied) */
  overlays: RuleOverlay[];
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function skipReasonFor(rule: RegexRule, opts: RegexRunOptions): string | undefined {
  if (!rule.enabled) return "disabled";
  if (!rule.phases.includes(opts.phase)) return "phase";
  if (rule.targets && rule.targets.length > 0 && opts.target && !rule.targets.includes(opts.target)) {
    return "target";
  }
  if (opts.depth !== undefined) {
    if (rule.minDepth != null && opts.depth < rule.minDepth) return "min-depth";
    if (rule.maxDepth != null && opts.depth > rule.maxDepth) return "max-depth";
  }
  if (opts.isEdit && !rule.runOnEdit) return "not-run-on-edit";
  return undefined;
}

function findMatches(regex: RegExp, text: string): RegExpMatchArray[] {
  if (regex.global) return [...text.matchAll(regex)];
  const m = text.match(regex);
  return m ? [m] : [];
}

/** Read a match's d-flag `.indices` into whole-match + numbered-group spans (index into `before`). */
function traceMatchOf(m: RegExpMatchArray): TraceMatch {
  const indices = m.indices;
  const wholeIdx = indices?.[0];
  const whole: Span = wholeIdx
    ? { start: wholeIdx[0], end: wholeIdx[1] }
    : { start: m.index ?? 0, end: (m.index ?? 0) + (m[0]?.length ?? 0) };
  const groups: (Span | null)[] = [];
  if (indices) {
    for (let g = 1; g < indices.length; g++) {
      const gi = indices[g];
      groups.push(gi ? { start: gi[0], end: gi[1] } : null);
    }
  }
  return { whole, groups };
}

/**
 * Run one compiled regex against text: find every match (time/count-guarded), optionally keep only
 * the first, expand each replacement through replace-ops, then rebuild the string end-to-start so
 * earlier indices stay valid. Returns the per-match spans so the caller can attach them to the trace.
 */
function runReplace(
  regex: RegExp,
  text: string,
  replaceRaw: string,
  trimStrings: readonly string[],
  firstMatchOnly: boolean,
  timeoutMs: number,
  maxMatches: number,
  now: () => number,
): { result: string; matchCount: number; matches: TraceMatch[]; error?: string } {
  const start = now();

  let found: RegExpMatchArray[];
  try {
    found = findMatches(regex, text);
  } catch (err) {
    return { result: text, matchCount: 0, matches: [], error: `regex/apply: ${msg(err)}` };
  }
  const matches = firstMatchOnly ? found.slice(0, 1) : found;
  if (matches.length === 0) return { result: text, matchCount: 0, matches: [] };
  if (matches.length > maxMatches) {
    return {
      result: text,
      matchCount: matches.length,
      matches: [],
      error: `regex/apply: matched more than ${maxMatches} times`,
    };
  }
  if (now() - start > timeoutMs) {
    return {
      result: text,
      matchCount: matches.length,
      matches: [],
      error: `regex/apply: timed out after ${timeoutMs}ms`,
    };
  }

  const spans = matches.map(traceMatchOf);
  let result = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (now() - start > timeoutMs) {
      return {
        result: text,
        matchCount: matches.length,
        matches: [],
        error: `regex/apply: timed out after ${timeoutMs}ms`,
      };
    }
    const m = matches[i];
    if (!m) continue;
    const idx = m.index ?? 0;
    const replacement = expandReplacement(replaceRaw, m, { trimStrings });
    result = result.slice(0, idx) + replacement + result.slice(idx + m[0].length);
  }
  return { result, matchCount: matches.length, matches: spans };
}

function applyRule(
  text: string,
  rule: RegexRule,
  opts: RegexRunOptions,
  now: () => number,
): { trace: RuleTrace; overlay?: RuleOverlay } {
  const start = now();

  const skip = skipReasonFor(rule, opts);
  if (skip) {
    return { trace: { ruleId: rule.id, applied: false, skipReason: skip, matchCount: 0, elapsedMs: 0, before: text, after: text } };
  }

  const validation = validateRule(rule);
  if (!validation.ok) {
    return {
      trace: {
        ruleId: rule.id,
        applied: false,
        matchCount: 0,
        elapsedMs: now() - start,
        error: validation.error,
        before: text,
        after: text,
      },
    };
  }

  const substituteMode: RegexSubstitution = rule.substituteFind ?? "none";
  const findPattern = substituteFindMacros(rule.find, substituteMode, opts.macros);
  // "none" and "after" leave the find pattern untouched: "after" resolves macros on the OUTPUT of
  // the replace instead (Lumiverse regex-scripts.service.ts residual, see REGEX-JEWEL-PLAN.md).

  // Flags: split Risu extension tokens (e.g. "gu<cbs>") from the clean JS flags via the shared
  // parseFlagTokens (one home in ast/dialect.ts). Always add "d" so matches carry index spans for
  // the trace - the d flag only annotates results, it never changes what matches.
  const jsFlags = jsFlagsForRule(rule);
  const flags = jsFlags.includes("d") ? jsFlags : `${jsFlags}d`;
  let regex: RegExp;
  try {
    regex = new RegExp(findPattern, flags);
  } catch (err) {
    return {
      trace: {
        ruleId: rule.id,
        applied: false,
        matchCount: 0,
        elapsedMs: now() - start,
        error: `regex/apply: invalid pattern - ${msg(err)}`,
        before: text,
        after: text,
      },
    };
  }

  const timeoutMs = Math.min(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const maxMatches = opts.maxMatches ?? DEFAULT_MAX_MATCHES;
  const trimStrings = rule.trimStrings ?? [];
  // First-class field first; the sealed `extras` spelling survives as an import fallback (rules
  // imported before the field existed keep working without a migration).
  const firstMatchOnly = rule.firstMatchOnly === true || rule.extras?.firstMatchOnly === true;

  const runResult = runReplace(
    regex,
    text,
    rule.replace,
    trimStrings,
    firstMatchOnly,
    timeoutMs,
    maxMatches,
    now,
  );
  if (runResult.error) {
    return {
      trace: {
        ruleId: rule.id,
        applied: false,
        matchCount: runResult.matchCount,
        elapsedMs: now() - start,
        error: runResult.error,
        before: text,
        after: text,
      },
    };
  }

  // Overlay rules (R2X): matching ran with the same guards, but the text passes through untouched -
  // spans + replacement return as an overlay for the display layer to compose.
  if (rule.overlay === true) {
    return {
      trace: {
        ruleId: rule.id,
        applied: true,
        matchCount: runResult.matchCount,
        elapsedMs: now() - start,
        before: text,
        after: text,
        matches: runResult.matches,
      },
      overlay:
        runResult.matchCount > 0
          ? { ruleId: rule.id, replacement: rule.replace, matches: runResult.matches }
          : undefined,
    };
  }

  // "after" mode: macros resolve on the WHOLE post-replacement text, never on the find pattern and
  // never per-match - a single global pass over the finished substitution.
  const after = substituteAfterMacros(runResult.result, substituteMode, opts.macros);

  return {
    trace: {
      ruleId: rule.id,
      applied: true,
      matchCount: runResult.matchCount,
      elapsedMs: now() - start,
      before: text,
      after,
      matches: runResult.matches,
    },
  };
}

/**
 * Apply an ordered rule set to text. Every input rule gets exactly one trace, in sortOrder.
 * Pure: no clock/random inside except the injected `now` (defaults to performance.now here, the
 * one imperative edge in this module).
 *
 * R2X semantics on top of the R2 loop:
 * - `condition` chaining is ONE deterministic pass: a rule's condition consults only rules that
 *   already ran; naming a later or unknown rule skips with "condition" (never forward-resolves).
 * - `setBudgetMs` exhaustion mid-list gives every remaining rule an honest "set-budget" skip.
 * - overlay rules contribute spans without mutating; their traces still count as applied.
 */
export function applyRules(
  text: string,
  rules: readonly RegexRule[],
  opts: RegexRunOptions,
): RegexRunResult {
  const now = opts.now ?? (() => performance.now());
  const ordered = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  const traces: RuleTrace[] = [];
  const overlays: RuleOverlay[] = [];
  const appliedById = new Map<string, boolean>();
  const setBudgetMs = opts.setBudgetMs;
  // Only touch the clock for budget bookkeeping when a budget exists - keeps injected-clock
  // tick sequences stable for budget-less runs (the R2 tests' fixtures).
  const setStart = setBudgetMs !== undefined ? now() : 0;
  let budgetSpent = false;
  let current = text;

  for (const rule of ordered) {
    if (!budgetSpent && setBudgetMs !== undefined && now() - setStart > setBudgetMs) {
      budgetSpent = true;
    }
    if (budgetSpent) {
      traces.push({
        ruleId: rule.id,
        applied: false,
        skipReason: "set-budget",
        matchCount: 0,
        elapsedMs: 0,
        before: current,
        after: current,
      });
      appliedById.set(rule.id, false);
      continue;
    }

    if (rule.condition) {
      const ran = appliedById.get(rule.condition.ruleId);
      // Unknown / not-yet-run reference counts as "did not match" and can never satisfy
      // matched:true; matched:false against an unknown rule is also skipped - a condition on a
      // rule that never ran is an authoring smell, not a green light.
      const satisfied = ran !== undefined && ran === rule.condition.matched;
      if (!satisfied) {
        traces.push({
          ruleId: rule.id,
          applied: false,
          skipReason: "condition",
          matchCount: 0,
          elapsedMs: 0,
          before: current,
          after: current,
        });
        appliedById.set(rule.id, false);
        continue;
      }
    }

    const { trace, overlay } = applyRule(current, rule, opts, now);
    traces.push(trace);
    // A rule "matched" for chaining purposes when it applied AND found something.
    appliedById.set(rule.id, trace.applied && trace.matchCount > 0);
    if (overlay) overlays.push(overlay);
    if (trace.applied) current = trace.after;
  }
  return { text: current, traces, overlays };
}

export { validateRule } from "./validate";
export type { RuleValidation } from "./validate";
