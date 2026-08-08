/**
 * A block of text with a cursor in it.
 *
 * Every operation here is an off-by-one waiting to happen, and the ones that bite are all at edges:
 * backspace at the start of a line, up-arrow into a shorter one, home on an empty document. Those
 * are most of the tests.
 */
import { describe, expect, test } from "bun:test";
import {
  backspace, bufferOf, deleteForward, insert, move, newline, textOf, visibleWindow,
} from "./text-buffer";

const at = (text: string, row: number, col: number) => ({ ...bufferOf(text), row, col });
const pos = (b: { row: number; col: number }) => [b.row, b.col];

describe("bufferOf", () => {
  test("it lands the cursor at the end, where typing starts", () => {
    expect(pos(bufferOf("ab\ncde"))).toEqual([1, 3]);
  });

  test("empty text is one empty line, not zero lines", () => {
    // Zero lines has no valid cursor position at all.
    expect(bufferOf("").lines).toEqual([""]);
    expect(pos(bufferOf(""))).toEqual([0, 0]);
  });

  test("it round-trips", () => {
    const text = "one\n\nthree\n";
    expect(textOf(bufferOf(text))).toBe(text);
  });
});

describe("insert", () => {
  test("a character goes in at the cursor, not at the end", () => {
    // The thing the old single-string editor could not do.
    expect(textOf(insert(at("abcd", 0, 2), "X"))).toBe("abXcd");
  });

  test("the cursor follows what was typed", () => {
    expect(pos(insert(at("abcd", 0, 2), "X"))).toEqual([0, 3]);
  });

  test("it works on the second line", () => {
    expect(textOf(insert(at("ab\ncd", 1, 1), "X"))).toBe("ab\ncXd");
  });
});

describe("newline", () => {
  test("THE KEY THAT USED TO COMMIT now splits the line", () => {
    // Enter was the commit key, so a paragraph break was not a character anybody could type.
    expect(textOf(newline(at("abcd", 0, 2)))).toBe("ab\ncd");
  });

  test("the cursor lands at the start of the new line", () => {
    expect(pos(newline(at("abcd", 0, 2)))).toEqual([1, 0]);
  });

  test("at the end of a line it opens an empty one", () => {
    expect(textOf(newline(at("ab", 0, 2)))).toBe("ab\n");
  });
});

describe("backspace", () => {
  test("it deletes the character before the cursor", () => {
    expect(textOf(backspace(at("abcd", 0, 2)))).toBe("acd");
  });

  test("AT THE START OF A LINE it joins to the one above", () => {
    const joined = backspace(at("ab\ncd", 1, 0));
    expect(textOf(joined)).toBe("abcd");
    // Landing where the join happened, which is where the eye already is.
    expect(pos(joined)).toEqual([0, 2]);
  });

  test("at the very start of the document it does nothing", () => {
    const b = at("abcd", 0, 0);
    expect(backspace(b)).toEqual(b);
  });
});

describe("deleteForward", () => {
  test("it deletes the character under the cursor", () => {
    expect(textOf(deleteForward(at("abcd", 0, 1)))).toBe("acd");
  });

  test("at the end of a line it pulls the next one up", () => {
    expect(textOf(deleteForward(at("ab\ncd", 0, 2)))).toBe("abcd");
  });

  test("at the very end it does nothing", () => {
    const b = at("ab", 0, 2);
    expect(deleteForward(b)).toEqual(b);
  });
});

describe("move", () => {
  test("left and right WRAP BETWEEN LINES", () => {
    // A document is one stream to the person reading it; stopping dead at a line end feels broken.
    expect(pos(move(at("ab\ncd", 1, 0), "left"))).toEqual([0, 2]);
    expect(pos(move(at("ab\ncd", 0, 2), "right"))).toEqual([1, 0]);
  });

  test("they stop at the ends of the document rather than wrapping around it", () => {
    expect(pos(move(at("ab", 0, 0), "left"))).toEqual([0, 0]);
    expect(pos(move(at("ab", 0, 2), "right"))).toEqual([0, 2]);
  });

  test("UP AND DOWN INTO A SHORTER LINE clamp instead of refusing", () => {
    // What every editor does, and what fingers expect.
    expect(pos(move(at("abcdef\nxy", 0, 5), "down"))).toEqual([1, 2]);
    expect(pos(move(at("xy\nabcdef", 1, 5), "up"))).toEqual([0, 2]);
  });

  test("up at the top and down at the bottom stay put", () => {
    expect(pos(move(at("ab\ncd", 0, 1), "up"))).toEqual([0, 1]);
    expect(pos(move(at("ab\ncd", 1, 1), "down"))).toEqual([1, 1]);
  });

  test("home, end, top and bottom", () => {
    expect(pos(move(at("abcd\nef", 0, 2), "home"))).toEqual([0, 0]);
    expect(pos(move(at("abcd\nef", 0, 2), "end"))).toEqual([0, 4]);
    expect(pos(move(at("abcd\nef", 1, 1), "top"))).toEqual([0, 0]);
    expect(pos(move(at("abcd\nef", 0, 0), "bottom"))).toEqual([1, 2]);
  });

  test("every move on an empty document is a no-op that stays valid", () => {
    for (const how of ["left", "right", "up", "down", "home", "end", "top", "bottom"] as const) {
      expect(pos(move(bufferOf(""), how))).toEqual([0, 0]);
    }
  });
});

describe("visibleWindow", () => {
  test("a short document is shown whole", () => {
    expect(visibleWindow(bufferOf("a\nb\nc"), 10)).toEqual({ from: 0, to: 3 });
  });

  test("it keeps the cursor on screen, centred", () => {
    const long = Array.from({ length: 100 }, (_, i) => `line ${String(i)}`).join("\n");
    const win = visibleWindow({ ...bufferOf(long), row: 50, col: 0 }, 10);
    expect(win.from).toBeLessThanOrEqual(50);
    expect(win.to).toBeGreaterThan(50);
    expect(win.to - win.from).toBe(10);
  });

  test("it never scrolls past either end", () => {
    const long = Array.from({ length: 20 }, (_, i) => String(i)).join("\n");
    expect(visibleWindow({ ...bufferOf(long), row: 0, col: 0 }, 5).from).toBe(0);
    expect(visibleWindow({ ...bufferOf(long), row: 19, col: 0 }, 5).to).toBe(20);
  });
});
