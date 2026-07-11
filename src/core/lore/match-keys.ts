/**
 * Keyword match + selective-logic helpers for the activation engine.
 * ST matchKeys semantics (world-info.js ~L337); selective loop ~L4943.
 */
import type {
  LorebookBody,
  LorebookEntry,
  SelectiveLogic,
  Trigger,
} from "../../entities/lorebook/schema";

export interface MatchOpts {
  wholeWords: boolean;
  caseSensitive: boolean;
}

export interface KeywordHit {
  hit: true;
  keyword: string;
  lineIndex: number;
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Resolve per-entry match flags; null inherits the book globals. */
export function resolveMatchOpts(entry: LorebookEntry, book: LorebookBody): MatchOpts {
  return {
    wholeWords: entry.matchWholeWords ?? book.globalMatchWholeWords,
    caseSensitive: entry.caseSensitive ?? book.globalCaseSensitive,
  };
}

/**
 * Match one trigger against one haystack string.
 * ST matchKeys: regex keys override all options; plain keys honor whole-word
 * (multi-word = includes; single-word = (?:^|\W)key(?:$|\W)) and case.
 */
export function keywordMatches(
  trigger: Trigger,
  text: string,
  opts: MatchOpts,
): { hit: boolean; keyword: string } {
  const keyword = trigger.keyword;
  if (!keyword) return { hit: false, keyword };

  if (trigger.isRegex) {
    try {
      const re = new RegExp(keyword, trigger.flags ?? "");
      return { hit: re.test(text), keyword };
    } catch {
      return { hit: false, keyword };
    }
  }

  // Inline /pattern/flags still sometimes rides as a plain keyword string from older imports.
  const inline = /^\/(.+)\/([dgimsuy]*)$/.exec(keyword);
  if (inline) {
    try {
      const re = new RegExp(inline[1] ?? "", inline[2] ?? "");
      return { hit: re.test(text), keyword };
    } catch {
      return { hit: false, keyword };
    }
  }

  const hay = opts.caseSensitive ? text : text.toLowerCase();
  const needle = opts.caseSensitive ? keyword : keyword.toLowerCase();

  if (!opts.wholeWords) {
    return { hit: hay.includes(needle), keyword };
  }

  // ST: multi-word keys with wholeWords fall back to includes (world-info.js ~L352).
  if (/\s/.test(needle)) {
    return { hit: hay.includes(needle), keyword };
  }

  // ST: (?:^|\W)(key)(?:$|\W) - punctuation-aware word edges.
  try {
    const re = new RegExp(`(?:^|\\W)(${escapeRegex(needle)})(?:$|\\W)`);
    return { hit: re.test(hay), keyword };
  } catch {
    return { hit: hay.includes(needle), keyword };
  }
}

/** First hit of any trigger across scan lines; reports the line index. */
export function firstTriggerHit(
  triggers: readonly Trigger[],
  lines: readonly string[],
  opts: MatchOpts,
): KeywordHit | null {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const text = lines[lineIndex] ?? "";
    for (const t of triggers) {
      const r = keywordMatches(t, text, opts);
      if (r.hit) return { hit: true, keyword: r.keyword, lineIndex };
    }
  }
  return null;
}

/**
 * Secondary selective logic (ST world-info.js ~L4943).
 * Primary must already have matched. Empty secondaries = pass (caller skips this).
 */
export function secondaryLogicOk(
  logic: SelectiveLogic,
  anySecondary: boolean,
  allSecondary: boolean,
): boolean {
  switch (logic) {
    case "and_any":
      return anySecondary;
    case "and_all":
      return allSecondary;
    case "not_any":
      return !anySecondary;
    case "not_all":
      return !allSecondary;
    default: {
      const _x: never = logic;
      return _x;
    }
  }
}
