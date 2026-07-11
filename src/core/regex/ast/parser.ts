/**
 * The ECMAScript regex parser (REGEX-JEWEL-PLAN.md Phase R2X keystone). parseRegex reads a pattern
 * string into the ast-types.ts node union; printRegex (re-exported from printer.ts) reconstructs an
 * equivalent pattern. Together they are the substrate every later jewel (explain, examples, ReDoS
 * lint, dialect tolerance) stands on. Leaf escape atoms are lexed by tokens.ts.
 *
 * GRAMMAR CONTRACT (calibrated against this machine's JavaScriptCore, 2026-07-11): the parser
 * targets the ECMAScript UNICODE-mode grammar (the `u`-flag rules) for EVERY pattern, whatever the
 * flags string. This is deliberate (advisor ruling): unicode mode is the clean, fully-specified
 * grammar; it accepts essentially all authored find/replace rules; and the rare Annex-B legacy-only
 * forms (a lone `{`, a bare `]`, `\p` as literal p, octal `\8`, a quantified lookahead) return an
 * honest { error, at } rather than a silently-different parse. Legacy/foreign tolerance (inline-flag
 * hoisting, POSIX classes, PCRE escapes) is dialect.ts's job later, not the parser's. The `v`-flag
 * set-notation grammar is STAGED behind V_MODE_ENABLED (a `v` flag errors; CharClass.setOp is the
 * null seam for it). parseRegex never throws: a syntax error comes back as { error, at }.
 */
import type {
  Alternation,
  Anchor,
  Backreference,
  CharClass,
  CharacterClassEscape,
  ClassItem,
  Group,
  Literal,
  Lookaround,
  Node,
  Sequence,
  UnicodeProperty,
} from "./ast-types";
import { readEscapeCodePoint, readUnicodeProperty } from "./tokens";

/** Staged: the `v`-flag set-notation grammar is not implemented yet (u-flag ships first). */
export const V_MODE_ENABLED = false;

export type ParseResult = { ast: Alternation } | { error: string; at: number };

/** Internal control-flow signal carrying the source offset the parse failed at. */
class ParseError extends Error {
  constructor(
    message: string,
    readonly at: number,
  ) {
    super(message);
  }
}

const SYNTAX_CHARS = new Set(["^", "$", "\\", ".", "*", "+", "?", "(", ")", "[", "]", "{", "}", "|"]);
const CLASS_ESCAPE_LETTERS = new Set(["d", "D", "w", "W", "s", "S"]);
const CONTROL_ESCAPES: Record<string, number> = { f: 0x0c, n: 0x0a, r: 0x0d, t: 0x09, v: 0x0b };
const QUANTIFIER_STARTS = new Set(["*", "+", "?", "{"]);
const SIMPLE_QUANTIFIERS: Record<string, [number, number | null]> = { "*": [0, null], "+": [1, null], "?": [0, 1] };
const ID_START = /\p{ID_Start}/u;
const ID_CONTINUE = /\p{ID_Continue}/u;
const DIGIT = /[0-9]/;
const ZWNJ = "‌";
const ZWJ = "‍";

interface PathFrame {
  disj: number;
  alt: number;
}
interface NamedGroupRef {
  name: string;
  path: PathFrame[];
  at: number;
}

class RegexParser {
  private pos = 0;
  private groupCount = 0;
  private disjCounter = 0;
  private readonly pathStack: PathFrame[] = [];
  private readonly namedGroups: NamedGroupRef[] = [];
  private readonly numericRefs: { value: number; at: number }[] = [];
  private readonly namedRefs: { name: string; at: number }[] = [];

  constructor(private readonly src: string) {}

  private peek(offset = 0): string | undefined {
    return this.src[this.pos + offset];
  }

  private fail(message: string, at = this.pos): never {
    throw new ParseError(`regex/parse: ${message}`, at);
  }

