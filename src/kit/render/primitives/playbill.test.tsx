/** Real-frame proof for the restored marquee and its compact fallback. */
import { expect, test } from "bun:test";
import { settleRender as tick, testRender } from "../test-render";
import { Playbill } from "./playbill";

test("wide terminals render the NOW PLAYING marquee without persistent inventory copy", async () => {
  const renderer = await testRender(
    <Playbill
      studioName="Hoplight Studio"
    />,
    { width: 110, height: 32 },
  );
  try {
    await tick();
    const frame = renderer.captureCharFrame();
    expect(frame).toContain("N O W");
    expect(frame).toContain("P L A Y I N G");
    expect(frame).toContain("Hoplight Studio");
    expect(frame).not.toContain("ctx");
    expect(frame).not.toContain("turn");
    expect(frame).not.toContain("session");
    expect(frame).not.toContain("16 pieces");
    expect(frame).not.toContain("nothing leaves");
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
    />,
    { width: 80, height: 12 },
  );
  try {
    await tick();
    const frame = renderer.captureCharFrame();
    expect(frame).toContain("Kit.");
    expect(frame).not.toContain("16 pieces");
    expect(frame).not.toContain("N O W");
  } finally {
    await renderer.renderer.destroy();
  }
});
