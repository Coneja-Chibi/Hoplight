/**
 * One block's change, and who wrote each line of it.
 *
 * The property worth defending hardest is the smallest: a line edited back to what is stored is NOT
 * a change. Marking it anyway is the phantom-edit bug in a different costume - something reported as
 * pending with nothing to apply, which is how the rail once got stuck.
 */
import { describe, expect, test } from "bun:test";
import {
  afterLines, authorGlyph, authorOf, beforeLines, hasChange, tallyAuthors,
} from "./block-diff";

const STORED = ["Think step by step.", "Keep it brief and hidden.", "Then write."].join("\n");
const PROPOSED = ["Think step by step.", "Keep it brief. Never show it.", "Then write."].join("\n");

const authors = (current: string) => afterLines(STORED, PROPOSED, current).map((l) => l.author);

describe("afterLines", () => {
  test("untouched, it is the model's change and nothing else", () => {
    expect(authors(PROPOSED)).toEqual(["stored", "model", "stored"]);
  });

  test("a line you type over becomes yours", () => {
    const mine = ["Think step by step.", "Keep it short. Never show it.", "Then write."].join("\n");
    expect(authors(mine)).toEqual(["stored", "yours", "stored"]);
  });

  test("A LINE EDITED BACK TO THE ORIGINAL IS NOT A CHANGE", () => {
    // The phantom-edit rule. It stops being marked, because it stopped being an edit.
    expect(authors(STORED)).toEqual(["stored", "stored", "stored"]);
  });

  test("you can change a line the model never touched", () => {
    const mine = ["Think HARD.", "Keep it brief. Never show it.", "Then write."].join("\n");
    expect(authors(mine)).toEqual(["yours", "model", "stored"]);
  });

  test("added lines are yours, and count as change", () => {
    expect(authors(`${PROPOSED}\nAnd stop.`)).toEqual(["stored", "model", "stored", "yours"]);
  });

  test("an emptied block is one blank line, not zero", () => {
    // Splitting "" gives [""], which is what a text box actually holds.
    expect(afterLines(STORED, PROPOSED, "")).toEqual([{ text: "", author: "yours" }]);
  });
});

describe("beforeLines", () => {
  test("the line the proposal replaced is marked removed", () => {
    const marks = beforeLines(STORED, PROPOSED).map((l) => l.removed);
    expect(marks).toEqual([false, true, false]);
  });

  test("nothing is removed when the text is put back", () => {
    expect(beforeLines(STORED, STORED).every((l) => !l.removed)).toBe(true);
  });

  test("a line moved elsewhere still counts as present", () => {
    // Marking it removed would say the words are going when they are only moving.
    const shuffled = ["Keep it brief and hidden.", "Think step by step.", "Then write."].join("\n");
    expect(beforeLines(STORED, shuffled).every((l) => !l.removed)).toBe(true);
  });
});

describe("authorGlyph", () => {
  test("unchanged prints nothing, because it is not a change", () => {
    expect(authorGlyph("stored")).toBe(" ");
    expect(authorGlyph("model")).toBe("+");
    expect(authorGlyph("yours")).toBe("~");
  });
});

describe("tallyAuthors", () => {
  test("it counts each author separately", () => {
    const mine = ["Think HARD.", "Keep it brief. Never show it.", "Then write."].join("\n");
    expect(tallyAuthors(afterLines(STORED, PROPOSED, mine))).toEqual({ model: 1, yours: 1 });
  });

  test("back to stored is nobody's change", () => {
    expect(tallyAuthors(afterLines(STORED, PROPOSED, STORED))).toEqual({ model: 0, yours: 0 });
  });
});

describe("hasChange and authorOf", () => {
  test("text back at stored has nothing to apply", () => {
    // However it got there: reset, or typed back one character at a time.
    expect(hasChange(STORED, STORED)).toBe(false);
    expect(authorOf(STORED, PROPOSED, STORED)).toBe("stored");
  });

  test("the model's version, untouched, is the model's", () => {
    expect(hasChange(STORED, PROPOSED)).toBe(true);
    expect(authorOf(STORED, PROPOSED, PROPOSED)).toBe("model");
  });

  test("one typed character makes it yours", () => {
    // What the footer says before you accept, so it has to flip on the first keystroke.
    expect(authorOf(STORED, PROPOSED, `${PROPOSED} `)).toBe("yours");
  });
});
