/**
 * Travel lint - "this rule won't behave the same on platform X" (REGEX-JEWEL-PLAN.md R2X, QOL 27).
 * The AST is single-dialect: every Write-for target executes JS RegExp, so travel honesty is a LINT,
 * not a parser fork. `travelLint(rule, profile)` walks the rule's find AST (for host-age pattern
 * risks) plus its replace-op and flag tokens (for replace/flag extensions the destination's engine
 * does not run) against the support table in platform-fields.ts, and returns plain-language notes
 * with exact spans. Nothing is blocked or mangled - the editor marks these under the active Write-for
 * lens (dashed amber, like foreign phases); export surfaces them in the summary.
 *
 * ENGINE TRUTH: the replace scanner mirrors core/regex/replace-ops.ts `expandReplacement`'s escape
 * rules EXACTLY (a "\\" consumes an escaped backslash, so "\\U" is a literal U and NOT a case token),
 * so a note fires iff the real engine would treat those characters as the named extension. The find
 * walk reads the parsed AST structurally, never a second regex over the pattern string.
 *
 * SAFETY: this is a read-only DATA lint. It never compiles or runs the rule; find is parsed to an AST
 * (parseRegex, which never throws) and an unparseable pattern simply yields no AST-derived notes.
 */
import { REGEX_WRITE_FOR_LABELS, type RegexWriteForProfile } from "./capabilities";
import {
  profileRunsReplaceFeature,
  type RegexEngineFeature,
} from "./platform-fields";
import { parseRegex, type Node, type Span } from "./ast";
import type { RegexRule } from "../../entities/regex/schema";

/** Why a note fires: the destination engine cannot run it, or it may break on an old install. */
export type TravelSeverity = "unsupported" | "host-age";

/** One travel-honesty note: a feature used by the rule that the destination lens handles differently. */
export interface TravelNote {
  feature: RegexEngineFeature;
  /** Which rule string the span indexes into; "rule" = a rule-level field with no string span. */
  field: "find" | "flags" | "replace" | "rule";
  /** Half-open [start, end) into that field's string; {0,0} for rule-level fields. */
  span: Span;
  severity: TravelSeverity;
  /** Plain-language sentence a naive reader follows cold; names the destination platform. */
  message: string;
}

/**
 * Notes for how `rule` will behave when written for `profile`. `full` is Hoplight, the home lens: a rule
 * never travels to itself, so there is nothing to warn about and the result is always empty.
 */
export function travelLint(rule: RegexRule, profile: RegexWriteForProfile): TravelNote[] {
  if (profile === "full") return [];
  const label = REGEX_WRITE_FOR_LABELS[profile];
  return [
    ...lintFind(rule.find, label),
    ...lintFlags(rule.flags, profile, label),
    ...lintReplace(rule.replace, profile, label),
    ...lintRuleFields(rule, label),
  ];
}

/**
 * Vaud-engine-only RULE FIELDS (R2X Part B: schema condition/overlay/firstMatchOnly). No string
 * span exists for these - the whole rule carries the behavior - so field is "rule" and the span
 * is {0,0}. Support table says only "full" runs them; this lints for every non-full profile.
 */
