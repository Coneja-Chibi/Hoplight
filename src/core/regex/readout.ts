/**
 * The composed readout the Plain-words editor shows under a built pattern (REGEX-JEWEL-PLAN.md R3).
 * Parses the find pattern ONCE and derives everything from that single AST (engine-truth, no triple
 * re-parse): the plain reading, execution-verified example + near-miss chips, the RC-style Mode /
 * Examples / Uses meta lines, the literal token chips, and the syntax-colored SPANS for the delimited
 * pattern box. Pure: the example generator's randomness is the injected `rng` (a seeded unit stream),
 * never Math.random, so a render is stable for a given (find, flags, seed).
 *
 * The syntax spans index into the ORIGINAL `find` string (not printRegex output, which normalizes):
 * AST leaves paint their own kind, and every unpainted position (parens, `|`, quantifier chars, class
 * brackets) is structural. A pattern that will not parse degrades to one neutral span, never a throw.
 */
import type { Alternation, Node } from "./ast/ast-types";
import { explainAst } from "./ast/explain";
import { examplesFor } from "./ast/examples";
import { parseRegex } from "./ast/parser";
import { explainPattern } from "./builder";

export type SpanKind = "literal" | "anchor" | "special" | "group";

export interface PatternSpan {
  text: string;
  kind: SpanKind;
}

export interface Readout {
  /** One plain-language sentence reading the whole pattern, or "" when it will not parse. */
  reading: string;
  /** Flag descriptions for the "Mode:" line (case-insensitive, unicode, ...). */
  mode: string[];
  /** The literal words the pattern names - the token chips and the "Examples:" line. */
  words: string[];
  /** Structural features present - the "Uses:" line (word boundaries, alternatives, ...). */
  uses: string[];
  /** Execution-verified strings the pattern matches (hit chips). */
  matches: string[];
  /** Execution-verified strings the pattern rejects, kept near the grammar (miss chips). */
  nearMisses: string[];
  /** Syntax-colored spans over the ORIGINAL find string, in order. */
  spans: PatternSpan[];
}

export interface ReadoutOptions {
  rng: () => number;
  /** How many hit / miss chips to attempt (default 5). */
  count?: number;
}

const FLAG_MODE: Record<string, string> = {
  i: "case-insensitive",
  m: "start and end marks apply to each line",
  s: "any-character mark also matches line breaks",
  u: "unicode",
};

/** Strip Risu-style `<...>` extension tokens so a stored flags value reads cleanly. */
const jsFlags = (flags: string): string => flags.replace(/<[^>]*>/g, "");

function modeLines(flags: string): string[] {
  const out: string[] = [];
  for (const f of jsFlags(flags)) {
    const label = FLAG_MODE[f];
    if (label !== undefined && !out.includes(label)) out.push(label);
  }
  return out;
}

/** Walk the AST collecting the structural features present, in a stable display order. */
function usesFromAst(ast: Alternation): string[] {
  const found = new Set<string>();
  const visit = (node: Node): void => {
    switch (node.type) {
      case "alternation":
        if (node.alternatives.length > 1) found.add("alternatives");
        node.alternatives.forEach(visit);
        return;
      case "sequence":
        node.elements.forEach(visit);
        return;
      case "anchor":
        if (node.kind === "word-boundary" || node.kind === "non-word-boundary") found.add("word boundaries");
        else found.add("line anchors");
        return;
      case "char-class":
        found.add("character class");
        node.items.forEach((item) => {
          if (item.type === "class-escape") classEscapeUse(item.letter, found);
          else if (item.type === "unicode-property") found.add("unicode groups");
        });
        return;
      case "class-escape":
        classEscapeUse(node.letter, found);
        return;
      case "quantifier":
        found.add("optional or repeated parts");
        visit(node.body);
        return;
      case "group":
        visit(node.body);
        return;
      case "lookaround":
        found.add("look-ahead or look-behind");
        visit(node.body);
        return;
      case "unicode-property":
        found.add("unicode groups");
        return;
      default:
        return;
    }
  };
  visit(ast);
  const order = [
    "word boundaries",
    "alternatives",
    "optional or repeated parts",
    "character class",
    "whitespace",
    "digits",
    "word characters",
    "line anchors",
    "look-ahead or look-behind",
    "unicode groups",
  ];
  return order.filter((u) => found.has(u));
}