  parse(): Alternation {
    const ast = this.parseDisjunction();
    if (this.pos < this.src.length) this.fail(this.peek() === ")" ? "unmatched )" : "unexpected trailing input");
    this.validateReferences();
    return ast;
  }

  private parseDisjunction(): Alternation {
    const start = this.pos;
    const frame: PathFrame = { disj: this.disjCounter++, alt: 0 };
    this.pathStack.push(frame);
    const alternatives: Sequence[] = [this.parseAlternative()];
    while (this.peek() === "|") {
      this.pos++;
      frame.alt++;
      alternatives.push(this.parseAlternative());
    }
    this.pathStack.pop();
    return { type: "alternation", alternatives, start, end: this.pos };
  }

  private parseAlternative(): Sequence {
    const start = this.pos;
    const elements: Node[] = [];
    while (this.pos < this.src.length && this.peek() !== "|" && this.peek() !== ")") {
      const before = this.pos;
      elements.push(this.parseTerm());
      if (this.pos === before) this.fail("parser made no progress"); // termination invariant
    }
    return { type: "sequence", elements, start, end: this.pos };
  }

  private parseTerm(): Node {
    const assertion = this.tryParseAssertion();
    if (assertion) {
      if (QUANTIFIER_STARTS.has(this.peek() ?? "")) this.fail("nothing to repeat");
      return assertion;
    }
    const atom = this.parseAtom();
    const quantified = this.tryParseQuantifier(atom);
    if (quantified && QUANTIFIER_STARTS.has(this.peek() ?? "")) this.fail("nothing to repeat");
    return quantified ?? atom;
  }

  private tryParseAssertion(): Anchor | Lookaround | null {
    const start = this.pos;
    const c = this.peek();
    if (c === "^" || c === "$") {
      this.pos++;
      return { type: "anchor", kind: c === "^" ? "line-start" : "line-end", start, end: this.pos };
    }
    if (c === "\\" && (this.peek(1) === "b" || this.peek(1) === "B")) {
      const kind = this.peek(1) === "b" ? "word-boundary" : "non-word-boundary";
      this.pos += 2;
      return { type: "anchor", kind, start, end: this.pos };
    }
    if (c === "(" && this.peek(1) === "?") {
      const c2 = this.peek(2);
      if (c2 === "=" || c2 === "!") return this.parseLookaround(start, true, c2 === "!");
      if (c2 === "<" && (this.peek(3) === "=" || this.peek(3) === "!")) {
        return this.parseLookaround(start, false, this.peek(3) === "!");
      }
    }
    return null;
  }

  private parseLookaround(start: number, ahead: boolean, negative: boolean): Lookaround {
    this.pos += ahead ? 3 : 4;
    const body = this.parseDisjunction();
    if (this.peek() !== ")") this.fail("unterminated lookaround");
    this.pos++;
    return { type: "lookaround", ahead, negative, body, start, end: this.pos };
  }

  private parseAtom(): Node {
    const start = this.pos;
    const c = this.peek();
    if (c === undefined) this.fail("unexpected end of pattern");
    if (c === "(") return this.parseGroup();
    if (c === "[") return this.parseClass();
    if (c === ".") {
      this.pos++;
      return { type: "dot", start, end: this.pos };
    }
    if (c === "\\") return this.parseEscape(false);
    if (c === "*" || c === "+" || c === "?") this.fail("nothing to repeat");
    if (c === "{") this.fail("lone quantifier brace");
    if (c === "}" || c === "]") this.fail(`lone ${c}`);
    return this.readLiteral();
  }

  /** Read one code point (a surrogate pair counts as one) as a Literal. */
  private readLiteral(): Literal {
    const start = this.pos;
    const cp = this.src.codePointAt(this.pos);
    if (cp === undefined) this.fail("unexpected end of pattern");
    this.pos += cp > 0xffff ? 2 : 1;
    return this.charLiteral(start, cp);
  }

