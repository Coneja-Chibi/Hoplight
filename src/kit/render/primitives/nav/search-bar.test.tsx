/** @jsxImportSource @opentui/react */
/**
 * Search bar render: prove that typing a query draws the bar, the live count, and the hint row, that
 * the matches are lifted up through onView, and that esc restores the composer (calls onClose).
 */
import { expect, test } from "bun:test";
import { settleRender as tick, testRender } from "../../test-render";
import { SearchBar, type SearchView } from "./search-bar";
import type { RenderLine } from "../../turn-events";

const lines: RenderLine[] = [
  { role: "you", text: "how many characters do I have" },
  { role: "say", text: "You have 13 characters. Newest is Basil." },
];

test("typing a query draws the bar, the count, and the hint row, and lifts the matches", async () => {
  const views: SearchView[] = [];
  const t = await testRender(
    <SearchBar lines={lines} onClose={() => {}} onScrollToLine={() => {}} onView={(v) => views.push(v)} />,
    { width: 70, height: 8 },
  );
  try {
    await t.waitForFrame((frame) => frame.includes("find"), { maxPasses: 200 });
    await t.mockInput.typeText("character");
    await tick(40);
    const frame = await t.waitForFrame((f) => f.includes("1 of 2"), { maxPasses: 200 });
    expect(frame).toContain("find");
    expect(frame).toContain("next"); // hint row
    expect(frame).toContain("close");
    expect(views.at(-1)!.matches.length).toBe(2); // "characters" on both lines
  } finally {
    await t.renderer.destroy();
  }
});

test("Enter advances the cursor and pulls the active line into view (the navigating state)", async () => {
  const scrolled: number[] = [];
  const t = await testRender(
    <SearchBar lines={lines} onClose={() => {}} onScrollToLine={(i) => scrolled.push(i)} onView={() => {}} />,
    { width: 70, height: 8 },
  );
  try {
    await t.waitForFrame((frame) => frame.includes("find"), { maxPasses: 200 });
    await t.mockInput.typeText("character");
    await t.waitForFrame((f) => f.includes("1 of 2"), { maxPasses: 200 });
    scrolled.length = 0; // drop the initial snap-to-first so we watch only the step
    t.mockInput.pressEnter();
    await tick(40);
    const frame = await t.waitForFrame((f) => f.includes("2 of 2"), { maxPasses: 200 });
    expect(frame).toContain("2 of 2");
    expect(scrolled.at(-1)).toBe(1); // the second hit sits on line index 1
  } finally {
    await t.renderer.destroy();
  }
});

test("esc restores the composer by calling onClose", async () => {
  let closed = false;
  const t = await testRender(
    <SearchBar lines={lines} onClose={() => { closed = true; }} onScrollToLine={() => {}} onView={() => {}} />,
    { width: 70, height: 8 },
  );
  try {
    await t.waitForFrame((frame) => frame.includes("find"), { maxPasses: 200 });
    t.mockInput.pressEscape();
    for (let i = 0; i < 50 && !closed; i++) await tick();
    expect(closed).toBe(true);
  } finally {
    await t.renderer.destroy();
  }
});
