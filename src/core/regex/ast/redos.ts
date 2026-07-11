/**
 * Static ReDoS (catastrophic-backtracking) analysis on the regex AST (REGEX-JEWEL-PLAN.md Phase
 * R2X). Reads STRUCTURE, never runs the pattern: a real `(a+)+$` bomb cannot be interrupted inside a
 * synchronous RegExp, so the only honest way to warn about it at author time is to derive the danger
 * from the tree. This is the underline source for QOL row 22 (the editor highlights culpritSpan).
 *
 * It is a WARNING lens, not the gate. The actual defense is already shipped: validate.ts refuses a
 * pattern over its complexity cap before compile, and apply.ts holds the per-rule timeout budget.
 * So this module is tuned for PRECISION over recall: a false positive cries wolf on a safe pattern
 * (the UX harm we avoid), whereas a miss simply falls through to those existing guards.
 *
 * Three structural culprits, each derived from the AST:
 *  - nested unbounded quantifiers whose iteration boundary is ambiguous ((a+)+, (a+a)+) - the seam
 *    between two outer iterations is nullable or its first-set overlaps the inner run's first-set;
 *    a mandatory disjoint separator ((a+b)+, (ab+)+) is proven safe and passes clean.
 *  - overlapping alternatives under an unbounded quantifier ((a|ab)+, (a|a)+): a proven prefix/equal
 *    ambiguity on simple literal alternatives is "dangerous"; a coarse first-set overlap on complex
 *    alternatives ((\d|\w)+) is at most "suspicious" - we never claim more than we can derive.
 *  - a backreference inside unbounded repetition ((a)\1+).
 *
 * Character-set reasoning is deliberately COARSE (a fixed sample universe + per-atom witnesses):
 * dot and unicode-property atoms match anything; class letters and code points test membership
 * directly. Full character-set algebra is out of scope and out of the 500-line budget for this file.
 *
 * SAFETY: this is analysis over DATA. It compiles and runs nothing.
 */
import type {
  Alternation,
  CharClass,
  ClassItem,
  Node,
  Quantifier,
  Sequence,
  Span,
} from "./ast-types";

export type RedosSeverity = "safe" | "suspicious" | "dangerous";

export type RedosKind = "nested-quantifier" | "overlapping-alternation" | "quantified-backreference";

/** One structural ReDoS culprit, spanning the exact characters the editor should underline. */
export interface RedosFinding {
  kind: RedosKind;
  severity: "suspicious" | "dangerous";
  culpritSpan: Span;
  message: string;
}

/** The whole-pattern verdict: worst finding severity, or "safe" when nothing tripped. */
export interface RedosReport {
  severity: RedosSeverity;
  findings: RedosFinding[];
}

/**
 * Analyze a parsed pattern for static ReDoS shapes. Pure over the AST: returns a report whose
 * `severity` is the worst finding (or "safe"), each finding carrying the exact culprit span.
 */
export function analyzeRedos(ast: Alternation): RedosReport {
  const raw: RedosFinding[] = [];
  eachNode(ast, (node) => {
    if (node.type !== "quantifier" || node.max !== null) return;
    collectForQuantifier(node, raw);
  });
  const findings = dedupeBySpan(raw);
  return { severity: worstSeverity(findings), findings };
}

// --- per-quantifier detectors ----------------------------------------------

function collectForQuantifier(q: Quantifier, out: RedosFinding[]): void {
  if (hasAmbiguousInnerLoop(q)) {
    out.push({
      kind: "nested-quantifier",
      severity: "dangerous",
      culpritSpan: span(q),
      message: "Nested unbounded repetition can backtrack catastrophically on non-matching input.",
    });
  }
  const alt = alternationBody(q);
  if (alt) {
    const overlap = alternationOverlap(alt);
    if (overlap) {
      out.push({
        kind: "overlapping-alternation",
        severity: overlap,
        culpritSpan: span(q),
        message:
          overlap === "dangerous"
            ? "Repeated group has alternatives that can match the same text, risking catastrophic backtracking."
            : "Repeated group has overlapping alternatives that may backtrack on some input.",
      });
    }
  }
  if (containsBackreference(q.body)) {
    out.push({
      kind: "quantified-backreference",
      severity: "dangerous",
      culpritSpan: span(q),
      message: "A backreference inside unbounded repetition can backtrack catastrophically.",
    });
  }
}

/**
 * Detector A. The outer quantifier is `q`; its body iterates. It is dangerous when some inner
 * unbounded quantifier's run has an ambiguous boundary: the material that can follow the inner run
 * within one outer loop (including wrapping back to the body's start) is nullable, or its first-set
 * overlaps the inner run's own first-set. A mandatory, disjoint separator makes it safe.
 */
function hasAmbiguousInnerLoop(q: Quantifier): boolean {
  const found: Quantifier[] = [];
  // After one body match the outer loops, so the body's own first-set is what can follow it.
  scanInner(q.body, firstSet(q.body), found);
  return found.length > 0;
}

