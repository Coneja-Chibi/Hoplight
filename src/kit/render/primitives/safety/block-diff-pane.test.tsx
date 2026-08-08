/** @jsxImportSource @opentui/react */
/**
 * The rewrite pane, drawn.
 *
 * The whole reason it exists is that the review card cut every value at 48 characters, so the one
 * thing these tests must hold is that the WORDS ARE ON SCREEN - both sides, in full.
 */
import { describe, expect, test } from "bun:test";
import { settleRender, testRender } from "../../test-render";
import { BlockDiffPane } from "./block-diff-pane";
import type { RewrittenBlock } from "../../diff/rewritten-block";

const BLOCK: RewrittenBlock = {
  id: "cot",
  name: "CoT",
  before: ["Think step by step.", "Keep it brief and hidden.", "Then write."].join("\n"),
  after: ["Think step by step.", "Keep it brief. Never show it.", "Then write."].join("\n"),
};

const paint = async (draft: string, editing = false) => {
  const setup = await testRender(
    <BlockDiffPane block={BLOCK} draft={draft} editing={editing} />,
    { width: 76, height: 24 },
  );
  await settleRender();
  return setup;
};

describe("the words are on screen", () => {
  test("both sides in full, not a count", () => {
    return paint(BLOCK.after).then(async ({ renderer, captureCharFrame }) => {
      try {
        const frame = captureCharFrame();
        // The line the rewrite removes, and the line it adds. Neither survived the old card.
        expect(frame).toContain("Keep it brief and hidden.");
        expect(frame).toContain("Keep it brief. Never show it.");
        expect(frame).not.toContain("rewritten -> 1");
      } finally { await renderer.destroy(); }
    });
  });

  test("the removed line is marked on the before side", async () => {
    const { renderer, captureCharFrame } = await paint(BLOCK.after);
    try {
      const line = captureCharFrame().split("\n").find((l) => l.includes("and hidden"));
      expect(line).toContain("-");
    } finally { await renderer.destroy(); }
  });

  test("it names the block, so you know what you are approving", () => {
    // The old rows named nothing: "switched off -> 1" could be any block in the preset.
    return paint(BLOCK.after).then(async ({ renderer, captureCharFrame }) => {
      try {
        expect(captureCharFrame()).toContain("CoT");
      } finally { await renderer.destroy(); }
    });
  });
});

describe("who wrote what is in the box", () => {
  test("untouched, it says the lines came from the model", async () => {
    const { renderer, captureCharFrame } = await paint(BLOCK.after);
    try {
      expect(captureCharFrame()).toContain("from the model");
    } finally { await renderer.destroy(); }
  });

  test("typed over, it says the lines are yours", async () => {
    const mine = ["Think step by step.", "Keep it SHORT. Never show it.", "Then write."].join("\n");
    const { renderer, captureCharFrame } = await paint(mine);
    try {
      expect(captureCharFrame()).toContain("yours");
    } finally { await renderer.destroy(); }
  });

  test("edited back to stored, it says there is nothing to apply", async () => {
    /**
     * The phantom-edit rule, on screen. Text that is back where it started is not a change, however
     * it got there, and saying otherwise would offer to write a file identical to the one on disk.
     */
    const { renderer, captureCharFrame } = await paint(BLOCK.before);
    try {
      expect(captureCharFrame()).toContain("nothing to apply");
    } finally { await renderer.destroy(); }
  });
});

describe("the editing state is visible", () => {
  test("not editing, it says how to start", async () => {
    // An invisible mode is one people fight; the rail taught that twice.
    const { renderer, captureCharFrame } = await paint(BLOCK.after, false);
    try {
      expect(captureCharFrame()).toContain("edits this");
    } finally { await renderer.destroy(); }
  });

  test("editing, it says so and how to leave", async () => {
    const { renderer, captureCharFrame } = await paint(BLOCK.after, true);
    try {
      const frame = captureCharFrame();
      expect(frame).toContain("typing");
      expect(frame).toContain("esc");
    } finally { await renderer.destroy(); }
  });
});
