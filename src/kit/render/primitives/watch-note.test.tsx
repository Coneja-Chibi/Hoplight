/** Rendered-frame proof for an unprompted, non-modal studio change notice. */
import { expect, test } from "bun:test";
import { testRender } from "../test-render";
import { WatchNote } from "./watch-note";

test("distinguishes a noticed outside change from a requested tool move", async () => {
  const rendered = await testRender(
    <WatchNote text="new character spotted · Basil v2 · ask me to compare it" />,
    { width: 72, height: 3 },
  );
  try {
    await rendered.renderOnce();
    const frame = rendered.captureCharFrame();
    expect(frame).toContain("NOTICED");
    expect(frame).toContain("Basil v2");
    expect(frame).toContain("ask me to compare it");
  } finally {
    await rendered.renderer.destroy();
  }
});
