/**
 * The band rules, pinned to Kit's own numbers and Kit's own fold.
 *
 * The two constants here are imported FROM KIT in this file even where the shipped code cannot
 * import them, so a number changed in the terminal fails a test in the window rather than drifting
 * into two transcripts that quietly disagree.
 */
import { describe, expect, test } from "bun:test";
import { LONG_SAY_CHARS } from "../../kit/render/say-fold";
/**
 * Kit's own ErrorRow. An OpenTUI component, so the shipped core cannot import it - a browser bundle
 * must not carry a terminal renderer. A TEST is not bundled, so it can hold the two together.
 */
import { ERROR_ROW_CHARS as KIT_ERROR_ROW_CHARS } from "../../kit/render/primitives/error-row";
import { ERROR_ROW_CHARS, boundedError, foldSummary, isFoldable, sayIsOpen } from "./kit-bands-core";

describe("the error cap", () => {
  test("IT IS KIT'S NUMBER, and this test is what keeps it that way", () => {
    expect(ERROR_ROW_CHARS).toBe(KIT_ERROR_ROW_CHARS);
    expect(ERROR_ROW_CHARS).toBe(600);
  });

  test("an unbounded provider failure cannot flood the transcript", () => {
    // A 500 from a proxy can carry a whole HTML error page. A transcript that renders it has lost
    // the conversation it was keeping.
    const flood = `failure ${"x".repeat(ERROR_ROW_CHARS * 3)}`;
    const bounded = boundedError(flood);
    expect(bounded).toStartWith("failure");
    expect(bounded).toEndWith("…");
    expect([...bounded].length).toBeLessThanOrEqual(ERROR_ROW_CHARS + 1);
  });

  test("a short failure is left exactly as it was", () => {
    expect(boundedError("no model connected")).toBe("no model connected");
  });

  test("it never cuts a character in half", () => {
    const bounded = boundedError("\u{1F534}".repeat(ERROR_ROW_CHARS * 2));
    expect(bounded).not.toContain("�");
  });
});

describe("the fold threshold", () => {
  test("it is Kit's, imported rather than guessed", () => {
    expect(LONG_SAY_CHARS).toBe(1200);
    expect(isFoldable("x".repeat(LONG_SAY_CHARS), false)).toBe(false);
    expect(isFoldable("x".repeat(LONG_SAY_CHARS + 1), false)).toBe(true);
  });

  test("A REPLY STILL BEING TYPED IS NEVER FOLDED", () => {
    // Collapsing text as it arrives is unreadable, and the decision is remade the moment it settles.
    expect(isFoldable("x".repeat(LONG_SAY_CHARS + 1), true)).toBe(false);
  });
});

describe("sayIsOpen", () => {
  const say = (open?: boolean): { role: string; open?: boolean } =>
    open === undefined ? { role: "assistant" } : { role: "assistant", open };

  test("THE ROLE IS PROJECTED, or the fold silently does nothing", () => {
    /**
     * Kit's rule asks whether a later line has role "say". This window says "assistant". Handed the
     * window's own word, the check never matches, every long reply reports open, and the fold looks
     * shipped while collapsing nothing. This assertion is the whole reason the projection exists.
     */
    const lines = [say(), say()];
    expect(sayIsOpen(lines, 0)).toBe(false);
    expect(sayIsOpen(lines, 1)).toBe(true);
  });

  test("the newest reply is open, because the reply you are reading is not scrollback", () => {
    const lines = [say(), { role: "tool" }, say(), { role: "user" }];
    expect(sayIsOpen(lines, 0)).toBe(false);
    expect(sayIsOpen(lines, 2)).toBe(true);
  });

  test("AN EXPLICIT TOGGLE ALWAYS WINS", () => {
    // Collapsing the newest reply is something people do deliberately, and it must not spring back
    // open on the next render.
    const lines = [say(), say(false)];
    expect(sayIsOpen(lines, 1)).toBe(false);
    const reopened = [say(true), say()];
    expect(sayIsOpen(reopened, 0)).toBe(true);
  });

  test("a tool line after the newest reply does not close it", () => {
    const lines = [say(), { role: "tool" }];
    expect(sayIsOpen(lines, 0)).toBe(true);
  });
});

describe("foldSummary", () => {
  test("it says what it is, how much there is, and how to get it back", () => {
    const line = foldSummary("x".repeat(1_500));
    expect(line).toContain("said");
    expect(line).toContain("1500 chars");
    expect(line).toContain("reopens");
  });
});
