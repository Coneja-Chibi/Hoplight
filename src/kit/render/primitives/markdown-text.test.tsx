/** Rendered-frame proof for transcript Markdown's terminal-native diff playbill. */
import { expect, test } from "bun:test";
import { testRender } from "../test-render";
import { MarkdownText } from "./markdown-text";

test("renders a fenced patch as a counted diff playbill", async () => {
  const rendered = await testRender(
    <MarkdownText text={"```diff\n--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n```"} />,
    { width: 60, height: 10 },
  );
  try {
    await rendered.renderOnce();
    const frame = rendered.captureCharFrame();
    expect(frame).toContain("DIFF +1 -1");
    expect(frame).toContain("-old");
    expect(frame).toContain("+new");
  } finally {
    await rendered.renderer.destroy();
  }
});

test("renders a resolved stored piece marker as a compact card", async () => {
  const rendered = await testRender(
    <MarkdownText
      text="Ask @character:basil-1 tonight."
      pieces={[{ id: "basil-1", kind: "character", name: "Basil", hasPortrait: true }]}
    />,
    { width: 60, height: 4 },
  );
  try {
    await rendered.renderOnce();
    const frame = rendered.captureCharFrame();
    expect(frame).toContain("[* Basil · character]");
    expect(frame).not.toContain("@character:basil-1");
  } finally {
    await rendered.renderer.destroy();
  }
});
