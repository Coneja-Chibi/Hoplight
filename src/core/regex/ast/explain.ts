/**
 * Plain-language reader for a regex AST (REGEX-JEWEL-PLAN.md Phase R2X, QOL 20). Walks the
 * ast-types.ts node union and returns ONE naive-reader sentence describing what the pattern matches,
 * plus short notes for the flags that change matching. No jargon reaches the reader: "word boundary"
 * becomes "the edge of a word", a capture group becomes "a remembered piece", and so on.
 *
 * ENGINE TRUTH: every phrase is derived structurally from the AST, never guessed. This is the general
 * mechanical reader, so it does NOT recognize authoring idioms (the builder's "anything between X and
 * Y" sugar is builder.ts's job) - it reads exactly what the nodes say. The one honest simplification
 * is the always-everything class pair [\s\S] / [\d\D] / [\w\W] -> "any character".
 *
 * HONESTY ON ASCII: JS `\w \d \b` are ASCII-only even under the u flag, so the wording says "English
 * letter" / "the edge of a word" and never overclaims that accented or CJK letters count.
 *
 * FLAGS: pass the STANDARD JS flags string. Risu-style extension tokens like "<cbs>" are tolerated
 * (stripped before reading) so a raw stored flags value can never flip dotall via the `s` inside a
 * token; the real strip for compilation lives in core/regex/apply.ts, not here.
 */
import type {
  Alternation,
  Anchor,
  Backreference,
  CharacterClassEscape,
  CharClass,
  ClassItem,
  Group,
  Literal,
  Lookaround,
  Node,
  Quantifier,
  Sequence,
  UnicodeProperty,
} from "./ast-types";

/** The plain-language reading of a whole pattern. */
export interface PlainExplanation {
  /** One capitalized, period-terminated sentence a naive reader can follow cold. */
  text: string;
  /** Short plain notes for the flags that change matching (case, find-all); empty when none apply. */
  flagNotes: string[];
}

/** Matching context that flags (or a local `(?ims:...)` modifier group) can toggle. */
interface Ctx {
  multiline: boolean;
  dotAll: boolean;
}

/** Explain an AST in plain language under the given flags. */
export function explainAst(ast: Alternation, flags = ""): PlainExplanation {
  const jsFlags = flags.replace(/<[^>]*>/g, "");
  const ctx: Ctx = { multiline: jsFlags.includes("m"), dotAll: jsFlags.includes("s") };
  const body = describeAlternation(ast, ctx);
  const text = body === EMPTY ? "This pattern is empty: it matches an empty spot." : `${capitalize(body)}.`;
  return { text, flagNotes: flagNotes(jsFlags) };
}

const EMPTY = "nothing";

function flagNotes(jsFlags: string): string[] {
  const notes: string[] = [];
  if (jsFlags.includes("i")) notes.push("Matching ignores whether letters are capital or lowercase.");
  if (jsFlags.includes("g")) notes.push("Finds every match in the text, not just the first.");
  return notes;
}

// ---------------------------------------------------------------------------
// structural walk
// ---------------------------------------------------------------------------

function describeNode(node: Node, ctx: Ctx): string {
  switch (node.type) {
    case "alternation":
      return describeAlternation(node, ctx);
    case "sequence":
      return describeSequence(node, ctx);
    case "literal":
      return describeLiteral(node);
    case "dot":
      return ctx.dotAll ? "any character, including line breaks" : "any character except a line break";
    case "anchor":
      return describeAnchor(node, ctx);
    case "class-escape":
      return CLASS_ESCAPE_TOP[node.letter];
    case "unicode-property":
      return describeProperty(node, false);
    case "char-class":
      return describeClass(node);
    case "quantifier":
      return describeQuantifier(node, ctx);
    case "group":
      return describeGroup(node, ctx);
    case "lookaround":
      return describeLookaround(node, ctx);
    case "backreference":
      return describeBackreference(node);
    default:
      return assertNever(node);
  }
}

function describeAlternation(node: Alternation, ctx: Ctx): string {
  const alts = node.alternatives.map((alt) => describeSequence(alt, ctx));
  if (alts.length === 1) return alts[0] as string;
  return `either ${joinList(alts, "or")}`;
}

