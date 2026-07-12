/**
 * The "Match by example" builder (REGEX-JEWEL-PLAN.md R3 Plain-words sub-mode), ported from RC's
 * `analyzePhrasePattern` (apps/rc/src/lib/lorebook/regex-utils.ts). Given a handful of example
 * phrases it detects their shared word-slot structure and emits one pattern that matches that shape:
 * constant slots stay literal, varying slots become alternations, and a slot whose words share a stem
 * collapses to `root(suffix|...)?`.
 *
 * Unicode gap-closer: the whole-word wrap routes through word-boundary.ts, so Korean/Cyrillic examples
 * get real word edges and space-less scripts drop the wrap honestly. By-example does NOT decompile
 * back to state (RC's decompile-null): editing the examples rebuilds; opening its pattern in words
 * mode is partial, by design.
 */
import { mergeUnicodeFlag, wrapWordBoundary } from "./word-boundary";

const escapeWord = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface PhraseSlot {
  position: number;
  variations: string[];
  isConstant: boolean;
  commonWord: string | null;
  suffixes: string[];
  root: string | null;
}

export interface PhrasePatternAnalysis {
  slots: PhraseSlot[];
  description: string;
  /** The pattern body WITHOUT the whole-word wrap (buildFromExamples applies the unicode-aware wrap). */
  core: string;
  /** Unique lower-cased tokens across all phrases - the boundary router reads their script. */
  sourceWords: string[];
  hasPattern: boolean;
}

/** Detect a shared-root + suffix family among slot words (rain, raining, rained). */
function detectSuffixPattern(words: readonly string[]): { root: string | null; suffixes: string[] } {
  if (words.length < 2) return { root: null, suffixes: [] };
  const sorted = [...words].sort((a, b) => a.length - b.length);
  const root = sorted[0]!;
  const matching = words.filter((w) => w.startsWith(root));
  if (matching.length < words.length * 0.7) return { root: null, suffixes: [] };
  const suffixes: string[] = [];
  for (const w of matching) {
    if (w === root) continue;
    const suffix = w.slice(root.length);
    if (suffix.length > 0 && suffix.length <= 5 && !suffixes.includes(suffix)) suffixes.push(suffix);
  }
  return suffixes.length > 0 ? { root, suffixes } : { root: null, suffixes: [] };
}

const uniqueTokens = (tokenized: readonly string[][]): string[] => [
  ...new Set(tokenized.flat()),
];

/** Analyze example phrases into a slot structure and a pattern body. Faithful port of RC's logic. */
export function analyzePhrasePattern(phrases: readonly string[]): PhrasePatternAnalysis {
  const cleaned = phrases.map((p) => p.trim().toLowerCase()).filter((p) => p.length > 0);

  if (cleaned.length === 0) {
    return { slots: [], description: "", core: "", sourceWords: [], hasPattern: false };
  }

  if (cleaned.length === 1) {
    const only = cleaned[0]!;
    return {
      slots: [{ position: 0, variations: [only], isConstant: true, commonWord: only, suffixes: [], root: null }],
      description: "Single phrase",
      core: escapeWord(only),
      sourceWords: only.split(/\s+/),
      hasPattern: false,
    };
  }

  const tokenized = cleaned.map((p) => p.split(/\s+/));
  const maxWords = Math.max(...tokenized.map((t) => t.length));
  const minWords = Math.min(...tokenized.map((t) => t.length));

  if (maxWords - minWords > 2) {
    const escaped = cleaned.map(escapeWord);
    return {
      slots: [],
      description: `${cleaned.length} phrase alternatives`,
      core: `(${escaped.join("|")})`,
      sourceWords: uniqueTokens(tokenized),
      hasPattern: false,
    };
  }

  const slots: PhraseSlot[] = [];
  for (let pos = 0; pos < maxWords; pos++) {
    const wordsAtPos = tokenized.filter((t) => t.length > pos).map((t) => t[pos]!);
    const unique = [...new Set(wordsAtPos)];
    const isConstant = unique.length === 1 && wordsAtPos.length === tokenized.length;
    const suffix = detectSuffixPattern(unique);
    slots.push({
      position: pos,
      variations: suffix.root ? [suffix.root] : unique,
      isConstant,
      commonWord: isConstant ? unique[0]! : null,
      suffixes: suffix.suffixes,
      root: suffix.root,
    });
  }

  const parts = slots.map((slot) => {
    if (slot.isConstant && slot.commonWord) return escapeWord(slot.commonWord);
    if (slot.root && slot.suffixes.length > 0) {
      return `${escapeWord(slot.root)}(${slot.suffixes.map(escapeWord).join("|")})?`;
    }
    const escaped = slot.variations.map(escapeWord);
    return escaped.length === 1 ? escaped[0]! : `(${escaped.join("|")})`;
  });

  const variableSlots = slots.filter((s) => !s.isConstant || s.suffixes.length > 0);
  const description =
    variableSlots.length > 0
      ? `Detected ${variableSlots.length} variable slot${variableSlots.length > 1 ? "s" : ""} in phrase structure`
      : `${cleaned.length} phrase alternatives`;

  return {
    slots,
    description,
    core: parts.join("\\s+"),
    sourceWords: uniqueTokens(tokenized),
    hasPattern: variableSlots.length > 0,
  };
}

export interface ExampleBuilt {
  pattern: string;
  flags: string;
  analysis: PhrasePatternAnalysis;
}

export interface ExampleOptions {
  caseSensitive?: boolean;
}

/**
 * Build a find/flags pair from example phrases. Wraps the analyzed core in a unicode-aware whole-word
 * boundary and defaults to case-insensitive (drop with `caseSensitive`). Empty input -> empty pattern.
 */
export function buildFromExamples(phrases: readonly string[], options?: ExampleOptions): ExampleBuilt {
  const analysis = analyzePhrasePattern(phrases);
  if (analysis.core === "") return { pattern: "", flags: "", analysis };

  const wrapped = wrapWordBoundary(analysis.core, analysis.sourceWords);
  const flags = mergeUnicodeFlag(options?.caseSensitive ? "" : "i", wrapped.needsU);
  try {
    new RegExp(wrapped.pattern, flags);
  } catch {
    return { pattern: "", flags: "", analysis };
  }
  return { pattern: wrapped.pattern, flags, analysis };
}
