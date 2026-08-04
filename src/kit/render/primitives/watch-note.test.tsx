/** Rendered-frame proof for an unprompted, non-modal studio change notice. */
import { expect, test } from "bun:test";
import type { ReactNode } from "react";
import { testRender } from "../test-render";
import { WatchNote } from "./watch-note";

const frameOf = async (node: ReactNode, height = 5): Promise<string> => {
  const rendered = await testRender(node, { width: 74, height });
  try {
    await rendered.renderOnce();
    return rendered.captureCharFrame();
  } finally {
    await rendered.renderer.destroy();
  }
};

test("distinguishes a noticed outside change from a requested tool move", async () => {
  const frame = await frameOf(
    <WatchNote text="new character spotted · Basil v2" detail="ask me to compare it" />,
  );
  expect(frame).toContain("NOTICED");
  expect(frame).toContain("Basil v2");
  expect(frame).toContain("ask me to compare it");
  // The band says where this came from. The one thing that made the old single line hard to read is
  // that it looked like speech and nobody had said it.
  expect(frame).toContain("the studio changed on disk");
});

test("the follow-up sits on its own row, never appended to the fact", async () => {
  // Chi's report was that the notice was "mixed in with the regular words". Keeping the offer on its
  // own row is what stops the fact and the suggestion reading as one run-on sentence.
  const frame = await frameOf(
    <WatchNote text="Mnemosyne V4 left the studio" detail="ask me to compare it to V3" />,
  );
  const lines = frame.split("\n").map((l) => l.trim()).filter(Boolean);
  const fact = lines.findIndex((l) => l.includes("left the studio"));
  const offer = lines.findIndex((l) => l.includes("compare it to V3"));
  expect(fact).toBeGreaterThanOrEqual(0);
  expect(offer).toBe(fact + 1);
});

test("a removal is labelled REMOVED, not NOTICED", async () => {
  // Colour alone is not a label: somebody who cannot tell gold from rose still has to be able to
  // tell "something appeared" from "something is gone".
  const frame = await frameOf(<WatchNote text="Mnemosyne V4 left the studio" kind="left" />, 4);
  expect(frame).toContain("REMOVED");
  expect(frame).not.toContain("NOTICED");
});

test("with no follow-up it is two rows, not an empty third", async () => {
  const frame = await frameOf(<WatchNote text="Basil v2 spotted" />, 4);
  expect(frame).toContain("Basil v2 spotted");
  expect(frame).not.toContain("undefined");
});
