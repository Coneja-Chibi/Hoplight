/** Rendered-frame regression proof that the large opening monologue keeps its five stage cues. */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { OpeningBanner } from "./opening-banner";

const tick = (ms = 60): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

test("large opening banner renders every friendly stage cue", async () => {
  const renderer = await testRender(
    <OpeningBanner studioName="Hoplight Studio" totalPieces={16} animate={false} />,
    { width: 120, height: 48 },
  );
  try {
    await tick();
    const frame = renderer.captureCharFrame();
    for (const codePoint of [0x1f44b, 0x1f3ad, 0x2728, 0x1f512, 0x1f407]) {
      expect(frame).toContain(String.fromCodePoint(codePoint));
    }
    expect(frame).toContain("Hey, welcome in.");
    expect(frame).toContain("Two promises:");
  } finally {
    await renderer.renderer.destroy();
  }
});

test("wide opening composition sits centered on the terminal stage", async () => {
  const width = 160;
  const renderer = await testRender(
    <OpeningBanner studioName="Hoplight Studio" totalPieces={16} animate={false} />,
    { width, height: 48 },
  );
  try {
    await tick();
    const rows = renderer.captureCharFrame().split("\n");
    const cueRow = rows.findIndex((row) => row.includes("Hey, welcome in."));
    const artRows = rows.slice(0, cueRow).filter((row) => row.includes("█"));
    const left = Math.min(...artRows.map((row) => row.indexOf("█")));
    const right = Math.max(...artRows.map((row) => row.lastIndexOf("█")));

    expect(artRows.length).toBeGreaterThan(0);
    expect(Math.abs(left - (width - 1 - right))).toBeLessThanOrEqual(1);
    expect(rows[cueRow]?.indexOf("Hey, welcome in.")).toBeGreaterThan(left);
  } finally {
    await renderer.renderer.destroy();
  }
});

test("compact terminals keep the complete greeting under a small rainbow mark", async () => {
  const renderer = await testRender(
    <OpeningBanner studioName="Hoplight Studio" totalPieces={16} animate={false} />,
    { width: 72, height: 24 },
  );
  try {
    await tick();
    const frame = renderer.captureCharFrame();
    expect(frame).toContain("█");
    expect(frame).toContain("Hey, welcome in.");
    expect(frame).toContain("Everything you've made");
    expect(frame).toContain("Try saying:");
    expect(frame).toContain("Two promises:");
    expect(frame).toContain("Ready?");
    expect(frame).toContain("Go make something you love.");
  } finally {
    await renderer.renderer.destroy();
  }
});