function lintRuleFields(rule: RegexRule, label: string): TravelNote[] {
  const zero: Span = { start: 0, end: 0 };
  const notes: TravelNote[] = [];
  if (rule.condition) {
    notes.push({
      feature: "conditional-chaining",
      field: "rule",
      span: zero,
      severity: "unsupported",
      message:
        `This rule only runs when another rule fires - that chaining exists only here; ` +
        `${label} will run it unconditionally.`,
    });
  }
  if (rule.overlay === true) {
    notes.push({
      feature: "overlay",
      field: "rule",
      span: zero,
      severity: "unsupported",
      message:
        `Overlay display (drawing over the text without changing it) exists only here; ` +
        `${label} will replace the text for real.`,
    });
  }
  if (rule.firstMatchOnly === true || rule.extras?.firstMatchOnly === true) {
    notes.push({
      feature: "first-match-only",
      field: "rule",
      span: zero,
      severity: "unsupported",
      message:
        `"First match only" exists only here; ${label} will replace every match.`,
    });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// find AST - host-age pattern risks (look-behind)
// ---------------------------------------------------------------------------

/**
 * Walk the find AST for pattern features risky on old installs. Parsed with no flags: the parser
 * targets the u-mode grammar regardless of flags, and passing none sidesteps the staged v-flag
 * early-return so a v-flag rule's look-behind is still walkable. Tolerant: an unparseable pattern
 * returns no notes (a detector returns [] on bad input, never throws).
 */
function lintFind(find: string, label: string): TravelNote[] {
  const parsed = parseRegex(find, "");
  if (!("ast" in parsed)) return [];
  const notes: TravelNote[] = [];
  for (const node of collectNodes(parsed.ast)) {
    if (node.type === "lookaround" && !node.ahead) {
      notes.push({
        feature: "lookbehind",
        field: "find",
        span: { start: node.start, end: node.end },
        severity: "host-age",
        message:
          `Look-behind (like "(?<=...)") is a newer regex feature; older ${label} installs may ` +
          "reject this whole rule.",
      });
    }
  }
  return notes;
}

/** Depth-first collect every node. Only structural containers recurse; leaves (and char-class bodies,
 *  which cannot hold a look-behind) are terminals - enough to find every look-behind at any depth. */
function collectNodes(root: Node): Node[] {
  const out: Node[] = [];
  const stack: Node[] = [root];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    out.push(node);
    for (const child of childrenOf(node)) stack.push(child);
  }
  return out;
}

function childrenOf(node: Node): Node[] {
  switch (node.type) {
    case "alternation":
      return node.alternatives;
    case "sequence":
      return node.elements;
    case "quantifier":
      return [node.body];
    case "group":
      return [node.body];
    case "lookaround":
      return [node.body];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// flags - <cbs> extension tokens + the v host-age flag
// ---------------------------------------------------------------------------

function lintFlags(flags: string, profile: RegexWriteForProfile, label: string): TravelNote[] {
  const notes: TravelNote[] = [];

  // <cbs>-style extension tokens: Risu-only output-macro processing. Stored verbatim on the wire
  // (schema keeps flags raw); useFlags is deliberately NOT consulted - the token still travels to the
  // destination, which still will not honor it, so presence alone is the honest signal.
  if (!profileRunsReplaceFeature(profile, "cbs-flag-tokens")) {
    for (const span of tokenSpans(flags, /<[^>]*>/g)) {
      const token = flags.slice(span.start, span.end);
      notes.push({
        feature: "cbs-flag-tokens",
        field: "flags",
        span,
        severity: "unsupported",
        message:
          `The "${token}" flag turns on Risu's output macros here, but ${label} does not process it ` +
          "and will ignore it.",
      });
    }
  }

  // v flag: a host-age pattern risk. Read the JS-flag chars OUTSIDE any <...> token so a token's
  // letters are never mistaken for a flag.
  for (const pos of jsFlagPositions(flags)) {
    if (flags[pos] === "v") {
      notes.push({
        feature: "v-flag",
        field: "flags",
        span: { start: pos, end: pos + 1 },
        severity: "host-age",
        message:
          `The v flag is a newer regex feature; older ${label} installs may reject this whole rule.`,
      });
    }
  }

  return notes;
}

/** Half-open spans of every match of a global regex in `text`. */
function tokenSpans(text: string, re: RegExp): Span[] {
  const spans: Span[] = [];
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    spans.push({ start, end: start + m[0].length });
  }
  return spans;
}

/** Indices of every flag char that is NOT inside a <...> extension token (a tolerant, single pass). */
function jsFlagPositions(flags: string): number[] {
  const out: number[] = [];
  let inToken = false;
  for (let i = 0; i < flags.length; i++) {
    const c = flags[i];
    if (c === "<") {
      inToken = true;
      continue;
    }
    if (c === ">") {
      inToken = false;
      continue;
    }
    if (!inToken) out.push(i);
  }
  return out;
}

// ---------------------------------------------------------------------------
// replace ops - {{match}} sugar + \u \l \U \L \E case transforms
// ---------------------------------------------------------------------------

/**
 * Scan the replacement template once, mirroring replace-ops.ts `expandReplacement`'s escape handling:
 *   \\        -> an escaped backslash (the next char is literal; "\\U" is NOT a case token)
 *   \u \l     -> a one-shot case change; \U \L \E -> a case run; all "case-transform"
 *   {{match}} -> the whole-match sugar (9 chars, case-insensitive) -> "match-token"
 * A note fires only when `profile`'s engine does not run that extension.
 */
function lintReplace(replace: string, profile: RegexWriteForProfile, label: string): TravelNote[] {
  const notes: TravelNote[] = [];
  const matchOk = profileRunsReplaceFeature(profile, "match-token");
  const caseOk = profileRunsReplaceFeature(profile, "case-transform");
  const isCaseLetter = (c: string | undefined): c is "u" | "l" | "U" | "L" | "E" =>
    c === "u" || c === "l" || c === "U" || c === "L" || c === "E";

  const n = replace.length;
  let i = 0;
  while (i < n) {
    const c = replace[i];
    if (c === "\\") {
      const next = replace[i + 1];
      if (next === "\\") {
        i += 2;
        continue;
      }
      if (isCaseLetter(next)) {
        if (!caseOk) {
          notes.push({
            feature: "case-transform",
            field: "replace",
            span: { start: i, end: i + 2 },
            severity: "unsupported",
            message:
              `The case-change code "\\${next}" runs here, but ${label} does not change letter case ` +
              `and will print "\\${next}" literally.`,
          });
        }
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === "{" && replace.slice(i, i + 9).toLowerCase() === "{{match}}") {
      if (!matchOk) {
        notes.push({
          feature: "match-token",
          field: "replace",
          span: { start: i, end: i + 9 },
          severity: "unsupported",
          message:
            `The {{match}} shortcut inserts the matched text here, but ${label} does not support it ` +
            'and will print "{{match}}" literally.',
        });
      }
      i += 9;
      continue;
    }
    i += 1;
  }
  return notes;
}