function scanInner(node: Node, after: readonly Atom[], out: Quantifier[]): void {
  switch (node.type) {
    case "sequence": {
      let cur: readonly Atom[] = after;
      for (let i = node.elements.length - 1; i >= 0; i--) {
        const el = node.elements[i] as Node;
        scanInner(el, cur, out);
        cur = nullable(el) ? [...firstSet(el), ...cur] : firstSet(el);
      }
      return;
    }
    case "alternation":
      for (const branch of node.alternatives) scanInner(branch, after, out);
      return;
    case "group":
      scanInner(node.body, after, out);
      return;
    case "quantifier": {
      const loops = node.max === null;
      if (loops && overlaps(firstSet(node.body), after)) out.push(node);
      scanInner(node.body, loops ? [...firstSet(node.body), ...after] : after, out);
      return;
    }
    case "lookaround":
      // Zero-width: it does not chain characters into the outer loop, so nested repetition inside is
      // separated. Recurse only so a bomb literally inside the assertion is still caught by its own
      // outer-quantifier pass; the seam here is empty.
      scanInner(node.body, [], out);
      return;
    default:
      return; // leaves: literal, dot, anchor, class escapes, char class, backreference
  }
}

/**
 * Detector B. `alt` is the alternation body of an unbounded quantifier. Prefix/equal ambiguity on
 * two simple literal alternatives is dangerous; a coarse first-set overlap on complex alternatives
 * is suspicious. Disjoint alternatives ((a|b)+) and diverging literals ((ab|ac)+) pass clean.
 */
function alternationOverlap(alt: Alternation): "dangerous" | "suspicious" | null {
  const branches = alt.alternatives;
  if (branches.length < 2) return null;
  let suspicious = false;
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i] as Sequence;
      const b = branches[j] as Sequence;
      const sa = literalString(a);
      const sb = literalString(b);
      if (sa !== null && sb !== null) {
        if (sa.startsWith(sb) || sb.startsWith(sa)) return "dangerous";
        continue; // both literal and diverging: deterministic, safe
      }
      if (overlaps(firstSet(a), firstSet(b))) suspicious = true;
    }
  }
  return suspicious ? "suspicious" : null;
}

/** The literal text of a sequence, or null if any element is not a bare literal. */
function literalString(seq: Sequence): string | null {
  let out = "";
  for (const el of seq.elements) {
    if (el.type !== "literal") return null;
    out += el.value;
  }
  return out;
}

/** The alternation directly under a quantifier (unwrapping one group), else null. */
function alternationBody(q: Quantifier): Alternation | null {
  const body = q.body;
  if (body.type === "group") return body.body;
  if (body.type === "alternation") return body;
  return null;
}

/** Detector C helper: any backreference anywhere inside a node subtree. */
function containsBackreference(node: Node): boolean {
  let found = false;
  eachNode(node, (n) => {
    if (n.type === "backreference") found = true;
  });
  return found;
}

// --- nullability + first-set over the AST ----------------------------------

/** An abstract character set: `wide` matches anything; otherwise `test` decides membership. */
interface Atom {
  wide: boolean;
  witnesses: readonly number[];
  test: (cp: number) => boolean;
}

const DOT_ATOM: Atom = { wide: true, witnesses: [], test: () => true };
const WIDE_ATOM: Atom = { wide: true, witnesses: [], test: () => true };

/** Can this node match the empty string? */
function nullable(node: Node): boolean {
  switch (node.type) {
    case "anchor":
    case "lookaround":
    case "backreference": // a captured group may itself have matched empty
      return true;
    case "quantifier":
      return node.min === 0 || nullable(node.body);
    case "group":
      return nullable(node.body);
    case "alternation":
      return node.alternatives.some(nullable);
    case "sequence":
      return node.elements.every(nullable);
    default:
      return false; // literal, dot, class escapes, unicode property, char class
  }
}

/** The set of characters this node can match FIRST (empty for zero-width nodes). */
function firstSet(node: Node): Atom[] {
  switch (node.type) {
    case "literal":
      return [cpAtom(node.codePoint)];
    case "dot":
      return [DOT_ATOM];
    case "class-escape":
      return [classLetterAtom(node.letter)];
    case "unicode-property":
      return [WIDE_ATOM];
    case "char-class":
      return [charClassAtom(node)];
    case "backreference":
      return [WIDE_ATOM];
    case "anchor":
    case "lookaround":
      return []; // zero-width consumes nothing
    case "quantifier":
    case "group":
      return firstSet(node.body);
    case "alternation":
      return node.alternatives.flatMap(firstSet);
    case "sequence": {
      const out: Atom[] = [];
      for (const el of node.elements) {
        out.push(...firstSet(el));
        if (!nullable(el)) break;
      }
      return out;
    }
    default:
      return [];
  }
}

// --- coarse character-set overlap ------------------------------------------

