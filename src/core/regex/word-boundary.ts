/**
 * Unicode-aware whole-word boundaries for the NL builders (REGEX-JEWEL-PLAN.md R3 port scope,
 * gap-closer #1). JS `\b` is ASCII-only even under the `u` flag, so wrapping a Korean or Cyrillic
 * word in `\b...\b` silently matches nothing useful. This one helper is the single source of truth
 * for how the words / by-example builders wrap a core, and how their decompilers unwrap it, so build
 * and decompile can never disagree.
 *
 * Three routes, decided by the SOURCE WORDS (not the built pattern):
 *  - pure ASCII         -> `\b core \b`, no `u` flag (unchanged legacy behavior).
 *  - non-ASCII, spaced  -> lookaround boundaries `(?<![\p{L}\p{N}_]) core (?![\p{L}\p{N}_])` + `u`
 *                          flag. Hangul, Cyrillic, Greek, accented Latin, Arabic: real word edges.
 *  - space-less script  -> DROP the whole-word wrap honestly (Han, Hiragana, Katakana, Thai have no
 *                          word gaps in running text, so a boundary is meaningless) - `core` as-is,
 *                          with `wholeWordDropped` true so the UI can say so plainly.
 *
 * The `\p{L}` lookarounds REQUIRE the `u` flag; `needsU` is the caller's signal to merge it in, or
 * `new RegExp` throws and the build degrades to empty. SAFETY: this returns pattern DATA; the
 * compiled RegExp only ever runs inside core/regex/apply.ts under the sandbox budget.
 */

/** Lookaround boundary fragments (unicode letter/number/underscore = a "word" character). */
export const WB_LOOKBEHIND = "(?<![\\p{L}\\p{N}_])";
export const WB_LOOKAHEAD = "(?![\\p{L}\\p{N}_])";

/**
 * Code points in scripts written without spaces between words, so a whole-word boundary carries
 * no meaning: Hiragana + Katakana (U+3040-30FF), CJK ext-A (U+3400-4DBF), CJK unified
 * (U+4E00-9FFF), CJK compatibility ideographs (U+F900-FAFF), and Thai (U+0E00-0E7F). Korean
 * Hangul is deliberately absent - modern Korean is space-separated, so it takes the lookaround
 * route.
 */
const SPACELESS_RANGES: readonly [number, number][] = [
  [0x3040, 0x30ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xf900, 0xfaff],
  [0x0e00, 0x0e7f],
];

const inRanges = (cp: number, ranges: readonly [number, number][]): boolean =>
  ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

/** True when any source word contains a code point from a space-less script. */
const hasSpaceless = (words: readonly string[]): boolean =>
  words.some((w) => [...w].some((ch) => inRanges(ch.codePointAt(0) ?? 0, SPACELESS_RANGES)));

/** True when any source word contains a non-ASCII code point (the trigger to leave the  route). */
const hasNonAscii = (words: readonly string[]): boolean =>
  words.some((w) => [...w].some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f));

export interface BoundaryWrap {
  /** The core wrapped with whichever boundary route the source words demand. */
  pattern: string;
  /** True when the pattern uses `\p{...}` lookarounds and the caller must ensure a `u` flag. */
  needsU: boolean;
  /** True when whole-word matching was dropped because the script has no word gaps. */
  wholeWordDropped: boolean;
}

/**
 * Wrap `core` in the whole-word boundary appropriate to its source words. Callers that do NOT want
 * whole-word matching should not call this at all; it always wraps (or honestly drops) rather than
 * pass through silently.
 */
export function wrapWordBoundary(core: string, sourceWords: readonly string[]): BoundaryWrap {
  if (hasSpaceless(sourceWords)) {
    return { pattern: core, needsU: false, wholeWordDropped: true };
  }
  if (hasNonAscii(sourceWords)) {
    return { pattern: `${WB_LOOKBEHIND}${core}${WB_LOOKAHEAD}`, needsU: true, wholeWordDropped: false };
  }
  return { pattern: `\\b${core}\\b`, needsU: false, wholeWordDropped: false };
}

/** Merge the `u` flag into a flags string when the boundary route needs it (idempotent). */
export function mergeUnicodeFlag(flags: string, needsU: boolean): string {
  if (!needsU || flags.includes("u")) return flags;
  return `${flags}u`;
}

/**
 * Strip whichever whole-word boundary route wraps `pattern`, returning the bare core and whether a
 * boundary was present. Recognizes both the ASCII `\b...\b` shape and the unicode lookaround shape,
 * so a saved unicode words rule re-opens in words mode instead of falling to partial.
 */
export function unwrapWordBoundary(pattern: string): { core: string; wholeWord: boolean } {
  if (pattern.startsWith("\\b") && pattern.endsWith("\\b") && pattern.length > 4) {
    return { core: pattern.slice(2, -2), wholeWord: true };
  }
  const min = WB_LOOKBEHIND.length + WB_LOOKAHEAD.length;
  if (pattern.startsWith(WB_LOOKBEHIND) && pattern.endsWith(WB_LOOKAHEAD) && pattern.length > min) {
    return { core: pattern.slice(WB_LOOKBEHIND.length, -WB_LOOKAHEAD.length), wholeWord: true };
  }
  return { core: pattern, wholeWord: false };
}
