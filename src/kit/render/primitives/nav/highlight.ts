/**
 * highlight: split a line's text into alternating plain and hit runs for the search overlay. Ranges
 * are half-open [lo, hi); each is clamped to the string, empties are dropped, and true overlaps are
 * merged (touching ranges stay separate so back-to-back repeats keep their own identity). When no
 * range survives, the whole string comes back as one plain segment, so a hit spanning a styling
 * boundary can never crash a row. Pure, total, never throws. activeRange marks the one run the cursor
 * points at so the shell can render it brighter than the rest.
 */
import type { Range } from "./search";

/** A run of text, either plain or a search hit; active marks the cursor's current hit. */
export interface Segment {
  readonly text: string;
  readonly hit: boolean;
  readonly active: boolean;
}

/** Clamp a range to [0, len] and keep only if it still spans at least one character. */
const clampRange = (range: Range, len: number): Range | null => {
  const lo = Math.max(0, Math.min(range[0], len));
  const hi = Math.max(0, Math.min(range[1], len));
  return lo < hi ? [lo, hi] : null;
};

/** Sort by start, then merge only true overlaps (next.lo < cur.hi), preserving touching boundaries. */
const normalize = (ranges: readonly Range[], len: number): Range[] => {
  const clamped = ranges
    .map((range) => clampRange(range, len))
    .filter((range): range is Range => range !== null)
    .sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const [lo, hi] of clamped) {
    const last = merged.at(-1);
    if (last && lo < last[1]) merged[merged.length - 1] = [last[0], Math.max(last[1], hi)];
    else merged.push([lo, hi]);
  }
  return merged;
};

/** Split text into plain/hit segments over the given ranges, marking the active hit if supplied. */
export function segments(text: string, ranges: readonly Range[], activeRange?: Range): Segment[] {
  const merged = normalize(ranges, text.length);
  const out: Segment[] = [];
  let cursor = 0;
  for (const [lo, hi] of merged) {
    if (lo > cursor) out.push({ text: text.slice(cursor, lo), hit: false, active: false });
    const active = activeRange !== undefined && lo === activeRange[0] && hi === activeRange[1];
    out.push({ text: text.slice(lo, hi), hit: true, active });
    cursor = hi;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false, active: false });
  return out;
}
