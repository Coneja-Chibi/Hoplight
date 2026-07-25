/**
 * match-cursor: the pure pointer over search hits, the counterpart to the composer's recall ring. A
 * LineMatch[] carries ranges grouped by line; the cursor flattens them into a single ordered list of
 * hits (line + range) and tracks which one is active, wrapping past either end. next/prev are no-ops
 * on an empty set (no n-of-m divide), and the label reads "k of n" (n capped for display) or "no
 * matches". Total, never throws, never mutates.
 */
import type { LineMatch, Range } from "./search";
import { cap99 } from "./cap";

/** One occurrence: the line it sits on and its half-open range within that line. */
export interface Hit {
  readonly lineIndex: number;
  readonly range: Range;
}

export interface MatchCursor {
  readonly hits: readonly Hit[];
  readonly index: number;
}

/** Flatten per-line ranges into one ordered hit list (line order, then range order within a line). */
export const flattenHits = (matches: readonly LineMatch[]): Hit[] =>
  matches.flatMap((match) => match.ranges.map((range) => ({ lineIndex: match.lineIndex, range })));

/** A fresh cursor over the matches, pointed at the first hit (index 0 even when empty). */
export const initCursor = (matches: readonly LineMatch[]): MatchCursor => ({
  hits: flattenHits(matches),
  index: 0,
});

/** Step to the next hit, wrapping to the first. No-op when there are no hits. */
export const nextMatch = (cursor: MatchCursor): MatchCursor =>
  cursor.hits.length === 0 ? cursor : { ...cursor, index: (cursor.index + 1) % cursor.hits.length };

/** Step to the previous hit, wrapping to the last. No-op when there are no hits. */
export const prevMatch = (cursor: MatchCursor): MatchCursor =>
  cursor.hits.length === 0
    ? cursor
    : { ...cursor, index: (cursor.index - 1 + cursor.hits.length) % cursor.hits.length };

/** The currently pointed hit, or null when the set is empty. */
export const activeHit = (cursor: MatchCursor): Hit | null => cursor.hits[cursor.index] ?? null;

/** The count label for the search bar: "k of n" (n capped at 99+), or "no matches". */
export const cursorLabel = (cursor: MatchCursor): string =>
  cursor.hits.length === 0 ? "no matches" : `${cursor.index + 1} of ${cap99(cursor.hits.length)}`;
