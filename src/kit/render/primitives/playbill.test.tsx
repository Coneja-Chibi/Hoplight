/** Real-frame proof for the restored marquee and its compact fallback. */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { EMPTY_USAGE } from "../../providers/usage";
import { Playbill } from "./playbill";

const tick = (ms = 60): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

test("wide terminals render the NOW PLAYING marquee and live status without deck inventory", async () => {
  const renderer = await testRender(
    <Playbill
      studioName="Hoplight Studio"
      totalPieces={16}
      provider={{ name: "NanoGPT", model: "glm" }}
      turnUsage={{ ...EMPTY_USAGE, input: 120, output: 30, total: 150 }}
      sessionUsage={{ ...EMPTY_USAGE, input: 300, output: 100, total: 400 }}
      contextMax={1000}
    />,
    { width: 110, height: 32 },
  );
  try {
    await tick();
    const frame = renderer.captureCharFrame();
    expect(frame).toContain("N O W");
    expect(frame).toContain("P L A Y I N G");
    expect(frame).toContain("Hoplight Studio");
    expect(frame).toContain("16 pieces in the wings");
    expect(frame).toContain("ctx");
    expect(frame).toContain("session");
    expect(frame).not.toContain("decks");
    expect(frame).not.toContain("Characters");
  } finally {
    await renderer.renderer.destroy();
  }
});

test("short terminals keep the compact Kit masthead", async () => {
  const renderer = await testRender(
    <Playbill
      studioName="Hoplight Studio"
      totalPieces={16}
      provider={null}
      turnUsage={EMPTY_USAGE}
      sessionUsage={EMPTY_USAGE}
      contextMax={undefined}
    />,
    { width: 80, height: 12 },
  );
  try {
    await tick();
    const frame = renderer.captureCharFrame();
    expect(frame).toContain("Kit.");
    expect(frame).toContain("16 pieces");
    expect(frame).not.toContain("N O W");
  } finally {
    await renderer.renderer.destroy();
  }
});
