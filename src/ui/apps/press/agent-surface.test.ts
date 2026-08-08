/**
 * What the Press tells the agent about a conversion that has not happened yet.
 *
 * The assertions are about sentences a model will act on. This room is where somebody's pieces leave
 * Hoplight for another platform, so "it printed" when three rows were skipped is not a rounding
 * error - it is an agent telling somebody their lorebooks shipped when no file was ever written.
 */
import { describe, expect, test } from "bun:test";
import { pressAgentState } from "./agent-surface";
import type { RunRow } from "./press-core";

const piece = (kind: string, id: string, name: string) => ({ kind, id, name });

const base = {
  queue: [piece("character", "adrian", "Adrian"), piece("lorebook", "harbor", "The Harbor")],
  target: "SillyTavern",
  rows: null,
  running: false,
  zipReady: false,
  loadFailed: false,
};

describe("pressAgentState", () => {
  test("the queue is what is on screen, and the target is part of the headline", () => {
    // One target per run is the whole grammar of this room; a queue described without it invites an
    // answer about a conversion that has no destination.
    const state = pressAgentState(base);

    expect(state.headline).toContain("2 piece(s) staged");
    expect(state.headline).toContain("set to print for SillyTavern");
    expect(state.items).toHaveLength(2);
  });

  test("no chosen target is said plainly, because the room looks ready without one", () => {
    // The queue renders identically with and without a platform picked; only the disabled lever says
    // otherwise, and a model reading item counts cannot see a disabled button.
    const state = pressAgentState({ ...base, target: "" });

    expect(state.headline).toContain("no target platform chosen");
    expect(state.notes?.join(" ")).toContain("nothing can print until one is picked");
  });

  test("ROWS THAT DID NOT PRINT ARE NAMED WITH THEIR REASON, not folded into a total", () => {
    /**
     * "8 printed" and "8 printed, 3 skipped because this platform has no lorebook format" describe
     * the same run, and only one of them tells somebody their lorebooks are not in the zip.
     */
    const rows: RunRow[] = [
      { id: "adrian", kind: "character", name: "Adrian", status: "ok", filename: "adrian.json" },
      { id: "harbor", kind: "lorebook", name: "The Harbor", status: "skip", note: "RisuAI has no lorebook format" },
      { id: "vic", kind: "character", name: "Vic", status: "fail", note: "empty export payload" },
    ];
    const state = pressAgentState({ ...base, rows });

    const trouble = state.notes?.find((n) => n.includes("did not print")) ?? "";
    expect(trouble).toContain("2 row(s)");
    expect(trouble).toContain("lorebook/harbor (skip: RisuAI has no lorebook format)");
    expect(trouble).toContain("character/vic (fail: empty export payload)");
  });

  test("a run still printing is not described as a finished one", () => {
    // The rows are mid-flight and change under the reader; calling that "the last run" would report
    // a partial tally as a final one.
    const rows: RunRow[] = [
      { id: "adrian", kind: "character", name: "Adrian", status: "ok" },
      { id: "harbor", kind: "lorebook", name: "The Harbor", status: "wait" },
    ];
    const live = pressAgentState({ ...base, rows, running: true });
    const done = pressAgentState({ ...base, rows, running: false });

    expect(live.notes?.join(" ")).toContain("A run is printing now");
    expect(done.notes?.join(" ")).toContain("The last run");
  });

  test("AN UNREACHABLE STUDIO IS NOT A CLEAN SHEET, and it is said first", () => {
    /**
     * The staged queue is shell state and survives a failed load, so the room still shows pieces -
     * but every readiness line and every target chip came from the studio. Silence there renders as
     * "this piece has nothing to warn you about", which is the opposite of the truth.
     */
    const state = pressAgentState({ ...base, loadFailed: true });

    expect(state.notes?.[0]).toContain("could not be reached");
    expect(state.notes?.[0]).toContain("readiness check");
  });

  test("an undownloaded bundle is worth saying before anything suggests leaving", () => {
    // The zip lives in memory on this screen. Navigating away is what loses it, and nothing else on
    // the surface would tell a model that a finished run is still sitting there.
    const state = pressAgentState({ ...base, zipReady: true });

    expect(state.notes?.join(" ")).toContain("has not been downloaded yet");
  });

  test("an empty queue says how pieces get here, since this room cannot browse for them", () => {
    // There is no studio browser in the Press. An agent that did not know would offer to stage from
    // a shelf that is not on this screen.
    const state = pressAgentState({ ...base, queue: [] });

    expect(state.headline).toBe("The Press, with nothing staged.");
    expect(state.notes?.join(" ")).toContain("staged from the Library");
  });
});
