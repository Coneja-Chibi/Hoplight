/**
 * What the Library tells the agent about somebody's studio.
 *
 * The assertions here are about sentences, deliberately: this text is the whole input a model gets
 * before it answers a question about a person's work, so a wrong count or a swallowed warning is a
 * confidently wrong answer with nothing to trace it back to.
 */
import { describe, expect, test } from "bun:test";
import { libraryAgentState } from "./agent-surface";

const piece = (id: string, name: string) => ({ kind: "preset", id, name });

const base = {
  deck: "Presets",
  inDeck: [piece("hawthorne", "HawThorne"), piece("nemo", "NemoEngine")],
  total: 164,
  damaged: [],
  staged: new Set<string>(),
  loadFailed: false,
};

describe("libraryAgentState", () => {
  test("the shelf is what is on screen; the studio total is a note", () => {
    const state = libraryAgentState(base);

    expect(state.headline).toContain("Presets shelf");
    expect(state.headline).toContain("2 of 164");
    expect(state.items).toHaveLength(2);
    expect(state.notes).toContain("The studio holds 164 pieces in total.");
  });

  test("AN UNREACHABLE STUDIO IS NOT AN EMPTY ONE, and it is said first", () => {
    /**
     * The two render identically - a listing with nothing in it - and they mean opposite things. An
     * agent that read the silence as "your studio is empty" would be telling somebody their work is
     * gone. It leads the notes because everything after it is unreliable.
     */
    const state = libraryAgentState({ ...base, inDeck: [], total: 0, loadFailed: true });

    expect(state.notes?.[0]).toContain("could not be reached");
    expect(state.notes?.[0]).toContain("may be empty or out of date");
  });

  test("unreadable files are named with their reason, not just counted", () => {
    // The most likely thing to be asked about in this room, and the reason is specific enough to act
    // on now: "rename it" and "nothing here reads that format" are different answers.
    const state = libraryAgentState({
      ...base,
      damaged: [
        { kind: "preset", id: "Clean", reason: "schema-mismatch" },
        { kind: "character", id: "lu &vic", reason: "unusable-filename" },
      ],
    });

    const note = state.notes?.find((n) => n.includes("did not open")) ?? "";
    expect(note).toContain("2 file(s)");
    expect(note).toContain("preset/Clean.json (schema-mismatch)");
    expect(note).toContain("character/lu &vic.json (unusable-filename)");
  });

  test("a staged piece is marked as focused", () => {
    const state = libraryAgentState({ ...base, staged: new Set(["preset:hawthorne"]) });

    expect(state.items?.find((i) => i.id === "hawthorne")?.focused).toBe(true);
    expect(state.items?.find((i) => i.id === "nemo")?.focused).toBeUndefined();
  });
});
