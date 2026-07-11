/**
 * The budgeted regex engine (REGEX-JEWEL-PLAN.md Phase R2). Pure core: no eval, no I/O, no
 * Date/Math.random - the clock is injected and defaults to performance.now only at the public
 * entry point (the imperative edge). Transcribes the discipline of RoleCall's
 * apps/rc/src/lib/regex/engine.ts (validate-before-run, per-rule timeout + match cap, full
 * per-rule trace) into vaud's canonical RegexRule shape.
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
   * Injected monotonic clock; defaults to performance.now here at the imperative edge (not exposed
   * further down). Tests inject a fake clock to make timeout behavior deterministic. Deviation from
   * the plan's literal RegexRunOptions shape (which omitted `now`) - required by algorithm step 5's
   * "elapsed via injected now, never Date/random inside" rule; noted per the reality-wins clause.
   */
  now?: () => number;
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
}

export interface RegexRunResult {
  text: string;
  traces: RuleTrace[];
}

const JS_FLAG_CHARS = new Set(["g", "i", "m", "s", "u", "y", "d"]);

/** Strip Risu extension tokens (observed live: "gu<cbs>") and keep only valid, deduped JS flags. */
function compileFlags(rawFlags: string): string {
  const stripped = rawFlags.replace(/<[^>]*>/g, "");
  const seen = new Set<string>();
  for (const c of stripped) {
    if (JS_FLAG_CHARS.has(c)) seen.add(c);
  }
  return [...seen].join("");
}

