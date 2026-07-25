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
