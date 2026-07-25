/** @jsxImportSource @opentui/react */
/** Proves the transcript keeps native-feeling scrolling without painting an internal scrollbar. */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
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