/**
 * Read a sequence left to right, coalescing adjacent plain literals into one quoted run ("the text
 * \"cat\"") so a naive reader sees words, not one-letter-at-a-time. A quantified literal is its own
 * Quantifier node, never a sibling Literal, so a run can never accidentally swallow a `+`.
 */
function describeSequence(node: Sequence, ctx: Ctx): string {
  const pieces: string[] = [];
  let run = "";
  const flush = (): void => {
    if (run.length === 0) return;
    pieces.push(run.length === 1 ? `the character "${run}"` : `the text "${run}"`);
    run = "";
  };
  for (const el of node.elements) {
    if (el.type === "literal" && controlName(el.codePoint) === null) {
      run += el.value;
      continue;
    }
    flush();
    pieces.push(describeNode(el, ctx));
  }
  flush();
  if (pieces.length === 0) return EMPTY;
  if (pieces.length === 1) return pieces[0] as string;
  return pieces.join(", then ");
}

function describeLiteral(node: Literal): string {
  const control = controlName(node.codePoint);
  if (control !== null) return control;
  return `the character "${node.value}"`;
}

function describeAnchor(node: Anchor, ctx: Ctx): string {
  switch (node.kind) {
    case "line-start":
      return ctx.multiline ? "the start of a line" : "the start of the text";
    case "line-end":
      return ctx.multiline ? "the end of a line" : "the end of the text";
    case "word-boundary":
      return "the edge of a word";
    case "non-word-boundary":
      return "a spot that is not the edge of a word";
    default:
      return assertNever(node.kind);
  }
}

const CLASS_ESCAPE_TOP: Record<CharacterClassEscape["letter"], string> = {
  d: "any digit",
  D: "any character that is not a digit",
  w: "any English letter, digit, or underscore",
  W: "any character that is not an English letter, digit, or underscore",
  s: "any space, tab, or line break",
  S: "any character that is not a space, tab, or line break",
};

/** In-class noun forms ("a digit"), so a class reads "any of: a digit or ...". */
const CLASS_ESCAPE_ITEM: Record<CharacterClassEscape["letter"], string> = {
  d: "a digit",
  D: "a character that is not a digit",
  w: "an English letter, digit, or underscore",
  W: "a character that is not an English letter, digit, or underscore",
  s: "a space, tab, or line break",
  S: "a character that is not a space, tab, or line break",
};

function describeProperty(node: UnicodeProperty, inClass: boolean): string {
  const lead = inClass ? "a character" : "any character";
  if (node.value !== undefined) {
    const not = node.negated ? " not" : "";
    return `${lead} whose Unicode "${node.name}" is${not} "${node.value}"`;
  }
  const relation = node.negated ? "not in" : "in";
  return `${lead} ${relation} the Unicode group "${node.name}"`;
}

/**
 * A character class. The always-everything pairs [\s\S] / [\d\D] / [\w\W] read as "any character"
 * (a provable simplification, not idiom-guessing); everything else lists its members honestly.
 */
function describeClass(node: CharClass): string {
  if (isAnyCharClass(node)) return "any character, including line breaks";
  const items = node.items.map(describeClassItem);
  const list = joinList(items, "or");
  return node.negated ? `any character except ${list}` : `any of: ${list}`;
}

function describeClassItem(item: ClassItem): string {
  switch (item.type) {
    case "literal":
      return charLabel(item);
    case "class-range":
      return `${charLabel(item.from)} through ${charLabel(item.to)}`;
    case "class-escape":
      return CLASS_ESCAPE_ITEM[item.letter];
    case "unicode-property":
      return describeProperty(item, true);
    default:
      return assertNever(item);
  }
}

function describeQuantifier(node: Quantifier, ctx: Ctx): string {
  return `${describeNode(node.body, ctx)} ${countPhrase(node)}`;
}

/** The parenthetical repetition count, e.g. "(one or more times, as few as possible)". */
function countPhrase(node: Quantifier): string {
  const { min, max, lazy } = node;
  const lazyTail = lazy ? ", as few as possible" : "";
  let core: string;
  if (min === 0 && max === null) core = "zero or more times";
  else if (min === 1 && max === null) core = "one or more times";
  else if (min === 0 && max === 1) core = "optional";
  else if (max === null) core = `${min} or more times`;
  else if (max === min) core = max === 1 ? "exactly once" : `exactly ${max} times`;
  else core = `between ${min} and ${max} times`;
  return `(${core}${lazyTail})`;
}