  private charLiteral(start: number, codePoint: number): Literal {
    const raw = this.src.slice(start, this.pos);
    return { type: "literal", value: String.fromCodePoint(codePoint), raw, codePoint, start, end: this.pos };
  }

  /** Consume a single escape-type char (`\n`, `\0`, class `\b`, an identity escape) and emit it. */
  private oneCharEscape(start: number, codePoint: number): Literal {
    this.pos++;
    return this.charLiteral(start, codePoint);
  }

  private parseGroup(): Group {
    const start = this.pos;
    this.pos++;
    let capturing = true;
    let name: string | null = null;
    let index: number | null = null;
    let modifiers: Group["modifiers"] = null;
    if (this.peek() === "?") {
      const c2 = this.peek(1);
      if (c2 === ":") {
        capturing = false;
        this.pos += 2;
      } else if (c2 === "<") {
        this.pos += 2;
        name = this.parseGroupName();
        index = ++this.groupCount;
        this.namedGroups.push({ name, path: this.pathStack.map((f) => ({ ...f })), at: start });
      } else if (c2 === "P") {
        this.fail("python-style group (?P<...>) is not valid ECMAScript", this.pos);
      } else {
        this.pos++; // consume "?"; parseModifiers reads the flag list that follows
        modifiers = this.parseModifiers();
        capturing = false;
      }
    } else {
      index = ++this.groupCount;
    }
    const body = this.parseDisjunction();
    if (this.peek() !== ")") this.fail("unterminated group");
    this.pos++;
    return { type: "group", capturing, name, index, modifiers, body, start, end: this.pos };
  }

  /** Parse a `(?<name>` identifier (cursor already past `(?<`), leaving it after `>`. */
  private parseGroupName(): string {
    const start = this.pos;
    let name = "";
    while (this.pos < this.src.length && this.peek() !== ">") name += this.readLiteral().value;
    if (this.peek() !== ">") this.fail("unterminated group name", start);
    this.pos++;
    if (name.length === 0) this.fail("empty group name", start);
    const first = String.fromCodePoint(name.codePointAt(0) ?? 0);
    if (!ID_START.test(first) && first !== "$" && first !== "_") this.fail("invalid group name", start);
    for (const ch of name) {
      if (!ID_CONTINUE.test(ch) && ch !== "$" && ch !== "_" && ch !== ZWNJ && ch !== ZWJ) {
        this.fail("invalid group name", start);
      }
    }
    return name;
  }

  /** Parse `(?ims-ims:` modifiers (cursor already past `(?`), leaving it after `:`. */
  private parseModifiers(): Group["modifiers"] {
    const start = this.pos;
    const readFlags = (): string => {
      let out = "";
      while ("ims".includes(this.peek() ?? "")) {
        const f = this.peek() as string;
        if (out.includes(f)) this.fail("duplicate modifier flag", this.pos);
        out += f;
        this.pos++;
      }
      return out;
    };
    const add = readFlags();
    let remove = "";
    if (this.peek() === "-") {
      this.pos++;
      remove = readFlags();
      if (remove.length === 0) this.fail("modifier group has empty removal set", start);
    }
    if (this.peek() !== ":") this.fail("invalid modifier group", start);
    if (add.length === 0 && remove.length === 0) this.fail("empty modifier group", start);
    this.pos++;
    return { add, remove };
  }

  private tryParseQuantifier(body: Node): Node | null {
    const c = this.peek();
    if (c !== "*" && c !== "+" && c !== "?" && c !== "{") return null;
    let min: number;
    let max: number | null;
    if (c === "{") {
      ({ min, max } = this.parseBraceQuantifier());
    } else {
      [min, max] = SIMPLE_QUANTIFIERS[c] as [number, number | null];
      this.pos++;
    }
    let lazy = false;
    if (this.peek() === "?") {
      lazy = true;
      this.pos++;
    }
    return { type: "quantifier", min, max, lazy, body, start: body.start, end: this.pos };
  }

