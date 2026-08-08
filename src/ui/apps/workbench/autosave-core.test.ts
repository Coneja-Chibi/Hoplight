/**
 * When an editor is allowed to save itself.
 *
 * Every test here is a refusal, because a refusal that fires when it should not is a write nobody
 * asked for, on somebody's file. The permissive case is one line and needs no defending.
 */
import { describe, expect, test } from "bun:test";
import { AUTOSAVE_QUIET_MS, autosaveNote, shouldAutosave } from "./autosave-core";

const state = (over: Partial<Parameters<typeof shouldAutosave>[0]> = {}) => ({
  enabled: true, dirty: true, saving: false, savable: true, ...over,
});

describe("shouldAutosave", () => {
  test("a dirty, savable piece saves once the typing stops", () => {
    expect(shouldAutosave(state())).toBe(true);
  });

  test("OFF MEANS OFF", () => {
    // The whole feature is opt-in. A setting that writes to somebody's files on a timer is not one
    // to switch on for them.
    expect(shouldAutosave(state({ enabled: false }))).toBe(false);
  });

  test("nothing to save is not a save", () => {
    expect(shouldAutosave(state({ dirty: false }))).toBe(false);
  });

  test("NEVER WHILE ONE IS ALREADY IN FLIGHT", () => {
    /**
     * Two overlapping saves race on the revision: the second carries the one the first is about to
     * replace, so it loses its conflict check and either fails confusingly or overwrites. Nothing
     * is dropped by waiting - the debounce restarts when the save finishes.
     */
    expect(shouldAutosave(state({ saving: true }))).toBe(false);
  });

  test("A PIECE THAT CANNOT BE SAVED IS NOT NAGGED ABOUT TWICE A SECOND", () => {
    /**
     * An editor mid-way through clearing a name is not an error to report every half second. The
     * manual save already says so once, when somebody actually asks for it.
     */
    expect(shouldAutosave(state({ savable: false }))).toBe(false);
  });
});

describe("the quiet period", () => {
  test("it is the pause the user asked for", () => {
    // Short enough that a pause to think already commits; long enough that ordinary typing rhythm
    // never triggers it mid-word.
    expect(AUTOSAVE_QUIET_MS).toBe(500);
  });
});

describe("autosaveNote", () => {
  test("IT SAYS WHEN AUTOSAVE IS ON BUT NOT RUNNING", () => {
    /**
     * The quiet lie that loses work: "autosave is on" beside an editor that has not saved in a
     * minute, because somebody stops pressing ctrl+s once a label tells them they need not.
     */
    expect(autosaveNote(state({ savable: false }))).toContain("cannot be saved yet");
  });

  test("nothing to say when it is off, or when it is simply working", () => {
    expect(autosaveNote(state({ enabled: false }))).toBeNull();
    expect(autosaveNote(state())).toBeNull();
  });
});
