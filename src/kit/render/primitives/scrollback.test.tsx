/** @jsxImportSource @opentui/react */
/** Proves the transcript keeps native-feeling scrolling without painting an internal scrollbar. */
import { expect, test } from "bun:test";
import { testRender } from "../test-render";
import type { ScrollBoxRenderable } from "@opentui/core";
import { Scrollback } from "./scrollback";

test("hides the painted scrollbar while retaining scroll movement", async () => {
  const rendered = await testRender(
    <Scrollback>
      {Array.from({ length: 20 }, (_, index) => (
        <text key={index}>line {index}</text>
      ))}
    </Scrollback>,
    { width: 40, height: 8 },
  );
  try {
    await rendered.renderOnce();
    const scrollbox = rendered.renderer.root.findDescendantById(
      "kit-scrollback",
    ) as ScrollBoxRenderable;
    expect(scrollbox.verticalScrollBar.visible).toBe(false);

    const before = scrollbox.scrollTop;
    scrollbox.scrollBy(-2, "absolute");
    expect(scrollbox.scrollTop).toBeLessThan(before);
  } finally {
    await rendered.renderer.destroy();
  }
});

test("forwards the scrollbox ref to the shared navigation seam", async () => {
  let captured: ScrollBoxRenderable | null = null;
  const rendered = await testRender(
    <Scrollback scrollRef={(value) => {
      captured = value;
    }}>
      <text>one line</text>
    </Scrollback>,
    { width: 40, height: 8 },
  );
  try {
    await rendered.renderOnce();
    expect((captured as ScrollBoxRenderable | null)?.id).toBe("kit-scrollback");
  } finally {
    await rendered.renderer.destroy();
  }
});
