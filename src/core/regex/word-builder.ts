/**
 * The "Match these words" builder (REGEX-JEWEL-PLAN.md R3 Plain-words sub-mode), ported from RC's
 * `buildPatternFromState` / `decompileToBuilderState` (apps/rc/src/lib/regex/builder-core.ts). Two
 * pure functions that are inverses over the builder's own grammar:
 *   buildWordsPattern    - a words state -> a find/flags pair (+ family warning, optimize list).
 *   decompileWordsState  - a find/flags pair -> the words state that rebuilds it, or null when the
 *                          pattern is outside this grammar (kept in Pattern mode, RC's decompile-null).
 *
 * Two gaps RC has are closed here (the coverage-honesty ruling): whole-word wrapping is unicode-aware
 * (word-boundary.ts routes Korean/Cyrillic to lookarounds and space-less scripts to an honest drop),
 * and decompile accepts the `u` flag those rules carry. The `description` is vaud's AST-backed reading
 * (explainPattern), not RC's substring heuristic; example chips are the UI's job (readout.ts), so this
 * stays a pure, rng-free build.
 */
import { explainPattern } from "./builder";
import { analyzeWordFamily } from "./word-family";
import { mergeUnicodeFlag, unwrapWordBoundary, wrapWordBoundary } from "./word-boundary";

export interface WordsBuilderState {
  /** Comma-separated words/phrases to match. */
  wordsInput: string;
  /** Comma-separated words that must NOT match (negative lookahead). */
  excludeWords: string;
  /** Also match the word flanked by digits (`\d*word\d*`). */
  allowNumbers: boolean;
  /** Comma-separated optional trailing endings, e.g. "s, es, ing". */
  optionalSuffixes: string;
  /** Comma-separated text the match must NOT be followed by. */
  mustNotBeFollowedBy: string;
  /** Comma-separated text the match MUST be followed by. */
  mustBeFollowedBy: string;
  /** Wrap the whole thing in a whole-word boundary (unicode-aware). */
  wholeWordsOnly: boolean;
  /** Match capitals and lowercase as different (drops the `i` flag). */
  caseSensitive: boolean;
}

export const EMPTY_WORDS_STATE: WordsBuilderState = {
  wordsInput: "",
  excludeWords: "",
  allowNumbers: false,
  optionalSuffixes: "",
  mustNotBeFollowedBy: "",
  mustBeFollowedBy: "",
  wholeWordsOnly: true,
  caseSensitive: false,
};

export interface WordsBuilt {
  pattern: string;
  flags: string;
  error?: string;
  /** AST-backed plain reading of the built pattern (explainPattern), or "" when empty/unreadable. */
  description: string;
  /** Family "ordering matters" note, or null. */
  familyWarning: string | null;
  /** The words sorted longest-first (the optimize-chip target). */
  optimizedWords: string[];
  /** True when whole-word matching was honestly dropped for a space-less script. */
  wholeWordDropped: boolean;
}

/** The exact escape set the builder uses; shared by build and decompile so they agree on "special". */
const REGEX_SPECIALS = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);
const escapeWord = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const splitList = (v: string): string[] =>
  v.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

const emptyBuilt = (familyWarning: string | null, optimizedWords: string[]): WordsBuilt => ({
  pattern: "",
  flags: "",
  description: "",
  familyWarning,
  optimizedWords,
  wholeWordDropped: false,
});

/**
 * Build a find/flags pair from a words state. Byte-compatible with RC for ASCII input; unicode input
 * routes the whole-word wrap through word-boundary.ts (lookarounds + `u`, or an honest drop).
 */
export function buildWordsPattern(state: WordsBuilderState): WordsBuilt {
  const words = splitList(state.wordsInput);
  const analysis = analyzeWordFamily(words);
  const familyWarning = analysis.warning;
  const optimizedWords = analysis.optimizedWords.filter((w) => !analysis.coveringWords.includes(w));

  if (words.length === 0) return emptyBuilt(familyWarning, optimizedWords);

  try {
    const deduped = [...new Set(words)];
    const sorted = [...deduped].sort((a, b) => b.length - a.length);
    const escaped = sorted.map(escapeWord);
    const wordPatterns = escaped.map((w) => (state.allowNumbers ? `\\d*${w}\\d*` : w));

    let pattern = wordPatterns.length === 1 ? wordPatterns[0]! : `(${wordPatterns.join("|")})`;

    const suffixes = splitList(state.optionalSuffixes);
    if (suffixes.length > 0) pattern = `${pattern}(${suffixes.map(escapeWord).join("|")})?`;

    const excludes = splitList(state.excludeWords);
    if (excludes.length > 0) {
      pattern = `(?!.*\\b(${excludes.map(escapeWord).join("|")})\\b)${pattern}`;
    }

    const notFollowed = splitList(state.mustNotBeFollowedBy);
    if (notFollowed.length > 0) pattern = `${pattern}(?!(${notFollowed.map(escapeWord).join("|")}))`;

    const followed = splitList(state.mustBeFollowedBy);
    if (followed.length > 0) pattern = `${pattern}(?=(${followed.map(escapeWord).join("|")}))`;

    let flags = state.caseSensitive ? "" : "i";
    let wholeWordDropped = false;
    if (state.wholeWordsOnly) {
      const wrapped = wrapWordBoundary(pattern, words);
      pattern = wrapped.pattern;
      flags = mergeUnicodeFlag(flags, wrapped.needsU);
      wholeWordDropped = wrapped.wholeWordDropped;
    }

    new RegExp(pattern, flags); // validate; a bad pattern throws to the catch below

    const explained = explainPattern(pattern, flags);
    return {
      pattern,
      flags,
      description: explained.reading ?? "",
      familyWarning,
      optimizedWords,
      wholeWordDropped,
    };
  } catch (e) {
    return { ...emptyBuilt(familyWarning, optimizedWords), error: e instanceof Error ? e.message : "Invalid regex" };
  }
}

