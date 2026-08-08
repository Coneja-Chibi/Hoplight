/**
 * Deciding whether a review is one block being rewritten.
 *
 * MOST OF THESE TESTS ARE REFUSALS. A diff pane that quietly ignored a second change would be worse
 * than no diff at all, because it would look complete: you would read one careful before-and-after,
 * accept it, and have approved a reorder you never saw.
 */
import { describe, expect, test } from "bun:test";
import { rewrittenBlock } from "./rewritten-block";

const block = (id: string, name: string, content: string) => ({ id, name, content });
const change = (before: unknown, after: unknown) => ({ path: "body.prompts", before, after });

const BEFORE = [block("a", "Main", "one"), block("b", "CoT", "old text"), block("c", "Nudge", "three")];
const AFTER = [block("a", "Main", "one"), block("b", "CoT", "new text"), block("c", "Nudge", "three")];

describe("it finds the one rewritten block", () => {
  test("with the full text on both sides", () => {
    // The text was always in the review; it was only ever missing from the screen.
    expect(rewrittenBlock([change(BEFORE, AFTER)])).toEqual({
      id: "b", name: "CoT", before: "old text", after: "new text",
    });
  });

  test("a block with no content reads as empty, not as absent", () => {
    const from = [block("a", "Main", "")];
    const to = [block("a", "Main", "now it says something")];
    expect(rewrittenBlock([change(from, to)])?.before).toBe("");
  });
});

describe("it refuses anything else", () => {
  test("nothing changed", () => {
    expect(rewrittenBlock([change(BEFORE, BEFORE)])).toBeNull();
  });

  test("two blocks changed", () => {
    // The rows describe this; a single before/after pane cannot.
    const two = [block("a", "Main", "ONE"), block("b", "CoT", "new text"), block("c", "Nudge", "three")];
    expect(rewrittenBlock([change(BEFORE, two)])).toBeNull();
  });

  test("a block was added or removed", () => {
    expect(rewrittenBlock([change(BEFORE, AFTER.slice(0, 2))])).toBeNull();
    expect(rewrittenBlock([change(BEFORE.slice(0, 2), AFTER)])).toBeNull();
  });

  test("the order changed", () => {
    /**
     * Position `at` is a different block on each side, so a naive pane would diff the wrong two
     * texts against each other and present the result as one block's rewrite.
     */
    const moved = [AFTER[1]!, AFTER[0]!, AFTER[2]!];
    expect(rewrittenBlock([change(BEFORE, moved)])).toBeNull();
  });

  test("a rename rode along with the rewrite", () => {
    // Two edits in one operation. The pane would show the text and silently swallow the rename.
    const renamed = [BEFORE[0]!, block("b", "Chain of Thought", "new text"), BEFORE[2]!];
    expect(rewrittenBlock([change(BEFORE, renamed)])).toBeNull();
  });

  test("a second change of any kind is present", () => {
    const other = { path: "body.name", before: "Old", after: "New" };
    expect(rewrittenBlock([change(BEFORE, AFTER), other])).toBeNull();
  });

  test("the change is not about blocks at all", () => {
    expect(rewrittenBlock([{ path: "body.samplers", before: 1, after: 2 }])).toBeNull();
  });

  test("the payload is not an array of blocks", () => {
    // Never assume the shape: a capability could report this path differently tomorrow.
    expect(rewrittenBlock([change("not an array", AFTER)])).toBeNull();
    expect(rewrittenBlock([change(BEFORE, null)])).toBeNull();
  });

  test("a block with no usable id", () => {
    const nameless = [{ name: "Main", content: "x" }];
    expect(rewrittenBlock([change(nameless, [{ name: "Main", content: "y" }])])).toBeNull();
  });

  test("an empty review", () => {
    expect(rewrittenBlock([])).toBeNull();
  });
});