function classEscapeUse(letter: string, found: Set<string>): void {
  const low = letter.toLowerCase();
  if (low === "s") found.add("whitespace");
  else if (low === "d") found.add("digits");
  else if (low === "w") found.add("word characters");
}

/** Paint each character position of `find` with a semantic kind, then coalesce into spans. */
function spansFromAst(ast: Alternation, find: string): PatternSpan[] {
  const kinds: (SpanKind | null)[] = new Array(find.length).fill(null);
  const paint = (start: number, end: number, kind: SpanKind): void => {
    for (let i = start; i < end && i < kinds.length; i++) kinds[i] = kind;
  };
  const visit = (node: Node): void => {
    switch (node.type) {
      case "alternation":
        node.alternatives.forEach(visit);
        return;
      case "sequence":
        node.elements.forEach(visit);
        return;
      case "literal":
        paint(node.start, node.end, "literal");
        return;
      case "dot":
      case "class-escape":
      case "unicode-property":
      case "backreference":
        paint(node.start, node.end, "special");
        return;
      case "anchor":
        paint(node.start, node.end, "anchor");
        return;
      case "char-class":
        node.items.forEach((item) => {
          if (item.type === "class-range") {
            paint(item.from.start, item.from.end, "literal");
            paint(item.to.start, item.to.end, "literal");
          } else {
            visit(item);
          }
        });
        return;
      case "quantifier":
        visit(node.body);
        return;
      case "group":
      case "lookaround":
        visit(node.body);
        return;
      default:
        return;
    }
  };
  visit(ast);

  const spans: PatternSpan[] = [];
  let i = 0;
  while (i < find.length) {
    const kind: SpanKind = kinds[i] ?? "group";
    let j = i + 1;
    while (j < find.length && (kinds[j] ?? "group") === kind) j++;
    spans.push({ text: find.slice(i, j), kind });
    i = j;
  }
  return spans;
}

/** Compile for a stateless re-verify (keep i/m/s/u, drop g/y), or null on a bad pattern. */
function compileStateless(find: string, flags: string): RegExp | null {
  const kept = new Set<string>();
  for (const f of jsFlags(flags)) {
    if (f === "i" || f === "m" || f === "s" || f === "u") kept.add(f);
  }
  if (/\\[pP]\{/.test(find)) kept.add("u");
  try {
    return new RegExp(find, [...kept].join(""));
  } catch {
    return null;
  }
}

/**
 * Collapse the ugly random whitespace examplesFor emits for `\s+` down to single spaces for display,
 * but only when the tidy form STILL matches (engine truth preserved). A pattern with no whitespace
 * class is untouched. Deduped so two matches that tidy to the same string collapse to one.
 */
function tidyMatches(matches: readonly string[], re: RegExp | null): string[] {
  if (re === null) return [...matches];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const tidy = m.replace(/\s+/g, " ").trim();
    re.lastIndex = 0;
    const pick = tidy.length > 0 && re.test(tidy) ? tidy : m;
    if (!seen.has(pick)) {
      seen.add(pick);
      out.push(pick);
    }
  }
  return out;
}

const EMPTY: Readout = { reading: "", mode: [], words: [], uses: [], matches: [], nearMisses: [], spans: [] };

/** Compose the full readout for a find/flags pair from a single AST parse. */
export function readoutFor(find: string, flags: string, options: ReadoutOptions): Readout {
  if (find.trim() === "") return EMPTY;
  const count = options.count ?? 5;
  const parsed = parseRegex(find);
  const explained = explainPattern(find, flags);
  const words = explained.phrases;
  const mode = modeLines(flags);

  if (!("ast" in parsed)) {
    return { reading: "", mode, words, uses: [], matches: [], nearMisses: [], spans: [{ text: find, kind: "group" }] };
  }
  const ast = parsed.ast;
  const reading = explainAst(ast, jsFlags(flags)).text;
  const examples = examplesFor(ast, { rng: options.rng, count, flags });
  const re = compileStateless(find, flags);
  return {
    reading,
    mode,
    words,
    uses: usesFromAst(ast),
    matches: tidyMatches(examples.matches, re),
    nearMisses: examples.nearMisses,
    spans: spansFromAst(ast, find),
  };
}