const SAMPLE: readonly number[] = [
  0x30, 0x39, 0x41, 0x5a, 0x61, 0x7a, 0x5f, 0x20, 0x09, 0x0a, 0x21, 0x2e, 0x40, 0xa0,
];

function overlaps(xs: readonly Atom[], ys: readonly Atom[]): boolean {
  for (const x of xs) {
    for (const y of ys) {
      if (atomsOverlap(x, y)) return true;
    }
  }
  return false;
}

function atomsOverlap(a: Atom, b: Atom): boolean {
  if (a.wide || b.wide) return true;
  for (const cp of [...SAMPLE, ...a.witnesses, ...b.witnesses]) {
    if (a.test(cp) && b.test(cp)) return true;
  }
  return false;
}

const cpAtom = (cp: number): Atom => ({ wide: false, witnesses: [cp], test: (x) => x === cp });

const isDigit = (cp: number): boolean => cp >= 0x30 && cp <= 0x39;
const isWord = (cp: number): boolean =>
  isDigit(cp) || (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) || cp === 0x5f;
const SPACE_CPS = new Set<number>([
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
]);
const isSpace = (cp: number): boolean => SPACE_CPS.has(cp) || (cp >= 0x2000 && cp <= 0x200a);

function letterTest(letter: "d" | "D" | "w" | "W" | "s" | "S"): (cp: number) => boolean {
  switch (letter) {
    case "d":
      return isDigit;
    case "D":
      return (cp) => !isDigit(cp);
    case "w":
      return isWord;
    case "W":
      return (cp) => !isWord(cp);
    case "s":
      return isSpace;
    case "S":
      return (cp) => !isSpace(cp);
    default:
      return assertNever(letter);
  }
}

function classLetterAtom(letter: "d" | "D" | "w" | "W" | "s" | "S"): Atom {
  const test = letterTest(letter);
  return { wide: false, witnesses: SAMPLE.filter(test), test };
}

/**
 * A character class as one atom. Any unicode property inside makes it `wide` (we cannot cheaply
 * decide membership); otherwise membership tests items directly, honoring negation.
 */
function charClassAtom(node: CharClass): Atom {
  const hasProperty = node.items.some((item) => item.type === "unicode-property");
  if (hasProperty) return WIDE_ATOM;
  const positive = (cp: number): boolean => node.items.some((item) => classItemMatches(item, cp));
  const test = node.negated ? (cp: number): boolean => !positive(cp) : positive;
  const witnesses = classWitnesses(node.items).filter(test);
  return { wide: false, witnesses, test };
}

function classItemMatches(item: ClassItem, cp: number): boolean {
  switch (item.type) {
    case "literal":
      return cp === item.codePoint;
    case "class-range":
      return cp >= item.from.codePoint && cp <= item.to.codePoint;
    case "class-escape":
      return letterTest(item.letter)(cp);
    case "unicode-property":
      return false; // handled by the wide short-circuit above
    default:
      return assertNever(item);
  }
}

function classWitnesses(items: readonly ClassItem[]): number[] {
  const out = [...SAMPLE];
  for (const item of items) {
    if (item.type === "literal") out.push(item.codePoint);
    else if (item.type === "class-range") out.push(item.from.codePoint, item.to.codePoint);
  }
  return out;
}

// --- shared helpers --------------------------------------------------------

function eachNode(node: Node, visit: (n: Node) => void): void {
  visit(node);
  switch (node.type) {
    case "alternation":
      node.alternatives.forEach((n) => eachNode(n, visit));
      return;
    case "sequence":
      node.elements.forEach((n) => eachNode(n, visit));
      return;
    case "quantifier":
    case "group":
    case "lookaround":
      eachNode(node.body, visit);
      return;
    default:
      return; // leaves have no child Nodes
  }
}

const span = (node: Span): Span => ({ start: node.start, end: node.end });

const SEVERITY_RANK: Record<"suspicious" | "dangerous", number> = { suspicious: 1, dangerous: 2 };

/** Keep one finding per exact span, the highest severity winning. */
function dedupeBySpan(findings: readonly RedosFinding[]): RedosFinding[] {
  const best = new Map<string, RedosFinding>();
  for (const f of findings) {
    const key = `${f.culpritSpan.start}:${f.culpritSpan.end}`;
    const prior = best.get(key);
    if (!prior || SEVERITY_RANK[f.severity] > SEVERITY_RANK[prior.severity]) best.set(key, f);
  }
  return [...best.values()].sort((a, b) => a.culpritSpan.start - b.culpritSpan.start);
}

function worstSeverity(findings: readonly RedosFinding[]): RedosSeverity {
  let worst: RedosSeverity = "safe";
  for (const f of findings) {
    if (f.severity === "dangerous") return "dangerous";
    worst = "suspicious";
  }
  return worst;
}

function assertNever(value: never): never {
  throw new Error(`regex/redos: unhandled variant ${JSON.stringify(value)}`);
}
