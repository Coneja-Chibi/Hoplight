/** Verifies transcript search indexing and match navigation. */
import { describe, expect, test } from "bun:test";
import type { RenderLine } from "../../turn-events";
import { lineText, matchesByLine, searchLines } from "./search";

describe("lineText covers every RenderLine variant", () => {
  // One case per union member: adding a variant to turn-events makes assertNever fail loud here.
  const cases: ReadonlyArray<[RenderLine, string]> = [
    [{ role: "you", text: "hello you" }, "hello you"],
    [{ role: "say", text: "hello say" }, "hello say"],
    [{ role: "tool", text: "read foo.ts" }, "read foo.ts"],
    [{ role: "error", text: "it broke" }, "it broke"],
    [{ role: "thought", text: "hmm", seconds: 3, open: false }, "hmm"],
    [{ role: "backstage", moves: ["read a", "list b"], seconds: 2, open: false }, "read a list b"],
  ];
  for (const [line, expected] of cases) {
    test(`projects ${line.role}`, () => expect(lineText(line)).toBe(expected));
  }
});

describe("searchLines", () => {
  const lines: RenderLine[] = [
    { role: "you", text: "How many Characters do I have" },
    { role: "say", text: "You have 13 characters. character character." },
    { role: "tool", text: "list decks" },
  ];

  test("empty and whitespace queries return no matches", () => {
    expect(searchLines(lines, "")).toEqual([]);
    expect(searchLines(lines, "   ")).toEqual([]);
  });

  test("is case-insensitive", () => {
    const matches = searchLines(lines, "characters");
    expect(matches.map((m) => m.lineIndex)).toEqual([0, 1]);
    expect(matches[0]!.ranges).toEqual([[9, 19]]); // "Characters" starts at index 9
  });

  test("finds multiple non-overlapping hits on one line", () => {
    const matches = searchLines(lines, "character");
    const line1 = matches.find((m) => m.lineIndex === 1)!;
    expect(line1.ranges.length).toBe(3); // "characters" + "character" + "character"
    for (const [lo, hi] of line1.ranges) expect(hi - lo).toBe("character".length);
  });

  test("a query with no hits anywhere returns []", () => {
    expect(searchLines(lines, "zzz")).toEqual([]);
  });

  test("never builds a regex: special characters are matched literally", () => {
    const dots: RenderLine[] = [{ role: "say", text: "a.b a.b axb" }];
    const matches = searchLines(dots, "a.b");
    expect(matches[0]!.ranges).toEqual([[0, 3], [4, 7]]); // "axb" is NOT matched
  });
});

describe("matchesByLine", () => {
  test("indexes ranges by line for O(1) lookup", () => {
    const byLine = matchesByLine([
      { lineIndex: 2, ranges: [[0, 3]] },
      { lineIndex: 5, ranges: [[1, 4], [7, 10]] },
    ]);
    expect(byLine.get(2)).toEqual([[0, 3]]);
    expect(byLine.get(5)).toEqual([[1, 4], [7, 10]]);
    expect(byLine.get(9)).toBeUndefined();
  });
});