  private parseBraceQuantifier(): { min: number; max: number | null } {
    const start = this.pos;
    this.pos++;
    const minDigits = this.readDigits();
    if (minDigits === "") this.fail("quantifier is missing a lower bound", start);
    const min = Number(minDigits);
    let max: number | null = min;
    if (this.peek() === ",") {
      this.pos++;
      const maxDigits = this.readDigits();
      max = maxDigits === "" ? null : Number(maxDigits);
    }
    if (this.peek() !== "}") this.fail("unterminated quantifier", start);
    this.pos++;
    if (max !== null && min > max) this.fail("quantifier lower bound exceeds upper bound", start);
    return { min, max };
  }

  private readDigits(): string {
    let out = "";
    while (this.peek() !== undefined && DIGIT.test(this.peek() as string)) out += this.src[this.pos++];
    return out;
  }

  private parseClass(): CharClass {
    const start = this.pos;
    this.pos++;
    let negated = false;
    if (this.peek() === "^") {
      negated = true;
      this.pos++;
    }
    const items: ClassItem[] = [];
    while (this.peek() !== "]") {
      if (this.pos >= this.src.length) this.fail("unterminated character class", start);
      const before = this.pos;
      const atom = this.parseClassAtom();
      if (atom.type === "literal" && this.peek() === "-" && this.peek(1) !== "]" && this.peek(1) !== undefined) {
        const dashAt = this.pos;
        this.pos++;
        const hi = this.parseClassAtom();
        if (hi.type !== "literal") this.fail("invalid character-class range bound", dashAt);
        if (atom.codePoint > hi.codePoint) this.fail("character-class range is out of order", dashAt);
        items.push({ type: "class-range", from: atom, to: hi, start: atom.start, end: hi.end });
      } else {
        items.push(atom);
      }
      if (this.pos === before) this.fail("parser made no progress in class"); // termination invariant
    }
    this.pos++;
    return { type: "char-class", negated, items, setOp: null, start, end: this.pos };
  }

  private parseClassAtom(): Literal | CharacterClassEscape | UnicodeProperty {
    if (this.peek() !== "\\") return this.readLiteral();
    const esc = this.parseEscape(true);
    if (esc.type === "literal" || esc.type === "class-escape" || esc.type === "unicode-property") return esc;
    this.fail("invalid escape in character class"); // backreferences never reach here
  }

  /** Parse one `\`-escape. `inClass` selects class semantics (`\b` = backspace, no backreferences). */
  private parseEscape(inClass: boolean): Node {
    const start = this.pos;
    this.pos++;
    const c = this.peek();
    if (c === undefined) this.fail("trailing backslash");
    if (CLASS_ESCAPE_LETTERS.has(c)) {
      this.pos++;
      return { type: "class-escape", letter: c as CharacterClassEscape["letter"], start, end: this.pos };
    }
    if (c === "p" || c === "P") {
      const r = readUnicodeProperty(this.src, start);
      if (!r.ok) this.fail(r.error, r.at);
      this.pos = r.end;
      return { type: "unicode-property", negated: c === "P", name: r.name, value: r.value, start, end: this.pos };
    }
    if (c === "b" && inClass) return this.oneCharEscape(start, 0x08);
    if (c === "B" && inClass) this.fail("invalid \\B in character class", start);
    if (c in CONTROL_ESCAPES) return this.oneCharEscape(start, CONTROL_ESCAPES[c] as number);
    if (c === "0") {
      if (this.peek(1) !== undefined && DIGIT.test(this.peek(1) as string)) {
        this.fail("octal escapes are not valid in unicode mode", start);
      }
      return this.oneCharEscape(start, 0x00);
    }
    if (DIGIT.test(c)) {
      if (inClass) this.fail("backreference is not valid in a character class", start);
      return this.parseNumericBackref(start);
    }
    if (c === "k") {
      if (inClass) this.fail("named backreference is not valid in a character class", start);
      return this.parseNamedBackref(start);
    }
    if (c === "c" || c === "x" || c === "u") {
      const r = readEscapeCodePoint(this.src, start);
      if (!r.ok) this.fail(r.error, r.at);
      this.pos = r.end;
      return this.charLiteral(start, r.codePoint);
    }
    if (inClass && c === "-") return this.oneCharEscape(start, 0x2d);
    if (SYNTAX_CHARS.has(c) || c === "/") return this.oneCharEscape(start, c.codePointAt(0) as number);
    this.fail(`invalid escape \\${c}`, start);
  }

