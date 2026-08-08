/**
 * What survives a navigation, and what does not.
 *
 * THIS EXISTS BECAUSE THE STORE STARTED CARRYING MORE THAN TEXT. The agent describes the screen you
 * came FROM, so going to look at the thing you are discussing is the normal way to use the window -
 * and the shell swaps apps through one slot, so looking unmounts it. That round trip now has to
 * preserve a question the agent asked, whether it was answered, and whether a long reply was
 * folded. Every one of those is a field the old guard neither checked nor claimed to keep.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { clearTranscript, loadTranscript, saveTranscript } from "./transcript-store";
import type { ChatLine } from "./turn";

/** A minimal sessionStorage, because these tests are about the round trip, not about a browser. */
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as Record<string, unknown>)["sessionStorage"] = {
    getItem: (k: string): string | null => store.get(k) ?? null,
    setItem: (k: string, v: string): void => { store.set(k, v); },
    removeItem: (k: string): void => { store.delete(k); },
  };
});

const roundTrip = (lines: ChatLine[]): ChatLine[] => {
  saveTranscript(lines);
  return loadTranscript();
};

describe("the round trip", () => {
  test("A QUESTION SURVIVES BEING NAVIGATED AWAY FROM", () => {
    /**
     * The panel is how the agent asks. If it evaporated on the navigation somebody took in order
     * to LOOK at what they were being asked about, the feature would break on its most obvious
     * use.
     */
    const asked: ChatLine = {
      role: "tool",
      text: "ask_choice: 2 options",
      tool: "ask_choice",
      choices: { question: "Which?", options: [{ value: "a", note: "first" }, { value: "b" }] },
    };
    const back = roundTrip([asked]);
    expect(back[0]?.choices?.question).toBe("Which?");
    expect(back[0]?.choices?.options).toHaveLength(2);
    expect(back[0]?.tool).toBe("ask_choice");
  });

  test("an answered panel comes back answered, and a folded reply comes back folded", () => {
    const back = roundTrip([
      { role: "tool", text: "ask_choice: 2", tool: "ask_choice", answered: "a" },
      { role: "assistant", text: "long one", open: false },
    ]);
    expect(back[0]?.answered).toBe("a");
    expect(back[1]?.open).toBe(false);
  });

  test("a line nobody touched carries no fold flag, so the position rule still applies", () => {
    const back = roundTrip([{ role: "assistant", text: "hello" }]);
    expect(back[0]?.open).toBeUndefined();
    expect("open" in (back[0] ?? {})).toBe(false);
  });
});

describe("what comes back is read, not trusted", () => {
  test("A TAMPERED QUESTION IS DROPPED RATHER THAN DRAWN", () => {
    /**
     * Storage is editable by anything on the machine, so the payload crosses a boundary a second
     * time coming back. It is re-parsed here rather than cast, because a cast would hand the
     * renderer `options: undefined` and take the transcript down with it.
     */
    sessionStorage.setItem(
      "hoplight.agent.transcript",
      JSON.stringify([{ role: "tool", text: "ask_choice: ?", choices: { question: "q", options: "nope" } }]),
    );
    const back = loadTranscript();
    expect(back).toHaveLength(1);
    expect(back[0]?.choices).toBeUndefined();
  });

  test("a line with no role or no text is not a line", () => {
    sessionStorage.setItem(
      "hoplight.agent.transcript",
      JSON.stringify([{ role: "wizard", text: "hi" }, { role: "user" }, { role: "user", text: "ok" }]),
    );
    expect(loadTranscript()).toEqual([{ role: "user", text: "ok" }]);
  });

  test("nothing stored, or nonsense stored, is an empty conversation and never a throw", () => {
    expect(loadTranscript()).toEqual([]);
    sessionStorage.setItem("hoplight.agent.transcript", "{not json");
    expect(loadTranscript()).toEqual([]);
    sessionStorage.setItem("hoplight.agent.transcript", JSON.stringify({ lines: [] }));
    expect(loadTranscript()).toEqual([]);
  });

  test("clearing leaves nothing behind", () => {
    saveTranscript([{ role: "user", text: "hi" }]);
    clearTranscript();
    expect(loadTranscript()).toEqual([]);
  });
});
