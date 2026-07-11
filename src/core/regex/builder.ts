/**
 * Plain-words <-> pattern NL regex builder core (REGEX-JEWEL-PLAN.md Phase R3 prerequisite).
 * Two pure functions, one small vocabulary shared both ways:
 *   buildFromPhrases  - words/phrases -> a whole-word-safe find/flags pair.
 *   explainPattern    - a find/flags pair -> the words it can honestly attribute to that
 *                        vocabulary, marked complete or partial. Never a wrong paraphrase: a
 *                        pattern outside the vocabulary reports only the words it can prove,
 *                        plus an honest "advanced parts" note.
 * Ported from RC's `apps/rc/src/lib/regex/builder-core.ts` (words-mode of
 * `buildPatternFromState`/`decompileToBuilderState`) and the escape/example helpers in
 * `apps/rc/src/lib/lorebook/regex-utils.ts` (reality note: the plan cited
 * `apps/rc/src/lib/regex-utils.ts`; the real path is `apps/rc/src/lib/lorebook/regex-utils.ts` -
 * confirmed by builder-core.ts's own import). The full multi-mode RegexBuilderState (phrases
 * mode, exclude/suffix/followed-by controls) is UI-gated R3 work, not this prerequisite; this
 * module ports only the words-mode grammar both directions need to stay honest.
 */

/** Characters the builder escapes when turning a literal word into a pattern fragment. */
const REGEX_SPECIALS = new Set([
  ".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\",
]);

const escapeWord = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const splitList = (value: readonly string[]): string[] =>
  value.map((v) => v.trim()).filter((v) => v.length > 0);

export interface BuildOptions {
  caseSensitive?: boolean; // default false -> flags "i"
}

export interface BuiltRegex {
  find: string;
  flags: string;
}

/**
 * Build a whole-word-safe pattern from a phrase list: escape, dedupe, sort longest-first (so a
 * longer alternative is tried before a prefix of it), group as an alternation, wrap in \b...\b.
 * Empty input -> empty pattern. Never throws: an escaped-word alternation is always valid regex,
 * but a defensive try/catch still degrades to empty rather than surface a broken pattern.
 */
export function buildFromPhrases(phrases: readonly string[], options?: BuildOptions): BuiltRegex {
  const words = [...new Set(splitList(phrases))];
  if (words.length === 0) return { find: "", flags: "" };

  try {
    const sorted = [...words].sort((a, b) => b.length - a.length);
    const escaped = sorted.map(escapeWord);
    const core = escaped.length === 1 ? escaped[0] : `(${escaped.join("|")})`;
    const find = `\\b${core}\\b`;
    const flags = options?.caseSensitive ? "" : "i";
    new RegExp(find, flags); // validate; throws are caught below
    return { find, flags };
  } catch {
    return { find: "", flags: "" };
  }
}

// ----------------------------------------------------------------------------
// explainPattern - the same vocabulary, run backward
// ----------------------------------------------------------------------------

export interface ExplainResult {
  phrases: string[];
  complete: boolean; // true only when the pattern is EXACTLY buildFromPhrases's own shape
  note?: string; // present whenever complete is false
}

const ADVANCED_NOTE = "plus advanced parts outside the words vocabulary";

/** Turn one escaped alternation member back into its literal word, or null if it is not one. */
function unescapeWord(member: string): string | null {
  let out = "";
  for (let i = 0; i < member.length; i++) {
    const c = member[i];
    if (c === undefined) break;
    if (c === "\\") {
      const next = member[i + 1];
      if (next === undefined || !REGEX_SPECIALS.has(next)) return null;
      out += next;
      i++;
      continue;
    }
    if (REGEX_SPECIALS.has(c)) return null;
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

/**
 * Decompile the exact shape buildFromPhrases emits: \b(w1|w2|...)\b or \bw\b, flags "" or "i".
 * Returns null for anything else (including our own words wrapped with extra modifiers a fuller
 * builder state might add later) - complete:true is reserved for a lossless round trip.
 */
function decompileWords(pattern: string, flags: string): string[] | null {
  if (flags !== "" && flags !== "i") return null;
  if (!pattern.startsWith("\\b") || !pattern.endsWith("\\b") || pattern.length <= 4) return null;
  const core = pattern.slice(2, -2);

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

  const words: string[] = [];
  for (const m of members) {
    const word = unescapeWord(m);
    if (word === null) return null;
    words.push(word);
  }
  return words;
}

/**
 * Extract literal words this vocabulary can honestly attribute to a foreign pattern: alternation
 * members and \b-wrapped runs, cleaned of the escapes/metacharacters that make them "not a plain
 * word" - never a full paraphrase, just the parts proven present. Ported from RC's
 * generateRegexExamples extraction heuristics (regex-utils.ts), pattern-explanation use only.
 */
function extractKnownWords(pattern: string): string[] {
  const found: string[] = [];
  const push = (w: string): void => {
    if (w.length >= 2 && !found.includes(w)) found.push(w);
  };

  for (const altGroup of pattern.match(/\(([^()]+\|[^()]+)\)/g) ?? []) {
    const inner = altGroup.slice(1, -1);
    const parts = splitAlternation(inner) ?? [];
    for (const part of parts) {
      const word = unescapeWord(part);
      if (word !== null) push(word);
    }
  }

  const boundaryPattern = /\\b([a-zA-Z']+)\\b/g;
  for (const m of pattern.matchAll(boundaryPattern)) {
    if (m[1] !== undefined) push(m[1]);
  }

  if (found.length === 0) {
    for (const lit of pattern.match(/[a-zA-Z]{3,}/g) ?? []) push(lit);
  }

  return found.slice(0, 12);
}

/**
 * Read a find/flags pair back into the words the builder's vocabulary can prove. A pattern that
 * is EXACTLY buildFromPhrases's own output round-trips complete; anything else reports the words
 * it can honestly find and flags itself partial rather than guess.
 */
export function explainPattern(find: string, flags: string): ExplainResult {
  if (!find) return { phrases: [], complete: true };

  const exact = decompileWords(find, flags);
  if (exact !== null) return { phrases: exact, complete: true };

  const known = extractKnownWords(find);
  return { phrases: known, complete: false, note: ADVANCED_NOTE };
}
