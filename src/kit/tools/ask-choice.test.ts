/**
 * ask_choice, tested on the properties that keep it a CHOICE rather than a decision.
 */
import { describe, expect, test } from "bun:test";
import askChoice from "./ask-choice";

const run = async (args: Record<string, unknown>) =>
  askChoice.execute(askChoice.input.parse(args), {} as never);

describe("the options travel as data, not as a sentence", () => {
  test("the shell gets a structured list, and the model gets readable prose", async () => {
    const out = await run({
      question: "Which preset should I base it on?",
      options: [
        { value: "empty-base", note: "Empty Base" },
        { value: "paramnesia-vi-rc", note: "Paramnesia VI RC" },
      ],
    });
    // The shell renders from THIS. A model cannot offer a choice by claiming to have offered one -
    // the same separation `show` uses for opening the rail.
    expect(out.choices?.options.map((o) => o.value)).toEqual(["empty-base", "paramnesia-vi-rc"]);
    expect(out.choices?.question).toBe("Which preset should I base it on?");
    // And the model still needs to know what it asked, to make sense of the answer that comes back.
    expect(out.output).toContain("empty-base");
  });

  test("it tells the model not to answer for the person", async () => {
    const out = await run({
      question: "which?",
      options: [{ value: "a" }, { value: "b" }],
    });
    expect(out.output).toContain("do not pick for them");
  });

  test("it is a read: nothing to apply, nothing to gate", () => {
    expect(askChoice.effect).toBe("read");
  });
});

describe("fail-closed input", () => {
  test("one option is not a question", () => {
    expect(askChoice.input.safeParse({
      question: "which?",
      options: [{ value: "only" }],
    }).success).toBe(false);
  });

  test("no options, no question, and empty values are all refused", () => {
    expect(askChoice.input.safeParse({ question: "which?", options: [] }).success).toBe(false);
    expect(askChoice.input.safeParse({ options: [{ value: "a" }, { value: "b" }] }).success).toBe(false);
    expect(askChoice.input.safeParse({
      question: "which?",
      options: [{ value: "" }, { value: "b" }],
    }).success).toBe(false);
  });

  test("a list long enough to stop being a choice is refused", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ value: `option-${i}` }));
    expect(askChoice.input.safeParse({ question: "which?", options: many }).success).toBe(false);
  });
});
