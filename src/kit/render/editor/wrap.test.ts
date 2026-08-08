/**
 * Laying a document out, and finding your way back from a click.
 *
 * The round trip is the property that matters: a position turned into a screen row and back has to
 * be the same position, or clicking lands near where somebody aimed and never exactly on it.
 */
import { describe, expect, test } from "bun:test";
import { fromVisual, toVisual, visualWindow, wrapAll, wrapLine } from "./wrap";

describe("wrapLine", () => {
  test("a short line is one row", () => {
    expect(wrapLine("hello", 20, 0)).toEqual([{ text: "hello", row: 0, from: 0, first: true }]);
  });

  test("AN EMPTY LINE IS STILL A ROW", () => {
    // A paragraph break is a place the cursor can be; producing nothing would make it unreachable.
    expect(wrapLine("", 20, 3)).toEqual([{ text: "", row: 3, from: 0, first: true }]);
  });

  test("it breaks between words, not through them", () => {
    // A hard break mid-word is fine for code and wrong for the prose these blocks hold.
    const rows = wrapLine("the grass gave off a dim light", 14, 0);
    expect(rows.map((r) => r.text)).toEqual(["the grass gave", "off a dim", "light"]);
  });

  test("a word longer than the pane is cut rather than overflowing", () => {
    const rows = wrapLine("supercalifragilistic", 8, 0);
    expect(rows.every((r) => r.text.length <= 8)).toBe(true);
    expect(rows.map((r) => r.text).join("")).toBe("supercalifragilistic");
  });

  test("only the first row is marked first, since it gets the line number", () => {
    const rows = wrapLine("one two three four five", 10, 0);
    expect(rows.map((r) => r.first)).toEqual([true, false, false]);
  });

  test("every row knows where in the line it began", () => {
    const rows = wrapLine("aaa bbb ccc", 7, 0);
    for (const r of rows) {
      expect("aaa bbb ccc".slice(r.from, r.from + r.text.length)).toBe(r.text);
    }
  });
});

describe("the round trip", () => {
  const lines = [
    "short",
    "",
    "the grass gave off a dim blue-green light wherever our boots disturbed it",
    "end",
  ];
  const rows = wrapAll(lines, 20);

  test("every position survives going to the screen and back", () => {
    /**
     * The property the whole file exists for. Clicking is fromVisual and drawing is toVisual, so a
     * disagreement between them is a cursor that lands a few characters from where somebody aimed
     * and never exactly on it.
     */
    for (let row = 0; row < lines.length; row++) {
      for (let col = 0; col <= lines[row]!.length; col++) {
        const seen = toVisual(rows, row, col);
        expect(fromVisual(rows, seen.index, seen.col)).toEqual({ row, col });
      }
    }
  });

  test("an empty line round-trips too", () => {
    const seen = toVisual(rows, 1, 0);
    expect(fromVisual(rows, seen.index, seen.col)).toEqual({ row: 1, col: 0 });
  });
});

describe("fromVisual", () => {
  const rows = wrapAll(["abc", "defgh"], 20);

  test("PAST THE END OF A ROW IS THE END OF THAT ROW", () => {
    // Clicking the empty space right of a short line means "the end of this line" to everybody.
    expect(fromVisual(rows, 0, 99)).toEqual({ row: 0, col: 3 });
  });

  test("a click below the last row lands on the last row", () => {
    expect(fromVisual(rows, 99, 0)).toEqual({ row: 1, col: 0 });
  });

  test("a click above the first lands on the first", () => {
    expect(fromVisual(rows, -5, 2)).toEqual({ row: 0, col: 2 });
  });

  test("an empty document is position zero, not a crash", () => {
    expect(fromVisual([], 3, 4)).toEqual({ row: 0, col: 0 });
  });
});

describe("visualWindow", () => {
  test("a short document is shown whole", () => {
    expect(visualWindow(wrapAll(["a", "b"], 20), 0, 10)).toEqual({ from: 0, to: 2 });
  });

  test("it centres on the cursor and never scrolls past either end", () => {
    const rows = wrapAll(Array.from({ length: 60 }, (_, i) => `line ${String(i)}`), 20);
    expect(visualWindow(rows, 0, 10).from).toBe(0);
    expect(visualWindow(rows, 59, 10).to).toBe(60);
    const mid = visualWindow(rows, 30, 10);
    expect(mid.from).toBeLessThanOrEqual(30);
    expect(mid.to).toBeGreaterThan(30);
  });
});