// ---------------------------------------------------------------------------
// decompile
// ---------------------------------------------------------------------------

/** Turn one escaped literal alternative back into its word, or null if it is not a plain word. */
function unescapeWord(member: string): string | null {
  let out = "";
  for (let i = 0; i < member.length; i++) {
    const c = member[i];
    if (c === "\\") {
      const next = member[i + 1];
      if (next === undefined || !REGEX_SPECIALS.has(next)) return null;
      out += next;
      i++;
      continue;
    }
    if (c === undefined || REGEX_SPECIALS.has(c)) return null;
    out += c;
  }
  return escapeWord(out) === member ? out : null;
}

/** Split an alternation body on top-level `|`, honoring escapes; null on a nested group. */
function splitAlternation(inner: string): string[] | null {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\") {
      cur += c + (inner[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === "(" || c === ")") return null;
    if (c === "|") {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

/** Decode a comma-list group body (exclude / suffix / followed) into words, or null. */
function decodeGroup(body: string): string | null {
  const split = splitAlternation(body);
  if (!split) return null;
  const words: string[] = [];
  for (const m of split) {
    const w = unescapeWord(m);
    if (w === null) return null;
    words.push(w);
  }
  return words.join(", ");
}

/** Parse the alternation/word core into its words + the allowNumbers flag. */
function parseCore(core: string): { words: string[]; allowNumbers: boolean } | null {
  if (core.length === 0) return null;

  let members: string[];
  if (core.startsWith("(") && core.endsWith(")")) {
    let depth = 0;
    for (let i = 0; i < core.length; i++) {
      const c = core[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0 && i !== core.length - 1) return null;
      }
    }
    if (depth !== 0) return null;
    const split = splitAlternation(core.slice(1, -1));
    if (!split) return null;
    members = split;
  } else {
    const split = splitAlternation(core);
    if (!split || split.length !== 1) return null;
    members = split;
  }

  if (members.some((m) => m.length === 0)) return null;

  const wrapped = members.map((m) => /^\\d\*[\s\S]+\\d\*$/.test(m));
  let allowNumbers = false;
  if (wrapped.every(Boolean)) {
    allowNumbers = true;
    members = members.map((m) => m.slice(3, -3));
  } else if (wrapped.some(Boolean)) {
    return null;
  }

  const decoded: string[] = [];
  for (const m of members) {
    const word = unescapeWord(m);
    if (word === null) return null;
    decoded.push(word);
  }
  return { words: decoded, allowNumbers };
}

/**
 * Reverse the shapes buildWordsPattern emits. Returns a words state that rebuilds the same
 * find/flags, or null for any pattern outside the builder's grammar. Accepts the `u` flag (and its
 * unicode lookaround boundary) so a saved unicode words rule re-opens in words mode.
 */
export function decompileWordsState(pattern: string, flags: string): WordsBuilderState | null {
  const known = new Set(["i", "u"]);
  if ([...flags].some((f) => !known.has(f))) return null;
  if (!pattern) return null;

  const unwrapped = unwrapWordBoundary(pattern);
  const wholeWordsOnly = unwrapped.wholeWord;
  let p = unwrapped.core;

  let excludeWords = "";
  const exMatch = p.match(/^\(\?!\.\*\\b\(([\s\S]*?)\)\\b\)/);
  if (exMatch) {
    const decoded = decodeGroup(exMatch[1]!);
    if (decoded === null) return null;
    excludeWords = decoded;
    p = p.slice(exMatch[0].length);
  }

  let mustBeFollowedBy = "";
  const beMatch = p.match(/^([\s\S]*)\(\?=\(([\s\S]*)\)\)$/);
  if (beMatch) {
    const decoded = decodeGroup(beMatch[2]!);
    if (decoded === null) return null;
    mustBeFollowedBy = decoded;
    p = beMatch[1]!;
  }

  let mustNotBeFollowedBy = "";
  const nfMatch = p.match(/^([\s\S]*)\(\?!\(([\s\S]*)\)\)$/);
  if (nfMatch) {
    const decoded = decodeGroup(nfMatch[2]!);
    if (decoded === null) return null;
    mustNotBeFollowedBy = decoded;
    p = nfMatch[1]!;
  }

  let optionalSuffixes = "";
  const sufMatch = p.match(/^([\s\S]+)\(([\s\S]*)\)\?$/);
  if (sufMatch) {
    const decoded = decodeGroup(sufMatch[2]!);
    if (decoded === null) return null;
    optionalSuffixes = decoded;
    p = sufMatch[1]!;
  }

  const core = parseCore(p);
  if (!core) return null;

  return {
    wordsInput: core.words.join(", "),
    excludeWords,
    allowNumbers: core.allowNumbers,
    optionalSuffixes,
    mustNotBeFollowedBy,
    mustBeFollowedBy,
    wholeWordsOnly,
    caseSensitive: !flags.includes("i"),
  };
}
