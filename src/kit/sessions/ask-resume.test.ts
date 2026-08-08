/**
 * A question survives a quit.
 *
 * It did not. The observation a model reads is a summary - "Asked: ...\nOptions offered: a, b, c" -
 * which drops every option's reason, so resuming folded a question into one grey line truncated to
 * sixty characters with nothing to click. You could read half of what you had been asked and could
 * not answer any of it.
 */
import { describe, expect, test } from "bun:test";
import { messagesToLines } from "./render/replay";
import { parseSession } from "./store";
import type { ModelMessage } from "../providers/provider";

const CHOICES = {
  question: "Which system survives?",
  options: [
    { value: "Story Director", note: "The invisible hand." },
    { value: "Trackers", note: "Lightweight state as panels." },
  ],
};

const asked = (): ModelMessage =>
  ({ role: "tool", content: "Asked: Which system survives?", toolName: "ask_choice", choices: CHOICES });

describe("a stored question", () => {
  test("comes back as an answerable panel, reasons intact", () => {
    const lines = messagesToLines([{ role: "assistant", content: "" }, asked()]);
    const panel = lines.find((l) => l.role === "choices");
    expect(panel).toBeDefined();
    expect(panel).toMatchObject({ role: "choices", question: "Which system survives?" });
    // The reasons are the part the observation text threw away.
    expect(panel).toMatchObject({ options: CHOICES.options });
  });

  test("it is not folded into the backstage cluster", () => {
    // Which is where it used to go: one grey line, truncated, nothing to click.
    const lines = messagesToLines([asked()]);
    expect(lines.some((l) => l.role === "backstage")).toBe(false);
  });

  test("what you said next closes it", () => {
    /**
     * ANSWERED IS DERIVED. Keeping a second copy of the reply would mean two records that have to
     * agree; the message after the question already IS the answer.
     */
    const lines = messagesToLines([asked(), { role: "user", content: "Trackers" }]);
    const panel = lines.find((l) => l.role === "choices");
    expect(panel).toMatchObject({ answered: "Trackers" });
  });

  test("an unanswered question comes back still waiting", () => {
    // The whole point: quit mid-question, resume, and finish answering it.
    const lines = messagesToLines([asked(), { role: "assistant", content: "waiting on you" }]);
    const panel = lines.find((l) => l.role === "choices") as { answered?: string };
    expect(panel.answered).toBeUndefined();
  });

  test("an ordinary tool result still folds", () => {
    // Only panels are promoted; everything else stays backstage where it belongs.
    const lines = messagesToLines([{ role: "tool", content: "listed 12", toolName: "list_pieces" }]);
    expect(lines.some((l) => l.role === "backstage")).toBe(true);
    expect(lines.some((l) => l.role === "choices")).toBe(false);
  });
});

describe("the store's trust boundary", () => {
  const stored = (choices: unknown) => ({
    version: 1, id: "s1", title: null, createdAt: 1, updatedAt: 2, parent: null,
    turns: [{ input: "hi", at: 1, messages: [{ role: "tool", content: "x", toolName: "ask_choice", choices }] }],
  });

  test("a well-formed question round-trips", () => {
    const parsed = parseSession(stored(CHOICES));
    expect(parsed!.turns[0]!.messages[0]!.choices).toEqual(CHOICES);
  });

  test("a malformed question is dropped, and the turn survives", () => {
    /**
     * TOLERANT HERE, UNLIKE THE REST OF THIS FILE. A bad panel costs the ability to redraw one
     * question; denying the message would cost the conversation it sits in, which is far worse and
     * is not what a broken render hint deserves.
     */
    for (const junk of [42, "nope", {}, { question: "q" }, { question: "q", options: [] }, { options: [] }]) {
      const parsed = parseSession(stored(junk));
      expect(parsed).not.toBeNull();
      expect(parsed!.turns[0]!.messages[0]!.choices).toBeUndefined();
      expect(parsed!.turns[0]!.messages[0]!.content).toBe("x");
    }
  });

  test("options of the wrong shape are skipped, not trusted", () => {
    const parsed = parseSession(stored({
      question: "q",
      options: [{ value: "keep" }, { note: "no value" }, 7, { value: "" }],
    }));
    expect(parsed!.turns[0]!.messages[0]!.choices?.options).toEqual([{ value: "keep" }]);
  });

  test("a session written before questions were remembered still loads", () => {
    const parsed = parseSession({
      version: 1, id: "s1", title: null, createdAt: 1, updatedAt: 2, parent: null,
      turns: [{ input: "hi", at: 1, messages: [{ role: "user", content: "hi" }] }],
    });
    expect(parsed).not.toBeNull();
  });
});
