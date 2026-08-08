/**
 * What the Workbench tells the agent about somebody's half-finished work.
 *
 * These assertions are about the difference between a helpful answer and a destructive one. The
 * bench is the only screen holding drafts that are not on disk, so a swallowed dirty mark is how an
 * agent ends up cheerfully suggesting that a tab be closed.
 */
import { describe, expect, test } from "bun:test";
import { workbenchAgentState } from "./agent-surface";

const piece = (kind: string, id: string, name: string, focusEntry?: string) => ({
  kind,
  id,
  name,
  ...(focusEntry ? { params: { focusEntry } } : {}),
});

const base = {
  pieces: [piece("character", "adrian", "Adrian"), piece("lorebook", "harbor", "The Harbor")],
  activeKey: "character:adrian",
  besideKey: "",
  dirty: new Set<string>(),
};

describe("workbenchAgentState", () => {
  test("the focused piece is the one being edited, not merely the first tab", () => {
    // "listed" and "looking at" are the whole reason SurfaceItem carries a focused flag; a bench
    // with six tabs answers a question about "this character" with exactly one of them.
    const state = workbenchAgentState(base);

    expect(state.headline).toContain("editing Adrian");
    expect(state.items?.find((i) => i.id === "adrian")?.focused).toBe(true);
    expect(state.items?.find((i) => i.id === "harbor")?.focused).toBeUndefined();
  });

  test("UNSAVED WORK IS NAMED, and it leads the notes", () => {
    /**
     * The item flags alone are not enough: briefText caps items at twelve, so on a busy bench the
     * thirteenth tab's unsaved dot is simply not in the text the model receives. The note is what
     * survives the cap, and it goes first because it is the fact that makes a reasonable-sounding
     * suggestion ("close that and open the other one") cost somebody their afternoon.
     */
    const state = workbenchAgentState({ ...base, dirty: new Set(["lorebook:harbor"]) });

    expect(state.notes?.[0]).toContain("1 open piece(s) carry unsaved work");
    expect(state.notes?.[0]).toContain("The Harbor");
    expect(state.notes?.[0]).toContain("not on disk yet");
    expect(state.items?.find((i) => i.id === "harbor")?.dirty).toBe(true);
    expect(state.items?.find((i) => i.id === "adrian")?.dirty).toBeUndefined();
  });

  test("dirty is looked up by entity key, so a lorebook opened on an entry still reports it", () => {
    /**
     * The shell writes dirtyPieces under "kind:id" while a pane is "kind:id@entry" (app-contract:
     * "pane key is kind:id@focusEntry; dirty stays kind:id"). Looking dirty up by pane key compiles,
     * runs, and silently reports every entry-focused lorebook as saved - and that is the piece most
     * likely to be open twice and half-edited.
     */
    const state = workbenchAgentState({
      pieces: [piece("lorebook", "harbor", "The Harbor", "docks")],
      activeKey: "lorebook:harbor@docks",
      besideKey: "",
      dirty: new Set(["lorebook:harbor"]),
    });

    expect(state.items?.[0]?.dirty).toBe(true);
    expect(state.items?.[0]?.focused).toBe(true);
  });

  test("one book open on two entries reads as two distinguishable panes", () => {
    // Without the entry in the name the brief carries two identical lines, one of which says
    // "focused" - and nothing in the text says which entry either of them is.
    const state = workbenchAgentState({
      pieces: [piece("lorebook", "harbor", "The Harbor", "docks"), piece("lorebook", "harbor", "The Harbor", "tide")],
      activeKey: "lorebook:harbor@docks",
      besideKey: "lorebook:harbor@tide",
      dirty: new Set<string>(),
    });

    expect(state.items?.[0]?.name).toBe("The Harbor (open on entry docks)");
    expect(state.items?.[1]?.name).toBe("The Harbor (open on entry tide)");
  });

  test("a split says both panes are on screen rather than claiming two focused pieces", () => {
    // SurfaceItem has one focused flag and the stage can show two panes. Marking both would report
    // two focused pieces and mean neither, so the second one is a note.
    const state = workbenchAgentState({
      ...base,
      besideKey: "lorebook:harbor",
      dirty: new Set(["lorebook:harbor"]),
    });

    const split = state.notes?.find((n) => n.includes("pinned beside")) ?? "";
    expect(split).toContain("The Harbor is pinned beside Adrian");
    expect(state.items?.filter((i) => i.focused === true)).toHaveLength(1);
    // the pinned pane is still where the unsaved work is, and that must not go quiet in a split
    expect(state.items?.find((i) => i.id === "harbor")?.dirty).toBe(true);
  });

  test("an empty bench says where pieces come from instead of nothing at all", () => {
    // "The Workbench" on its own reads as a room the agent cannot help with; the missing step is the
    // only useful thing there is to say here.
    const state = workbenchAgentState({ pieces: [], activeKey: "", besideKey: "", dirty: new Set() });

    expect(state.headline).toBe("The Workbench, with nothing open.");
    expect(state.items).toHaveLength(0);
    expect(state.notes?.join(" ")).toContain("from the Library");
  });
});
