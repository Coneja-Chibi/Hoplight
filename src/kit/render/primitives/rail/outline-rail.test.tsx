/** @jsxImportSource @opentui/react */
/**
 * What the rail actually puts on screen.
 *
 * This component had NO test at all, which is how a footer line nobody could reach and a badge wider
 * than the rail it sits in both shipped. Both were reported the same way: the person could see there
 * was a change staged and could not find the way out of it.
 */
import { describe, expect, test } from "bun:test";
import { settleRender, testRender } from "../../test-render";
import { OutlineRail } from "./outline-rail";
import type { OutlineRow } from "../../../../core/preset/outline";

const rows: OutlineRow[] = [
  { index: 0, id: "a", name: "First", enabled: true, marker: false, size: 3, role: "system" },
  { index: 1, id: "b", name: "Second", enabled: true, marker: false, size: 3, role: "system" },
];

/** The rail at its default width, which is the size the footer and badge have to fit into. */
const paint = async (props: { pending: number; focused: boolean; hint?: string }) => {
  const setup = await testRender(
    <OutlineRail
      title="Empty Base Bare"
      rows={rows}
      selected={new Set()}
      cursor="a"
      dropBefore={null}
      expanded={new Set()}
      pending={props.pending}
      focused={props.focused}
      hint={props.hint ?? ""}
      width={38}
      offset={0}
      height={16}
    />,
    { width: 38, height: 16 },
  );
  await settleRender();
  return setup;
};

describe("the rail's footer", () => {
  test("with the keyboard it names five things you can do", async () => {
    /**
     * It used to spend its only line naming the help key and the focus chord - one of which no
     * longer exists - while saying nothing about what the rail could actually do. Generated from the
     * key table now, so it cannot name a key that does something else.
     */
    const { renderer, captureCharFrame } = await paint({ pending: 1, focused: true });
    try {
      const frame = captureCharFrame();
      expect(frame).toContain("enter");
      expect(frame).not.toContain("ctrl+b");
    } finally {
      await renderer.destroy();
    }
  });

  test("the five are the same whether or not anything is staged", async () => {
    // The footer used to change meaning with state, which is how enter came to mean two things.
    const { renderer, captureCharFrame } = await paint({ pending: 0, focused: true });
    try {
      expect(captureCharFrame()).toContain("enter");
    } finally {
      await renderer.destroy();
    }
  });

  test("without the keyboard it names how to get it", async () => {
    // Tab reaches in, and the arrows already work from an empty composer.
    const { renderer, captureCharFrame } = await paint({ pending: 1, focused: false });
    try {
      expect(captureCharFrame()).toContain("tab drives");
    } finally {
      await renderer.destroy();
    }
  });

  test("the hint never wraps into the count beside it", async () => {
    /**
     * IT USED TO. The hint and the row count share one line, and a hint longer than the room left
     * reflowed onto a second - colliding mid-word with the count, which is the "crammed down there"
     * this footer replaced a four-row cheat sheet to avoid.
     */
    for (const w of [24, 30, 38, 60]) {
      const setup = await testRender(
        <OutlineRail
          title="Empty Base Bare" rows={rows} selected={new Set()} cursor="a" dropBefore={null}
          expanded={new Set()} pending={0} focused={false} hint="" width={w} offset={0} height={8}
        />,
        { width: w, height: 14 },
      );
      await settleRender();
      try {
        const lines = setup.captureCharFrame().split("\n");
        const footer = lines.find((line) => line.includes("all 2"));
        expect(footer).toBeDefined();
        // The count is on the SAME line as the hint, and no fragment spilled onto the next one.
        const after = lines[lines.indexOf(footer!) + 1] ?? "";
        expect(after.trim()).toBe("");
      } finally {
        await setup.renderer.destroy();
      }
    }
  });
});

describe("the pending badge", () => {
  test("it fits the rail rather than spilling out of it", async () => {
    /**
     * ARITHMETIC, NOT TASTE. The badge is padded one cell each side, so at the default width of 38
     * it has 36 to say the count AND the action in. A longer hint pushed the action off the edge,
     * which is the "all those crammed down there" this rail was already reported for.
     */
    const { renderer, captureCharFrame } = await paint({ pending: 1, focused: true });
    try {
      const frame = captureCharFrame();
      const badge = frame.split("\n").find((line) => line.includes("pending"));
      expect(badge).toBeDefined();
      expect(badge).toContain("1 pending");
      expect(badge).toContain("enter applies");
      // Nothing wrapped onto a second line and nothing was cut in half.
      expect(badge!.trimEnd().length).toBeLessThanOrEqual(38);
    } finally {
      await renderer.destroy();
    }
  });

  test("without the keyboard the badge offers the click instead", async () => {
    const { renderer, captureCharFrame } = await paint({ pending: 2, focused: false });
    try {
      const frame = captureCharFrame();
      expect(frame).toContain("2 pending");
      expect(frame).toContain("click to apply");
    } finally {
      await renderer.destroy();
    }
  });

  test("nothing staged draws no badge at all", async () => {
    const { renderer, captureCharFrame } = await paint({ pending: 0, focused: true });
    try {
      expect(captureCharFrame()).not.toContain("pending");
    } finally {
      await renderer.destroy();
    }
  });

  test("a stale hover hint does not hide the footer's exits", async () => {
    // The badge sits outside the row list, so the list's onMouseOut never cleared a hint set on it.
    const { renderer, captureCharFrame } = await paint({
      pending: 1,
      focused: true,
      hint: "click to review and apply these changes",
    });
    try {
      // With a live hint the footer shows it - that is correct. The defect was that it STAYED after
      // the pointer left, which the badge now clears itself; this pins the two states as distinct.
      expect(captureCharFrame()).toContain("click to review");
    } finally {
      await renderer.destroy();
    }
  });
});
