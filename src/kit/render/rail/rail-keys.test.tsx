/** @jsxImportSource @opentui/react */
/**
 * The rail's keys, pressed for real through opentui.
 *
 * The bindings are decided in a table and tested there; this is the other half - that a real key
 * event actually reaches it. Both times the arrows were reported dead, the handler read correctly
 * and something else was wrong, so reading it is not evidence about what a terminal delivers.
 */
import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { settleRender, testRender } from "../test-render";
import { useRail } from "./use-rail";
import type { OutlineRow } from "../../../core/preset/outline";

const rows: OutlineRow[] = [
  { index: 0, id: "a", name: "First", enabled: true, marker: false, size: 3, role: "system" },
  { index: 1, id: "b", name: "Second", enabled: true, marker: false, size: 3, role: "system" },
];

let api: ReturnType<typeof useRail> | null = null;
/** Opened ONCE. Re-opening every render would make closing unobservable. */
let opened = false;

/** Mounts the rail, opens it, and records every step it is asked to make. */
function Harness({ steps, said }: { steps: number[]; said?: string[] }): ReactNode {
  const rail = useRail(() => 10, undefined, (delta) => { steps.push(delta); }, (text) => { said?.push(text); });
  if (!opened) { opened = true; rail.follow("p1", "First Preset", rows); }
  api = rail;
  return (
    <box>
      {rail.open ? <text>{rail.focused ? "focused" : "blurred"}</text> : <text>closed</text>}
      <text>{`pending=${rail.pending}`}</text>
      <text>{`name=${rail.pendingName ?? "-"}`}</text>
      <text>{`rows=${rail.state.rows.length}`}</text>
      <text>{`cursor=${rail.cursor ?? "-"}`}</text>
    </box>
  );
}

/**
 * Mounts and gives the rail the keyboard.
 *
 * The rail has no focus key of its own any more: Tab reaches in FROM the composer, and inside the
 * rail Tab is how you get back out. This harness has no composer, so it reaches in directly.
 */
async function railUnder(steps: number[], said?: string[]) {
  opened = false;
  const harness = await testRender(<Harness steps={steps} said={said} />, { width: 80, height: 24 });
  try {
    await settleRender();
    // Reached in from outside, the way a click or the composer Tab does. The rail has no focus key
    // of its own any more: ctrl+b is gone and Tab, inside it, is how you leave.
    api!.takeFocus();
    await settleRender();
  } catch (error) {
    await harness.renderer.destroy();
    throw error;
  }
  return harness;
}

describe("the step keys, pressed for real", () => {
  test("a bare right arrow asks for the next preset", async () => {
    const steps: number[] = [];
    opened = false;
    const { renderer, mockInput } = await testRender(<Harness steps={steps} />, { width: 80, height: 24 });
    try {
      await settleRender();
      mockInput.pressArrow("right");
      await settleRender();
      // Blurred: arrows reach the rail from the composer, which is where the cursor starts.
      expect(steps).toEqual([]);
    } finally { await renderer.destroy(); }
  });

  test("an arrow does nothing while the composer has the keyboard", async () => {
    // The guard that stops an open rail swallowing keys somebody is typing into a prompt.
    const steps: number[] = [];
    opened = false;
    const { mockInput, renderer } = await testRender(<Harness steps={steps} />, { width: 80, height: 24 });
    try {
      await settleRender();
      mockInput.pressArrow("right");
      await settleRender();
      expect(steps).toEqual([]);
    } finally { await renderer.destroy(); }
  });
});

describe("tab is the way out", () => {
  test("it hands the keyboard back rather than expanding a row", async () => {
    /**
     * Tab used to expand a row, a job Enter already did. It means "move focus" everywhere else, and
     * it replaced ctrl+b - a chord nothing on screen could teach you.
     */
    const { mockInput, renderer, captureCharFrame } = await railUnder([]);
    try {
      expect(captureCharFrame()).toContain("focused");
      mockInput.pressTab();
      await settleRender();
      expect(captureCharFrame()).toContain("blurred");
    } finally { await renderer.destroy(); }
  });
});

describe("escape means one thing", () => {
  test("with nothing staged it closes the rail", async () => {
    const { mockInput, renderer, captureCharFrame } = await railUnder([]);
    try {
      mockInput.pressEscape();
      await settleRender();
      expect(captureCharFrame()).toContain("closed");
    } finally { await renderer.destroy(); }
  });

  test("WITH WORK STAGED IT NEVER THROWS IT AWAY", async () => {
    /**
     * The old escape cleared a selection, then armed a drop, then dropped - three meanings, and the
     * destructive one behind the key people press to get out of trouble. Now it says what to press.
     */
    const said: string[] = [];
    const { mockInput, renderer, captureCharFrame } = await railUnder([], said);
    try {
      mockInput.pressKey(" ");
      await settleRender();
      expect(captureCharFrame()).toContain("pending=1");

      mockInput.pressEscape();
      await settleRender();
      mockInput.pressEscape();
      await settleRender();
      // Still there after two presses, which used to be the gesture that discarded it.
      expect(captureCharFrame()).toContain("pending=1");
      expect(said.join(" ")).toContain("ctrl+z");
    } finally { await renderer.destroy(); }
  });
});

describe("dropping is its own named key", () => {
  test("ctrl+z throws away what is staged, and says so", async () => {
    const said: string[] = [];
    const { mockInput, renderer, captureCharFrame } = await railUnder([], said);
    try {
      mockInput.pressKey(" ");
      await settleRender();
      mockInput.pressBackspace();
      await settleRender();
      expect(captureCharFrame()).toContain("rows=1");

      mockInput.pressKey("z", { ctrl: true });
      await settleRender();
      expect(captureCharFrame()).toContain("pending=0");
      expect(captureCharFrame()).toContain("rows=2");
      // The cursor came back to a row that exists, rather than pointing past the end.
      expect(captureCharFrame()).not.toContain("cursor=-");
      expect(said.join(" ")).toContain("Dropped");
    } finally { await renderer.destroy(); }
  });
});

describe("the two renames are different keys", () => {
  test("t renames the preset", async () => {
    // It was shift+R, one key from r, which renamed a block instead.
    const { mockInput, renderer, captureCharFrame } = await railUnder([]);
    try {
      mockInput.pressKey("t");
      await settleRender();
      mockInput.pressKey("!");
      await settleRender();
      mockInput.pressEnter();
      await settleRender();
      expect(captureCharFrame()).toContain("name=First Preset!");
    } finally { await renderer.destroy(); }
  });

  test("committing the name it already had stages nothing", async () => {
    // The phantom edit: an edit equal to what is stored is not an edit.
    const { mockInput, renderer, captureCharFrame } = await railUnder([]);
    try {
      mockInput.pressKey("t");
      await settleRender();
      mockInput.pressEnter();
      await settleRender();
      expect(captureCharFrame()).toContain("pending=0");
      expect(captureCharFrame()).toContain("name=-");
    } finally { await renderer.destroy(); }
  });
});
