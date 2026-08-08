/**
 * The ask panel's arithmetic.
 *
 * The cases that matter are the ones nobody looks at: which key reaches which row once two dividers
 * are in the list, what the cursor does at either end, and whether a selection is an answer yet.
 */
import { describe, expect, test } from "bun:test";
import {
  armedAnswer, askMessage, askRows, CHAT_INSTEAD, moveCursor, numberedRows, pickableRows, rowForNumber,
  type AskOption, type AskState,
} from "./ask-core";

const OPTIONS: AskOption[] = [
  { value: "Story Director", note: "The invisible hand." },
  { value: "Compendium", note: "Accumulated memory." },
  { value: "Trackers" },
];

const state = (over: Partial<AskState> = {}): AskState =>
  ({ options: OPTIONS, cursor: 0, own: "", note: "", ...over });

describe("askRows", () => {
  test("the offered answers come first, then write-your-own, then chat", () => {
    expect(askRows(OPTIONS).map((r) => r.kind))
      .toEqual(["option", "option", "option", "rule", "own", "rule", "chat"]);
  });

  test("a note travels with its option and is never invented", () => {
    const rows = askRows(OPTIONS);
    expect(rows[0]).toEqual({ kind: "option", value: "Story Director", note: "The invisible hand." });
    // Trackers has none, so the row must not carry an empty one that draws a blank line.
    expect(rows[2]).toEqual({ kind: "option", value: "Trackers" });
  });

  test("there is no note row", () => {
    // It was one for a draft, which put "add a note" among the things that answer the question.
    expect(askRows(OPTIONS).some((r) => (r as { kind: string }).kind === "note")).toBe(false);
  });
});

describe("numbering", () => {
  test("dividers are drawn but never numbered", () => {
    expect(numberedRows(OPTIONS).map((r) => r.number)).toEqual([1, 2, 3, null, 4, null, 5]);
  });

  test("the printed number reaches the row printed beside it", () => {
    // The mismatch this prevents is one nobody reports: they assume they misread the screen.
    for (const [n, kind] of [[1, "option"], [3, "option"], [4, "own"], [5, "chat"]] as const) {
      expect(rowForNumber(OPTIONS, n)?.kind).toBe(kind);
    }
  });

  test("a number past the end reaches nothing", () => {
    expect(rowForNumber(OPTIONS, 6)).toBeNull();
    expect(rowForNumber(OPTIONS, 0)).toBeNull();
  });

  test("pickable rows are exactly the numbered ones", () => {
    expect(pickableRows(OPTIONS)).toHaveLength(
      numberedRows(OPTIONS).filter((r) => r.number !== null).length,
    );
  });
});

describe("moveCursor", () => {
  test("it wraps at both ends", () => {
    // Five pickable rows: three options, write-your-own, chat.
    expect(moveCursor(state({ cursor: 4 }), 1)).toBe(0);
    expect(moveCursor(state({ cursor: 0 }), -1)).toBe(4);
  });

  test("with no options there are still two rows to move between", () => {
    // Write-your-own and chat-instead do not depend on the model offering anything, so a question
    // with an empty list is still answerable rather than a dead panel.
    const empty = state({ options: [], cursor: 0 });
    expect(pickableRows(empty.options).map((r) => r.kind)).toEqual(["own", "chat"]);
    expect(moveCursor(empty, 1)).toBe(1);
    expect(moveCursor(empty, -1)).toBe(1);
  });
});

describe("armedAnswer", () => {
  test("an option is its own value", () => {
    expect(armedAnswer(state({ cursor: 1 }))).toBe("Compendium");
  });

  test("chat instead sends a refusal the model can read", () => {
    // Silence would leave it waiting; this tells it you would rather talk.
    expect(armedAnswer(state({ cursor: 4 }))).toBe(CHAT_INSTEAD);
  });

  test("write-your-own is armed only once something is typed", () => {
    // NULL IS A REAL STATE. Sending empty would put a blank message in the conversation.
    expect(armedAnswer(state({ cursor: 3 }))).toBeNull();
    expect(armedAnswer(state({ cursor: 3, own: "   " }))).toBeNull();
    expect(armedAnswer(state({ cursor: 3, own: "  none of these  " }))).toBe("none of these");
  });
});

describe("askMessage", () => {
  test("no note sends the answer alone", () => {
    expect(askMessage(state({ cursor: 0 }))).toBe("Story Director");
  });

  test("a note rides along in the same message", () => {
    // ONE MESSAGE. Two turns would let the model answer the pick before reading the caveat.
    expect(askMessage(state({ cursor: 2, note: "only the ones with art" })))
      .toBe("Trackers\n\nNote: only the ones with art");
  });

  test("a blank note adds nothing", () => {
    expect(askMessage(state({ cursor: 2, note: "   " }))).toBe("Trackers");
  });

  test("a note alone is not a message", () => {
    // The note qualifies an answer; it is not one. Nothing to send until something is picked.
    expect(askMessage(state({ cursor: 3, note: "some thought" }))).toBeNull();
  });

  test("a note rides along with a written-in answer too", () => {
    expect(askMessage(state({ cursor: 3, own: "a fifth thing", note: "roughly" })))
      .toBe("a fifth thing\n\nNote: roughly");
  });
});
