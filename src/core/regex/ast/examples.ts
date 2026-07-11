/**
 * Execution-verified example generation over the regex AST (REGEX-JEWEL-PLAN.md Phase R2X, QOL 21).
 * `examplesFor` walks the ast-types.ts tree with a seeded random walk to PROPOSE candidate strings,
 * then the one law that makes this honest: every emitted match is executed against the real compiled
 * regex and MUST match; every emitted near-miss is executed and MUST fail. Candidates that do not
 * hold the property are dropped silently (an over-tight lookaround, a wrong unicode-property guess),
 * so coverage degrades honestly rather than lying. The verifier is the only load-bearing code here:
 * generation quality changes yield, never correctness.
 *
 * PURITY: no Math.random / Date - all randomness comes from the injected `opts.rng` (a seeded unit
 * generator), so output is deterministic per seed. The engine that runs the compiled RegExp is a
 * String.test call over data, never eval (sandbox doctrine).
 *
 * FLAGS DEVIATION (reality-wins, same clause apply.ts used for its injected `now`): the plan sketch
 * wrote `opts { rng, count }`, but "the real compiled regex" is pattern + flags, and the AST carries
 * no flags. So `flags` is part of opts. It is normalized before compiling: `u` is forced (the
 * unicode-mode parser guarantees printRegex output is u-valid, and any \p{...} / \u{...} node is only
 * valid under `u`), and `g`/`y` are stripped so `.test()` is stateless. `v`/`d` and unknown chars are
 * dropped. `i`/`m`/`s` are kept because they change what matches.
 */
import type {
  Alternation,
  CharClass,
  ClassItem,
  Node,
  UnicodeProperty,
} from "./ast-types";
import { printRegex } from "./printer";

/** How far past a quantifier's lower bound a random walk may repeat an unbounded/wide body. */
const REPEAT_SPREAD = 3;

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const WORD = LOWER + UPPER + DIGITS + "_";
const NON_WORD = " \t.-!@#/";
const WHITESPACE = " \t";
const NON_SPACE = LOWER + UPPER + DIGITS + "._-";
const NON_DIGIT = LOWER + UPPER + " ._-";
/** `.` output: any code point except a line terminator (safe whether or not the `s` flag is set). */
const DOT_ALPHABET = LOWER + UPPER + DIGITS + " ._-";
/** Diverse pool for fuzz candidates and character-class fallbacks; includes a couple of scripts. */
const FUZZ_ALPHABET = LOWER + UPPER + DIGITS + " \t._-!@#$?αΩБ你";

/** Best-guess single representative per unicode property; the verifier drops any wrong guess. */
const PROPERTY_REP: Record<string, string> = {
  l: "a",
  letter: "a",
  lu: "A",
  uppercase: "A",
  ll: "a",
  lowercase: "a",
  n: "5",
  nd: "5",
  number: "5",
  p: ".",
  punctuation: ".",
  s: " ",
  space: " ",
  white_space: " ",
  latin: "a",
  greek: "α",
  cyrillic: "Б",
  han: "你",
  alphabetic: "a",
};

export interface ExamplesOptions {
  /** Injected seeded unit generator in [0, 1); the ONLY randomness source (purity contract). */
  rng: () => number;
  /** Upper bound on how many matches and how many near-misses to return. */
  count: number;
  /** The rule's flags; normalized before compiling (see header). Omitted defaults to "u". */
  flags?: string;
  /** Optional cap on generation attempts per bucket (defaults scale with `count`). */
  maxAttempts?: number;
}

export interface ExamplesResult {
  /** Strings the compiled regex matches (execution-verified, never empty strings). */
  matches: string[];
  /** Strings the compiled regex does NOT match, kept close to the grammar (execution-verified). */
  nearMisses: string[];
}

interface WalkCtx {
  rng: () => number;
  /** Captured group text keyed by "#<index>" and "@<name>", read back by backreferences. */
  captures: Map<string, string>;
}

const numKey = (index: number): string => `#${index}`;
const nameKey = (name: string): string => `@${name}`;

/** Pick a random element of a non-empty array; index clamped so an rng of 1 cannot overflow. */
function pick<T>(items: readonly T[], rng: () => number): T {
  const i = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[i] as T;
}

/** Pick a random character of a non-empty string. */
function pickChar(source: string, rng: () => number): string {
  const i = Math.min(source.length - 1, Math.floor(rng() * source.length));
  return source[i] as string;
}

