/**
 * The ask payload's boundary reader, and the panel rules it feeds - which are Kit's, imported here
 * as well so a rule changed in the terminal fails here.
 */
import { describe, expect, test } from "bun:test";
import { CHAT_INSTEAD, armedAnswer, askMessage, numberedRows } from "../../kit/render/ask/ask-core";
import { readChoices } from "./kit-choice-core";

const two = { question: "Which preset?", options: [{ value: "empty-base" }, { value: "paramnesia" }] };

describe("readChoices", () => {
  test("a well-formed question comes through whole", () => {
    const read = readChoices({ ...two, options: [{ value: "a", note: "the first" }, { value: "b" }] });
    expect(read?.question).toBe("Which preset?");
    expect(read?.options).toEqual([{ value: "a", note: "the first" }, { value: "b" }]);
  });

  test("EVERY RAGGED SHAPE READS AS NOTHING TO DRAW, never as a crash", () => {
    /**
     * This payload crosses a wire and then sessionStorage. A cast would let `options: undefined`
     * reach the renderer and take the whole transcript down with it; a null here degrades to the
     * plain tool row the window would have shown anyway.
     */
    for (const raw of [null, undefined, 7, "pick one", {}, { question: "q" }, { options: [] }]) {
      expect(readChoices(raw)).toBeNull();
    }
    expect(readChoices({ question: "q", options: "a,b" })).toBeNull();
    expect(readChoices({ question: "   ", options: [{ value: "a" }, { value: "b" }] })).toBeNull();
  });

  test("OFFERING ONE OPTION IS NOT A QUESTION", () => {
    // Kit's rule, from the tool's own schema, re-checked on the way in.
    expect(readChoices({ question: "q", options: [{ value: "only" }] })).toBeNull();
    expect(readChoices({ question: "q", options: [{ value: "a" }, { value: 5 }] })).toBeNull();
  });

  test("the caps hold at this end too, not only at the tool's end", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ value: `option ${String(i)}` }));
    const read = readChoices({ question: "x".repeat(900), options: many });
    expect(read?.options).toHaveLength(12);
    expect(read?.question.length).toBe(200);
    const long = readChoices({ question: "q", options: [{ value: "y".repeat(900) }, { value: "b" }] });
    expect(long?.options[0]?.value.length).toBe(200);
  });
});

describe("the panel's rules are Kit's", () => {
  test("only pickable rows are numbered, so the printed key reaches the row it names", () => {
    const rows = numberedRows(two.options);
    // Two options, a rule, write-your-own, a rule, chat-instead: four numbers across six rows.
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.number !== null)).toHaveLength(4);
    expect(rows.filter((r) => r.row.kind === "rule").every((r) => r.number === null)).toBe(true);
  });

  test("NOTHING IS ARMED UNTIL IT IS A REAL ANSWER", () => {
    // "write your own" is selected but empty until something is typed; sending it would put a blank
    // message in the conversation and make the model guess.
    const base = { options: two.options, cursor: 2, own: "", note: "" };
    expect(armedAnswer(base)).toBeNull();
    expect(armedAnswer({ ...base, own: "something else" })).toBe("something else");
    expect(armedAnswer({ ...base, cursor: 0 })).toBe("empty-base");
    expect(armedAnswer({ ...base, cursor: 3 })).toBe(CHAT_INSTEAD);
  });

  test("A NOTE GOES IN THE SAME MESSAGE AS THE PICK", () => {
    // Sending the pick and the caveat separately would let the model answer the first before
    // reading the second.
    const message = askMessage({ options: two.options, cursor: 0, own: "", note: "only the ones with art" });
    expect(message).toBe("empty-base\n\nNote: only the ones with art");
  });
});