function describeGroup(node: Group, ctx: Ctx): string {
  const childCtx = node.modifiers ? applyModifiers(ctx, node.modifiers) : ctx;
  const inner = describeAlternation(node.body, childCtx);
  if (node.modifiers) {
    const changes = modifierChanges(node.modifiers);
    return changes === null
      ? `a group of: ${inner}`
      : `a group where ${changes}, containing: ${inner}`;
  }
  if (node.name !== null) return `a remembered piece named "${node.name}", containing: ${inner}`;
  if (node.capturing) return `a remembered piece (group ${node.index}), containing: ${inner}`;
  return `a group of: ${inner}`;
}

function describeLookaround(node: Lookaround, ctx: Ctx): string {
  const inner = describeAlternation(node.body, ctx);
  const direction = node.ahead ? "followed by" : "preceded by";
  const relation = node.negative ? `must not be ${direction}` : `must be ${direction}`;
  return `a spot that ${relation}: ${inner}`;
}

function describeBackreference(node: Backreference): string {
  return typeof node.ref === "number"
    ? `the same text that remembered piece (group ${node.ref}) matched`
    : `the same text that the piece named "${node.ref}" matched`;
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

/** True for the always-everything class pairs [\s\S] / [\d\D] / [\w\W] (either member order). */
function isAnyCharClass(node: CharClass): boolean {
  if (node.negated || node.items.length !== 2) return false;
  const [a, b] = node.items;
  if (a?.type !== "class-escape" || b?.type !== "class-escape") return false;
  return a.letter.toLowerCase() === b.letter.toLowerCase() && a.letter !== b.letter;
}

/** Apply a `(?ims-ims:...)` modifier group's add/remove to the multiline/dotAll context. */
function applyModifiers(ctx: Ctx, mods: Group["modifiers"]): Ctx {
  if (mods === null) return ctx;
  let multiline = ctx.multiline;
  let dotAll = ctx.dotAll;
  if (mods.add.includes("m")) multiline = true;
  if (mods.remove.includes("m")) multiline = false;
  if (mods.add.includes("s")) dotAll = true;
  if (mods.remove.includes("s")) dotAll = false;
  return { multiline, dotAll };
}

const MODIFIER_LABEL: Record<string, string> = {
  i: "capital and lowercase letters are treated the same",
  m: "the start and end marks apply to each line",
  s: "the any-character mark also matches line breaks",
};

/** Plain-language description of what a modifier group turns on/off, or null if it names nothing known. */
function modifierChanges(mods: Group["modifiers"]): string | null {
  if (mods === null) return null;
  const parts: string[] = [];
  for (const f of mods.add) {
    const label = MODIFIER_LABEL[f];
    if (label !== undefined) parts.push(label);
  }
  for (const f of mods.remove) {
    const label = MODIFIER_LABEL[f];
    if (label !== undefined) parts.push(`${label} is turned off`);
  }
  return parts.length === 0 ? null : joinList(parts, "and");
}

/** Label a single-code-point literal for display: a friendly name for control chars, else quoted. */
function charLabel(node: Literal): string {
  return controlName(node.codePoint) ?? `"${node.value}"`;
}

/** Plain name for a control code point that cannot be shown literally, or null if it is printable. */
function controlName(codePoint: number): string | null {
  switch (codePoint) {
    case 0x0a:
      return "a line break";
    case 0x0d:
      return "a carriage return";
    case 0x09:
      return "a tab";
    case 0x0c:
      return "a form feed";
    case 0x0b:
      return "a vertical tab";
    case 0x00:
      return "a null character";
    default:
      if (codePoint < 0x20 || codePoint === 0x7f) return `a control character (code ${codePoint})`;
      return null;
  }
}

/** Oxford-comma join: [a] -> a; [a,b] -> "a or b"; [a,b,c] -> "a, b, or c". */
function joinList(items: readonly string[], conjunction: "or" | "and"): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] as string;
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items[items.length - 1]}`;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0]?.toUpperCase() + text.slice(1);
}

function assertNever(value: never): never {
  throw new Error(`regex/explain: unhandled node ${JSON.stringify(value)}`);
}
