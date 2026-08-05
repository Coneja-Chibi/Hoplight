/**
 * search: the pure core of transcript find. lineText projects a RenderLine onto the one string a user
 * would read on that row; searchLines finds every literal, case-insensitive occurrence of a query
 * across the settled transcript, returning per-line half-open ranges. No regex is ever built from the
 * query (ReDoS rule): the match is toLowerCase().includes only. Empty or whitespace queries return no
 * matches (tolerant), so the transcript never lights up on nothing.
 *
 * lineText is exhaustive over the closed RenderLine union with assertNever: adding a variant to
 * turn-events forces this projection to be updated here, it never silently drops a line type. The
 * projection lives in nav (not turn-events) so the reducer stays a pure event fold with no view logic.
 */
import type { RenderLine } from "../../turn-events";

/** A half-open [lo, hi) span of matched characters within a line's text. */
export type Range = readonly [number, number];

/** One line that holds at least one match, with its ranges in text order. */
export interface LineMatch {
  readonly lineIndex: number;
  readonly ranges: readonly Range[];
}

const assertNever = (line: never): never => {
  throw new Error(`nav/search: unhandled line variant ${JSON.stringify(line)}`);
};

/** The searchable text of a transcript row. Total over every RenderLine variant. */
export function lineText(line: RenderLine): string {
  switch (line.role) {
    case "you":
    case "say":
    case "tool":
    case "error":
    case "watch":
    case "thought":
      return line.text;
    case "backstage":
      return line.moves.join(" ");
    // A choice list is findable by what it asked, which is the part somebody remembers.
    case "choices":
      return `${line.question} ${line.options.map((o) => o.value).join(" ")}`;
    // An image has no text of its own, so its caption is what search can find it by - which is the
    // difference between "pasted image" being findable in a long transcript and being invisible.
    case "image":
      return line.note;
    // Card art is findable by whose it is. A transcript with six portraits in it is exactly where
    // searching for a name should land on the face rather than skip past it.
    case "portrait":
      return line.caption;
    case "doctor":
      return line.checks.map((check) => `${check.label} ${check.detail}`).join(" ");
    default:
      return assertNever(line);
  }
}

/** Every non-overlapping occurrence of needle in haystack, case-insensitive, as half-open ranges.
 * Indices are taken in lowercased space; for ASCII they coincide with the original, and highlight.ts
 * clamps so a rare Unicode length shift can never overrun a row. */
const findRanges = (haystack: string, needle: string): Range[] => {
  const hay = haystack.toLowerCase();
  const ndl = needle.toLowerCase();
  const ranges: Range[] = [];
  let from = 0;
  for (;;) {
    const at = hay.indexOf(ndl, from);
    if (at === -1) break;
    ranges.push([at, at + ndl.length]);
    from = at + ndl.length; // non-overlapping: skip past this hit
  }
  return ranges;
};

/**
 * Find query across the transcript lines. Returns only the lines that hold a match, each with its
 * ranges. An empty or whitespace query yields no matches.
 */
export function searchLines(lines: readonly RenderLine[], query: string): LineMatch[] {
  const needle = query.trim();
  if (needle === "") return [];
  const matches: LineMatch[] = [];
  lines.forEach((line, lineIndex) => {
    const ranges = findRanges(lineText(line), needle);
    if (ranges.length > 0) matches.push({ lineIndex, ranges });
  });
  return matches;
}

/** Index the matches by line for O(1) per-row lookup while rendering the transcript. */
export const matchesByLine = (matches: readonly LineMatch[]): Map<number, readonly Range[]> => {
  const byLine = new Map<number, readonly Range[]>();
  for (const match of matches) byLine.set(match.lineIndex, match.ranges);
  return byLine;
};
