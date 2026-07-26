/** @jsxImportSource @opentui/react */
import { expect, setDefaultTimeout, test } from "bun:test";
import { settleRender as tick, testRender } from "../../test-render";
import type { RenderLine } from "../../turn-events";
import { SearchCard } from "./search-card";

setDefaultTimeout(30000);
test("a long result set keeps the query header and active result visible", async () => {
  const lines: RenderLine[] = Array.from({ length: 100 }, (_, index) => ({
    role: "say",
    text: `hit ${String(index).padStart(2, "0")}`,
  }));
  const t = await testRender(<SearchCard lines={lines} onClose={() => {}} />, { width: 68, height: 16 });
  try {
    await tick();
    await t.mockInput.typeText("hit");
    await tick();
    for (let i = 0; i < 15; i += 1) t.mockInput.pressKey("ARROW_DOWN");
    await tick();
    const frame = t.captureCharFrame();
    expect(frame).toContain("SEARCH");
    expect(frame).toContain("16/99");
    expect(frame).toContain("hit 15");
  } finally {
    await t.renderer.destroy();
  }
});
