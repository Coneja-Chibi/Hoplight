/** Rendered-frame proof that an unbounded provider failure cannot flood the transcript. */
import { expect, test } from "bun:test";
import { testRender } from "../test-render";
import { ErrorRow, ERROR_ROW_CHARS } from "./error-row";

test("caps very long errors and marks the truncation", async () => {
  const rendered = await testRender(<ErrorRow text={`failure ${"x".repeat(ERROR_ROW_CHARS * 2)}`} />, {
    width: 80,
    height: 20,
  });
  try {
    await rendered.renderOnce();
    const frame = rendered.captureCharFrame();
    expect(frame).toContain("failure");
    expect(frame).toContain(String.fromCodePoint(0x2026));
    expect(frame.match(/x/g)?.length ?? 0).toBeLessThanOrEqual(ERROR_ROW_CHARS);
  } finally {
    await rendered.renderer.destroy();
  }
});