/** Inclusive random integer in [lo, hi] (hi clamped to >= lo). */
function randInt(rng: () => number, lo: number, hi: number): number {
  const top = Math.max(lo, hi);
  return lo + Math.floor(rng() * (top - lo + 1));
}

/** Normalize caller flags to a stateless, u-forced set (see header FLAGS DEVIATION). */
function normalizeFlags(raw: string | undefined): string {
  const kept = new Set<string>(["u"]);
  for (const c of raw ?? "") {
    if (c === "i" || c === "m" || c === "s") kept.add(c);
  }
  return [...kept].join("");
}

/** A representative in-class char for a predefined class escape; correct by construction. */
function sampleClassEscape(letter: string, rng: () => number): string {
  switch (letter) {
    case "d":
      return pickChar(DIGITS, rng);
    case "D":
      return pickChar(NON_DIGIT, rng);
    case "w":
      return pickChar(WORD, rng);
    case "W":
      return pickChar(NON_WORD, rng);
    case "s":
      return pickChar(WHITESPACE, rng);
    default:
      return pickChar(NON_SPACE, rng);
  }
}

/** A best-guess representative for a unicode property; the verifier drops it if wrong. */
function sampleProperty(node: UnicodeProperty, rng: () => number): string {
  const key = (node.value ?? node.name).toLowerCase();
  const rep = PROPERTY_REP[key] ?? "a";
  if (!node.negated) return rep;
  // Negated: flip letter <-> digit as a crude "outside" guess; fuzz + verifier carry the rest.
  return /[a-z]/i.test(rep) ? "5" : "a";
}

/** Literal member values of a class body (used to steer negated-class fallbacks away from them). */
function literalValues(items: readonly ClassItem[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (item.type === "literal") out.push(item.value);
  }
  return out;
}

/** Candidate in-class characters gathered from every item of a (non-negated) class body. */
function classPositiveChars(items: readonly ClassItem[], rng: () => number): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (item.type === "literal") {
      out.push(item.value);
    } else if (item.type === "class-range") {
      const lo = item.from.codePoint;
      const hi = item.to.codePoint;
      out.push(item.from.value, item.to.value, String.fromCodePoint(lo + Math.floor((hi - lo) / 2)));
    } else if (item.type === "class-escape") {
      out.push(sampleClassEscape(item.letter, rng));
    } else {
      out.push(sampleProperty(item, rng));
    }
  }
  return out;
}

/** Sample one character satisfying a character class (negated classes fall back and lean on verify). */
function sampleClass(node: CharClass, ctx: WalkCtx): string {
  if (!node.negated) {
    const cands = classPositiveChars(node.items, ctx.rng);
    return cands.length > 0 ? pick(cands, ctx.rng) : pickChar(FUZZ_ALPHABET, ctx.rng);
  }
  const banned = new Set(literalValues(node.items));
  for (let i = 0; i < 12; i++) {
    const c = pickChar(FUZZ_ALPHABET, ctx.rng);
    if (!banned.has(c)) return c;
  }
  return pickChar(FUZZ_ALPHABET, ctx.rng);
}

/**
 * Emit one candidate string for a node via random walk. Zero-width nodes (anchors, lookarounds)
 * emit nothing and rely on the verifier + fuzz pass; every string still passes through `test` before
 * it is ever returned, so a walk that violates an assertion is dropped, not shown.
 */
function generate(node: Node, ctx: WalkCtx): string {
  switch (node.type) {
    case "alternation":
      return generate(pick(node.alternatives, ctx.rng), ctx);
    case "sequence":
      return node.elements.map((element) => generate(element, ctx)).join("");
    case "literal":
      return node.value;
    case "dot":
      return pickChar(DOT_ALPHABET, ctx.rng);
    case "anchor":
      return "";
    case "class-escape":
      return sampleClassEscape(node.letter, ctx.rng);
    case "unicode-property":
      return sampleProperty(node, ctx.rng);
    case "char-class":
      return sampleClass(node, ctx);
    case "quantifier": {
      const hi = node.max === null ? node.min + REPEAT_SPREAD : Math.min(node.max, node.min + REPEAT_SPREAD);
      const times = randInt(ctx.rng, node.min, hi);
      let out = "";
      for (let i = 0; i < times; i++) out += generate(node.body, ctx);
      return out;
    }
    case "group": {
      const text = generate(node.body, ctx);
      if (node.capturing && node.index !== null) {
        ctx.captures.set(numKey(node.index), text);
        if (node.name) ctx.captures.set(nameKey(node.name), text);
      }
      return text;
    }
    case "lookaround":
      return "";
    case "backreference": {
      const key = typeof node.ref === "number" ? numKey(node.ref) : nameKey(node.ref);
      return ctx.captures.get(key) ?? "";
    }
    default:
      return assertNever(node);
  }
}

