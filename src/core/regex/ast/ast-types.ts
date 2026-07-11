/**
 * The regex Abstract Syntax Tree node union (REGEX-JEWEL-PLAN.md Phase R2X keystone). One typed
 * node per ECMAScript pattern construct, so every downstream jewel (explain, examples, ReDoS
 * lint, travel-lint) reads STRUCTURE instead of re-scanning the pattern string with more regex.
 *
 * Grammar scope: ECMAScript unicode-mode (the `u`-flag grammar). parser.ts parses every pattern
 * under these rules; the `v`-flag set-notation extensions are STAGED behind V_MODE_ENABLED and are
 * not represented here yet (CharClass carries a `setOp` seam left null until that lands).
 *
 * Every node carries a half-open source span [start, end) into the original pattern string, so a
 * ReDoS culprit or a travel-lint note can point the editor at the exact characters to underline.
 *
 * SAFETY: this is DATA describing a pattern, never executable. Compilation and matching stay in
 * core/regex/apply.ts under the sandbox doctrine.
 */

/** Half-open source span [start, end) into the pattern string a node was parsed from. */
export interface Span {
  start: number;
  end: number;
}

/** Top-level disjunction: `a|b|c`. Always the AST root, and the body of every group/lookaround. */
export interface Alternation extends Span {
  type: "alternation";
  alternatives: Sequence[];
}

/** A concatenation of terms: the `abc` in `abc|d`. One alternative of a disjunction. */
export interface Sequence extends Span {
  type: "sequence";
  elements: Node[];
}

/**
 * A single literal code point. `value` is the character (a surrogate pair counts as ONE code
 * point in unicode mode); `raw` is the exact source text (`a`, `\n`, `\x41`, `\u{1F600}`), which
 * printRegex emits verbatim so escaping round-trips; `codePoint` is the numeric value used for
 * class-range ordering.
 */
export interface Literal extends Span {
  type: "literal";
  value: string;
  raw: string;
  codePoint: number;
}

/** `.` - any code point (except line terminators, absent the `s` flag - a match-time concern). */
export interface Dot extends Span {
  type: "dot";
}

/** A zero-width assertion: `^`, `$`, `\b`, `\B`. */
export interface Anchor extends Span {
  type: "anchor";
  kind: "line-start" | "line-end" | "word-boundary" | "non-word-boundary";
}

/** A predefined class escape: `\d \D \w \W \s \S`. Valid both at top level and inside a class. */
export interface CharacterClassEscape extends Span {
  type: "class-escape";
  letter: "d" | "D" | "w" | "W" | "s" | "S";
}

/**
 * A Unicode property escape: `\p{Letter}`, `\P{Script=Greek}`. `name` is the property (or the lone
 * value form like `Letter`); `value` is the part after `=` when present. `negated` is the `\P` form.
 */
export interface UnicodeProperty extends Span {
  type: "unicode-property";
  negated: boolean;
  name: string;
  value?: string;
}

/** One member of a character class body: a single char, a range, or a class/property escape. */
export type ClassItem = Literal | ClassRange | CharacterClassEscape | UnicodeProperty;

/** A character range inside a class: `a-z`. Both bounds are literal code points (`from <= to`). */
export interface ClassRange extends Span {
  type: "class-range";
  from: Literal;
  to: Literal;
}

/**
 * A character class: `[abc]`, `[^a-z\d]`. `items` is a plain union in unicode mode. `setOp` is the
 * staged `v`-flag seam (intersection `&&` / subtraction `--`); it stays null until V_MODE_ENABLED.
 */
export interface CharClass extends Span {
  type: "char-class";
  negated: boolean;
  items: ClassItem[];
  setOp: null;
}

/** A repetition: `a*`, `a+?`, `a{2,4}`. `max` null means unbounded; `lazy` is the trailing `?`. */
export interface Quantifier extends Span {
  type: "quantifier";
  min: number;
  max: number | null;
  lazy: boolean;
  body: Node;
}

/** ES2025 inline modifiers on a non-capturing group: `(?i:...)`, `(?i-m:...)`. */
export interface GroupModifiers {
  add: string;
  remove: string;
}

/**
 * A group: capturing `(...)`, named `(?<name>...)`, non-capturing `(?:...)`, or a modifier group
 * `(?i-m:...)`. `index` is the 1-based capture number for capturing groups, null otherwise.
 */
export interface Group extends Span {
  type: "group";
  capturing: boolean;
  name: string | null;
  index: number | null;
  modifiers: GroupModifiers | null;
  body: Alternation;
}

/** A lookaround assertion: `(?=...)`, `(?!...)`, `(?<=...)`, `(?<!...)`. */
export interface Lookaround extends Span {
  type: "lookaround";
  ahead: boolean;
  negative: boolean;
  body: Alternation;
}

/** A backreference: numeric `\1` or named `\k<name>`. `raw` is the source form for printing. */
export interface Backreference extends Span {
  type: "backreference";
  ref: number | string;
  raw: string;
}

/** The full node union. The AST root is always an Alternation. */
export type Node =
  | Alternation
  | Sequence
  | Literal
  | Dot
  | Anchor
  | CharClass
  | CharacterClassEscape
  | UnicodeProperty
  | Quantifier
  | Group
  | Lookaround
  | Backreference;
