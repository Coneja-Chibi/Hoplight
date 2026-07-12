/**
 * Word-family analysis for the "Match these words" builder (REGEX-JEWEL-PLAN.md R3, ported from RC's
 * `analyzeWordFamily` in apps/rc/src/lib/lorebook/regex-utils.ts). Pure: given a word list it reports
 * a shared stem, a longest-first ordering (so a longer alternative is tried before a prefix of it),
 * and an "odd one out" warning when one word sits inside another. Drives the optimize chip + the
 * family warning line; never builds a pattern itself.
 *
 * House-rule deviation from the RC source: the warning is emitted with a colon, never an em dash.
 */

export interface WordFamilyAnalysis {
  /** The shared stem (longest common substring >= 3 chars), or null when there is none. */
  root: string | null;
  /** The cleaned, deduped input words. */
  words: string[];
  /** True when a meaningful shared-stem / suffix family was detected. */
  hasPattern: boolean;
  /** One plain-language summary of what the analysis saw. */
  description: string;
  /** Words that contain a shorter sibling (the "covering" words), longest-first ordering aid. */
  coveringWords: string[];
  /** The words sorted longest-first - the order the pattern should try them in. */
  optimizedWords: string[];
  /** A plain "ordering matters" note when one word sits inside another, else null. */
  warning: string | null;
}

const clean = (words: readonly string[]): string[] => [
  ...new Set(words.map((w) => w.trim()).filter((w) => w.length > 0)),
];

/** Longest common substring of two strings, compared case-insensitively. */
function longestCommonSubstring(a: string, b: string): string {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  let longest = "";
  for (let i = 0; i < s1.length; i++) {
    for (let j = 0; j < s2.length; j++) {
      let k = 0;
      while (i + k < s1.length && j + k < s2.length && s1[i + k] === s2[j + k]) k++;
      if (k > longest.length) longest = s1.substring(i, i + k);
    }
  }
  return longest;
}

const MIN_ROOT = 3;

/**
 * Analyze a word list for a shared stem, containment, and suffix family. Faithful port of RC's
 * behavior; the only change is the colon-not-em-dash warning wording.
 */
export function analyzeWordFamily(words: readonly string[]): WordFamilyAnalysis {
  const cleaned = clean(words);

  const base: WordFamilyAnalysis = {
    root: null,
    words: cleaned,
    hasPattern: false,
    description: "",
    coveringWords: [],
    optimizedWords: cleaned,
    warning: null,
  };

  if (cleaned.length === 0) return { ...base, words: [], optimizedWords: [] };
  if (cleaned.length === 1) {
    return { ...base, root: cleaned[0] ?? null, description: `Single word: "${cleaned[0]}"` };
  }

  const sortedByLength = [...cleaned].sort((a, b) => b.length - a.length);

  const containment: { container: string; contained: string }[] = [];
  for (let i = 0; i < sortedByLength.length; i++) {
    for (let j = i + 1; j < sortedByLength.length; j++) {
      const longer = (sortedByLength[i] ?? "").toLowerCase();
      const shorter = (sortedByLength[j] ?? "").toLowerCase();
      if (shorter.length > 0 && longer.includes(shorter)) {
        containment.push({ container: sortedByLength[i]!, contained: sortedByLength[j]! });
      }
    }
  }

  let commonRoot = (cleaned[0] ?? "").toLowerCase();
  for (let i = 1; i < cleaned.length; i++) {
    commonRoot = longestCommonSubstring(commonRoot, cleaned[i] ?? "");
    if (commonRoot.length < MIN_ROOT) break;
  }
  const rootValid = commonRoot.length >= MIN_ROOT;

  const startsWithRoot = rootValid
    ? cleaned.filter((w) => w.toLowerCase().startsWith(commonRoot))
    : [];
  let detectedSuffixes: string[] = [];
  if (startsWithRoot.length >= 2) {
    const shortestBase = startsWithRoot
      .filter((w) => w.toLowerCase() === commonRoot || w.length <= commonRoot.length + 2)
      .sort((a, b) => a.length - b.length)[0];
    if (shortestBase) {
      detectedSuffixes = startsWithRoot
        .filter((w) => w !== shortestBase)
        .map((w) => w.slice(commonRoot.length))
        .filter((s) => s.length > 0 && s.length <= 5);
    }
  }

  let description: string;
  let hasPattern = false;
  if (containment.length > 0) {
    description = `${cleaned.length} terms (longest-first matching)`;
  } else if (detectedSuffixes.length > 0) {
    description = `Word family: "${commonRoot}" + suffixes`;
    hasPattern = true;
  } else if (rootValid) {
    const ratio = startsWithRoot.length / cleaned.length;
    if (ratio >= 0.5) {
      description = `Shared root: "${commonRoot}"`;
      hasPattern = true;
    } else {
      description = `${cleaned.length} alternative terms`;
    }
  } else {
    const phrases = cleaned.filter((w) => w.includes(" "));
    if (phrases.length === cleaned.length) description = `${cleaned.length} phrases`;
    else if (phrases.length > 0) description = `${cleaned.length} terms (${phrases.length} phrases)`;
    else description = `${cleaned.length} alternative words`;
  }

  let warning: string | null = null;
  if (containment.length > 0 && containment.length <= 2) {
    const pair = containment[0]!;
    warning = `"${pair.contained}" is inside "${pair.container}": ordering matters`;
  }

  return {
    root: rootValid ? commonRoot : null,
    words: cleaned,
    hasPattern,
    description,
    coveringWords: containment.map((p) => p.container),
    optimizedWords: sortedByLength,
    warning,
  };
}