function assertNever(value: never): never {
  throw new Error(`regex/examples: unhandled node ${JSON.stringify(value)}`);
}

/** Stateless match test (flags carry no g/y after normalization, so lastIndex never applies). */
function matchesRegex(re: RegExp, text: string): boolean {
  re.lastIndex = 0;
  return re.test(text);
}

/** A short random string from the diverse fuzz alphabet. */
function fuzzString(rng: () => number): string {
  const len = randInt(rng, 1, 8);
  let out = "";
  for (let i = 0; i < len; i++) out += pickChar(FUZZ_ALPHABET, rng);
  return out;
}

/** A handful of single-edit variants of a seed string (near-miss seeds for anchored patterns). */
function mutations(seed: string, rng: () => number): string[] {
  const out: string[] = [];
  if (seed.length > 0) {
    const i = randInt(rng, 0, seed.length - 1);
    out.push(seed.slice(0, i) + pickChar(FUZZ_ALPHABET, rng) + seed.slice(i + 1));
    out.push(seed.slice(0, i) + seed.slice(i + 1));
  }
  out.push(seed + pickChar(FUZZ_ALPHABET, rng));
  out.push(pickChar(FUZZ_ALPHABET, rng) + seed);
  return out;
}

function attemptsFor(count: number, override: number | undefined): number {
  return override ?? Math.max(300, count * 50);
}

/** Collect up to `count` execution-verified match strings (walk first, fuzz to rescue yield). */
function collectMatches(ast: Alternation, re: RegExp, opts: ExamplesOptions): string[] {
  const want = Math.max(0, opts.count);
  if (want === 0) return [];
  const attempts = attemptsFor(want, opts.maxAttempts);
  const found = new Set<string>();

  for (let i = 0; i < attempts && found.size < want; i++) {
    const candidate = generate(ast, { rng: opts.rng, captures: new Map() });
    if (candidate.length > 0 && matchesRegex(re, candidate)) found.add(candidate);
  }
  for (let i = 0; i < attempts && found.size < want; i++) {
    const candidate = fuzzString(opts.rng);
    if (candidate.length > 0 && matchesRegex(re, candidate)) found.add(candidate);
  }
  return [...found].slice(0, want);
}

/** Collect up to `count` execution-verified non-matching strings (mutations first, fuzz to fill). */
function collectNearMisses(
  re: RegExp,
  opts: ExamplesOptions,
  matches: readonly string[],
): string[] {
  const want = Math.max(0, opts.count);
  if (want === 0) return [];
  const attempts = attemptsFor(want, opts.maxAttempts);
  const found = new Set<string>();

  for (const seed of matches) {
    if (found.size >= want) break;
    for (const variant of mutations(seed, opts.rng)) {
      if (variant.length > 0 && !matchesRegex(re, variant)) found.add(variant);
      if (found.size >= want) break;
    }
  }
  for (let i = 0; i < attempts && found.size < want; i++) {
    const candidate = fuzzString(opts.rng);
    if (candidate.length > 0 && !matchesRegex(re, candidate)) found.add(candidate);
  }
  return [...found].slice(0, want);
}

/**
 * Generate execution-verified example strings for a parsed pattern: strings the compiled regex
 * matches, and near-miss strings it rejects. If the printed pattern cannot compile (it always
 * should for a real AST), everything is unverifiable and both lists come back empty - never a guess.
 */
export function examplesFor(ast: Alternation, opts: ExamplesOptions): ExamplesResult {
  const flags = normalizeFlags(opts.flags);
  let re: RegExp;
  try {
    re = new RegExp(printRegex(ast), flags);
  } catch {
    return { matches: [], nearMisses: [] };
  }
  const matches = collectMatches(ast, re, opts);
  const nearMisses = collectNearMisses(re, opts, matches);
  return { matches, nearMisses };
}