function escapeRegexChars(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Substitute {{key}} tokens from a flat macro map; case-insensitive, escaping values on request. */
function substituteMacros(
  text: string,
  macros: Record<string, string> | undefined,
  escapeValues: boolean,
): string {
  if (!macros) return text;
  let out = text;
  for (const [key, value] of Object.entries(macros)) {
    const token = new RegExp(`\\{\\{${escapeRegexChars(key)}\\}\\}`, "gi");
    const replacement = escapeValues ? escapeRegexChars(value) : value;
    out = out.replace(token, () => replacement);
  }
  return out;
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

/** Strip every occurrence of every trim fragment from a captured value (RC's applyTrimStrings). */
function applyTrim(value: string, trimStrings: readonly string[]): string {
  let out = value;
  for (const t of trimStrings) {
    if (t) out = out.split(t).join("");
  }
  return out;
}

/**
 * Substitute $&, $<name>, $N, $$ tokens in a replacement template for one match, applying
 * trimStrings to each substituted value (never to literal template text). Single-pass token scan
 * so substituted content is never re-scanned for further tokens.
 */
function substituteTokens(
  template: string,
  m: RegExpMatchArray,
  trimStrings: readonly string[],
): string {
  const trimmedMatch = applyTrim(m[0], trimStrings);
  const TOKEN = /\$(?:\$|&|<([^>]*)>|(\d+))/g;
  let out = "";
  let lastIndex = 0;
  for (let match = TOKEN.exec(template); match !== null; match = TOKEN.exec(template)) {
    out += template.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
    if (match[0] === "$$") {
      out += "$";
    } else if (match[0] === "$&") {
      out += trimmedMatch;
    } else if (match[1] !== undefined) {
      const value = m.groups?.[match[1]];
      out += typeof value === "string" ? applyTrim(value, trimStrings) : "";
    } else if (match[2] !== undefined) {
      const n = Number(match[2]);
      const value = n >= 1 && n < m.length ? m[n] : undefined;
      out += typeof value === "string" ? applyTrim(value, trimStrings) : "";
    }
  }
  out += template.slice(lastIndex);
  return out;
}

/**
 * Run one compiled regex against text: find every match (time/count-guarded), then rebuild the
 * string end-to-start so earlier indices stay valid.
 */
function runReplace(
  regex: RegExp,
  text: string,
  replaceRaw: string,
  trimStrings: readonly string[],
  timeoutMs: number,
  maxMatches: number,
  now: () => number,
): { result: string; matchCount: number; error?: string } {
  // "$$&" -> literal "$&" in the output string (native String.replace would otherwise interpret
  // a bare "$&" replacement as "insert the match", producing "{{match}}" again).
  const template = replaceRaw.replace(/\{\{match\}\}/gi, "$$&");
  const start = now();

  let matches: RegExpMatchArray[];
  try {
    matches = findMatches(regex, text);
  } catch (err) {
    return { result: text, matchCount: 0, error: `regex/apply: ${msg(err)}` };
  }
  if (matches.length === 0) return { result: text, matchCount: 0 };
  if (matches.length > maxMatches) {
    return {
      result: text,
      matchCount: matches.length,
      error: `regex/apply: matched more than ${maxMatches} times`,
    };
  }
  if (now() - start > timeoutMs) {
    return {
      result: text,
      matchCount: matches.length,
      error: `regex/apply: timed out after ${timeoutMs}ms`,
    };
  }

  let result = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (now() - start > timeoutMs) {
      return {
        result: text,
        matchCount: matches.length,
        error: `regex/apply: timed out after ${timeoutMs}ms`,
      };
    }
    const m = matches[i];
    if (!m) continue;
    const idx = m.index ?? 0;
    const replacement = substituteTokens(template, m, trimStrings);
    result = result.slice(0, idx) + replacement + result.slice(idx + m[0].length);
  }
  return { result, matchCount: matches.length };
}

function applyRule(text: string, rule: RegexRule, opts: RegexRunOptions, now: () => number): RuleTrace {
  const start = now();

  const skip = skipReasonFor(rule, opts);
  if (skip) {
    return { ruleId: rule.id, applied: false, skipReason: skip, matchCount: 0, elapsedMs: 0, before: text, after: text };
  }

  const validation = validateRule(rule);
  if (!validation.ok) {
    return {
      ruleId: rule.id,
      applied: false,
      matchCount: 0,
      elapsedMs: now() - start,
      error: validation.error,
      before: text,
      after: text,
    };
  }

  const substituteMode: RegexSubstitution = rule.substituteFind ?? "none";
  let findPattern = rule.find;
  if (substituteMode === "raw") {
    findPattern = substituteMacros(findPattern, opts.macros, false);
  } else if (substituteMode === "escaped") {
    findPattern = substituteMacros(findPattern, opts.macros, true);
  }
  // "none" and "after" leave the find pattern untouched: "after" resolves macros on the OUTPUT
  // of the replace instead (Lumiverse regex-scripts.service.ts residual, see REGEX-JEWEL-PLAN.md).

  const flags = rule.useFlags ? compileFlags(rule.flags || "g") || "g" : "g";
  let regex: RegExp;
  try {
    regex = new RegExp(findPattern, flags);
  } catch (err) {
    return {
      ruleId: rule.id,
      applied: false,
      matchCount: 0,
      elapsedMs: now() - start,
      error: `regex/apply: invalid pattern - ${msg(err)}`,
      before: text,
      after: text,
    };
  }

  const timeoutMs = Math.min(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const maxMatches = opts.maxMatches ?? DEFAULT_MAX_MATCHES;
  const trimStrings = rule.trimStrings ?? [];

  const runResult = runReplace(regex, text, rule.replace, trimStrings, timeoutMs, maxMatches, now);
  if (runResult.error) {
    return {
      ruleId: rule.id,
      applied: false,
      matchCount: runResult.matchCount,
      elapsedMs: now() - start,
      error: runResult.error,
      before: text,
      after: text,
    };
  }

  // "after" mode: macros resolve on the WHOLE post-replacement text, never on the find pattern
  // and never per-match - a single global pass over the finished substitution.
  const after = substituteMode === "after" ? substituteMacros(runResult.result, opts.macros, false) : runResult.result;

  return {
    ruleId: rule.id,
    applied: true,
    matchCount: runResult.matchCount,
    elapsedMs: now() - start,
    before: text,
    after,
  };
}

/**
 * Apply an ordered rule set to text. Every input rule gets exactly one trace, in sortOrder.
 * Pure: no clock/random inside except the injected `now` (defaults to performance.now here, the
 * one imperative edge in this module).
 */
export function applyRules(
  text: string,
  rules: readonly RegexRule[],
  opts: RegexRunOptions,
): RegexRunResult {
  const now = opts.now ?? (() => performance.now());
  const ordered = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  const traces: RuleTrace[] = [];
  let current = text;
  for (const rule of ordered) {
    const trace = applyRule(current, rule, opts, now);
    traces.push(trace);
    if (trace.applied) current = trace.after;
  }
  return { text: current, traces };
}

export { validateRule } from "./validate";
export type { RuleValidation } from "./validate";
