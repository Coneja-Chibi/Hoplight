/** @jsxImportSource @opentui/react */
/**
 * Clicking a row, at the surface rather than under it.
 *
 * The rail used to have FOUR click targets in one row - the mark toggled, the caret expanded, the
 * name renamed, the size rewrote - two of them a single character wide, and the largest of them
 * wired to the least likely thing anybody meant. Miss by one column and a block switched off instead
 * of opening. Reported as "clicking is hard as well".
 *
 * Now: click selects, double-click edits, and the on/off mark is the only thing inside the row that
 * takes a click of its own.
 */
import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { settleRender, testRender } from "../test-render";
import { useRail } from "./use-rail";
import type { OutlineRow } from "../../../core/preset/outline";

const rows: OutlineRow[] = [
  { index: 0, id: "a", name: "First", enabled: true, marker: false, size: 30, role: "system" },
  { index: 1, id: "b", name: "Second", enabled: true, marker: false, size: 30, role: "system" },
];

/** Mounts the rail and exposes it, so a test can click the way the pane does. */
function harness(edits: string[]) {
  let api: ReturnType<typeof useRail> | null = null;
  function Harness(): ReactNode {
    const rail = useRail(
      () => 10, undefined, undefined, undefined,
      (blockId) => { edits.push(blockId); },
    );
    if (!rail.open) rail.follow("p1", "First Preset", rows, new Map([["a", "text of a"]]));
    api = rail;
    return <text>{`cursor=${rail.cursor ?? "-"} selected=${rail.state.selected.size}`}</text>;
  }
  return { Harness, get: () => api! };
}

const plain = { shift: false, ctrl: false };

describe("one click", () => {
  test("selects the row and does not open anything", async () => {
    const edits: string[] = [];
    const h = harness(edits);
    const { renderer, captureCharFrame } = await testRender(<h.Harness />, { width: 60, height: 8 });
    try {
      await settleRender();
      h.get().onRowDown("b", plain);
      await settleRender();
      expect(captureCharFrame()).toContain("cursor=b");
      expect(edits).toEqual([]);
    } finally { await renderer.destroy(); }
  });
});

describe("two clicks", () => {
  test("on the same row, opens its editor", async () => {
    const edits: string[] = [];
    const h = harness(edits);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 8 });
    try {
      await settleRender();
      h.get().onRowDown("a", plain);
      h.get().onRowDown("a", plain);
      await settleRender();
      expect(edits).toEqual(["a"]);
    } finally { await renderer.destroy(); }
  });

  test("on DIFFERENT rows, opens nothing", async () => {
    // Twenty-three rows in a narrow rail; clicking two neighbours quickly is ordinary.
    const edits: string[] = [];
    const h = harness(edits);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 8 });
    try {
      await settleRender();
      h.get().onRowDown("a", plain);
      h.get().onRowDown("b", plain);
      await settleRender();
      expect(edits).toEqual([]);
    } finally { await renderer.destroy(); }
  });

  test("three clicks open it once, not twice", async () => {
    // A double resets the pair; otherwise the third click opens a second editor over the first.
    const edits: string[] = [];
    const h = harness(edits);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 8 });
    try {
      await settleRender();
      h.get().onRowDown("a", plain);
      h.get().onRowDown("a", plain);
      h.get().onRowDown("a", plain);
      await settleRender();
      expect(edits).toEqual(["a"]);
    } finally { await renderer.destroy(); }
  });
});

describe("a modified click is never a double", () => {
  test("shift builds a selection instead of opening an editor", async () => {
    /**
     * Shift and ctrl are how a multi-select is made. Turning the second of those into an editor
     * would take over the screen halfway through choosing what to act on.
     */
    const edits: string[] = [];
    const h = harness(edits);
    const { renderer, captureCharFrame } = await testRender(<h.Harness />, { width: 60, height: 8 });
    try {
      await settleRender();
      h.get().onRowDown("a", plain);
      h.get().onRowDown("b", { shift: true, ctrl: false });
      h.get().onRowDown("b", { shift: true, ctrl: false });
      await settleRender();
      expect(edits).toEqual([]);
      expect(captureCharFrame()).not.toContain("selected=0");
    } finally { await renderer.destroy(); }
  });

  test("ctrl does the same", async () => {
    const edits: string[] = [];
    const h = harness(edits);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 8 });
    try {
      await settleRender();
      h.get().onRowDown("a", { shift: false, ctrl: true });
      h.get().onRowDown("a", { shift: false, ctrl: true });
      await settleRender();
      expect(edits).toEqual([]);
    } finally { await renderer.destroy(); }
  });
});

describe("clicking gives the rail the keyboard", () => {
  test("because Enter belongs to whoever has focus", async () => {
    // A rename staged by clicking used to go to the composer and vanish.
    const h = harness([]);
    const { renderer } = await testRender(<h.Harness />, { width: 60, height: 8 });
    try {
      await settleRender();
      expect(h.get().focused).toBe(false);
      h.get().onRowDown("a", plain);
      await settleRender();
      expect(h.get().focused).toBe(true);
    } finally { await renderer.destroy(); }
  });
});