  private parseNumericBackref(start: number): Backreference {
    const value = Number(this.readDigits());
    this.numericRefs.push({ value, at: start });
    return { type: "backreference", ref: value, raw: this.src.slice(start, this.pos), start, end: this.pos };
  }

  private parseNamedBackref(start: number): Backreference {
    this.pos++;
    if (this.peek() !== "<") this.fail("expected < after \\k", start);
    this.pos++;
    let name = "";
    while (this.pos < this.src.length && this.peek() !== ">") name += this.readLiteral().value;
    if (this.peek() !== ">") this.fail("unterminated named backreference", start);
    this.pos++;
    if (name.length === 0) this.fail("empty named backreference", start);
    this.namedRefs.push({ name, at: start });
    return { type: "backreference", ref: name, raw: this.src.slice(start, this.pos), start, end: this.pos };
  }

  private validateReferences(): void {
    for (const ref of this.numericRefs) {
      if (ref.value === 0 || ref.value > this.groupCount) {
        this.fail(`backreference \\${ref.value} has no matching group`, ref.at);
      }
    }
    const names = new Set(this.namedGroups.map((g) => g.name));
    for (const ref of this.namedRefs) {
      if (!names.has(ref.name)) this.fail(`named backreference \\k<${ref.name}> has no group`, ref.at);
    }
    this.validateDuplicateNames();
  }

  /**
   * ES2025 duplicate named-group rule (matches JavaScriptCore): a name may repeat only when the
   * groups are separated by different alternatives of a shared disjunction, so both can never match
   * at once. Every colliding pair must be separated.
   */
  private validateDuplicateNames(): void {
    for (let i = 0; i < this.namedGroups.length; i++) {
      for (let j = i + 1; j < this.namedGroups.length; j++) {
        const a = this.namedGroups[i] as NamedGroupRef;
        const b = this.namedGroups[j] as NamedGroupRef;
        if (a.name === b.name && !separated(a.path, b.path)) this.fail(`duplicate group name "${b.name}"`, b.at);
      }
    }
  }
}

/** True when two capture paths diverge into different alternatives of a common disjunction. */
function separated(p: readonly PathFrame[], q: readonly PathFrame[]): boolean {
  const n = Math.min(p.length, q.length);
  for (let i = 0; i < n; i++) {
    const pf = p[i] as PathFrame;
    const qf = q[i] as PathFrame;
    if (pf.disj !== qf.disj) return false;
    if (pf.alt !== qf.alt) return true;
  }
  return false;
}

/**
 * Parse a pattern under the ECMAScript unicode-mode grammar. Returns { ast } on success or
 * { error, at } on a syntax error (never throws). The `v` flag is rejected until V_MODE_ENABLED.
 */
export function parseRegex(pattern: string, flags = ""): ParseResult {
  if (flags.includes("v") && !V_MODE_ENABLED) {
    return { error: "regex/parse: the v-flag set-notation grammar is not enabled yet", at: 0 };
  }
  try {
    return { ast: new RegexParser(pattern).parse() };
  } catch (err) {
    if (err instanceof ParseError) return { error: err.message, at: err.at };
    throw err;
  }
}

// printRegex is re-exported so the keystone's public API (parse + print) reads from one module; the
// implementation lives in printer.ts to keep each file to one concept under the 500-line cap.
export { printRegex } from "./printer";
