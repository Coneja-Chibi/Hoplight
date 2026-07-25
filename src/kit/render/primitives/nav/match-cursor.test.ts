/** Verifies transcript-search cursor movement across match groups. */
import { describe, expect, test } from "bun:test";
import type { LineMatch } from "./search";
import { activeHit, cursorLabel, initCursor, nextMatch, prevMatch } from "./match-cursor";

const matches: LineMatch[] = [
  { lineIndex: 0, ranges: [[0, 3]] },
  { lineIndex: 4, ranges: [[1, 4], [8, 11]] },
];

describe("match-cursor", () => {
  test("initCursor flattens ranges across lines into one ordered hit list", () => {
    const cursor = initCursor(matches);
    expect(cursor.hits).toEqual([
      { lineIndex: 0, range: [0, 3] },
      { lineIndex: 4, range: [1, 4] },
      { lineIndex: 4, range: [8, 11] },
    ]);
    expect(activeHit(cursor)).toEqual({ lineIndex: 0, range: [0, 3] });
  });

  test("next wraps forward past the last hit to the first", () => {
    let cursor = initCursor(matches);
    cursor = nextMatch(cursor);
    expect(cursor.index).toBe(1);
    cursor = nextMatch(cursor);
    expect(cursor.index).toBe(2);
    cursor = nextMatch(cursor); // wrap
    expect(cursor.index).toBe(0);
  });

  test("prev wraps backward past the first hit to the last", () => {
    const cursor = prevMatch(initCursor(matches));
    expect(cursor.index).toBe(2);
  });

  test("next and prev are no-ops on an empty match set", () => {
    const empty = initCursor([]);
    expect(nextMatch(empty)).toEqual(empty);
    expect(prevMatch(empty)).toEqual(empty);
    expect(activeHit(empty)).toBeNull();
  });

  test("label reads 'k of n' (1-based), or 'no matches' when empty", () => {
    expect(cursorLabel(initCursor([]))).toBe("no matches");
    expect(cursorLabel(initCursor(matches))).toBe("1 of 3");
    expect(cursorLabel(nextMatch(initCursor(matches)))).toBe("2 of 3");
  });

  test("the total is capped at 99+ for a huge match set", () => {
    const many: LineMatch = { lineIndex: 0, ranges: Array.from({ length: 150 }, (_, i) => [i, i + 1]) };
    expect(cursorLabel(initCursor([many]))).toBe("1 of 99+");
  });
});
