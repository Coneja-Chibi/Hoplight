/**
 * Where an added block lands.
 *
 * ORDER IS THE PAYLOAD in a preset: the same text at the top and at the bottom are different
 * instructions. Every add used to append, so writing an opening README meant adding it last and then
 * remembering to move it - and the time that was forgotten, the preset came back with its
 * introduction at the end and a note asking somebody to drag it into place by hand.
 */
import { describe, expect, test } from "bun:test";
import { addPresetBlock, placementIndex } from "./operations";
import type { PresetBody, PresetPrompt } from "./schema";

const block = (id: string): PresetPrompt => ({ id, name: id, content: id } as PresetPrompt);
const body = (...ids: string[]): PresetBody => ({ prompts: ids.map(block) } as PresetBody);
const ids = (b: PresetBody): string[] => b.prompts.map((p) => p.id);

describe("placementIndex", () => {
  const prompts = body("a", "b", "c").prompts;

  test("absent means last, so nothing that already worked changes", () => {
    expect(placementIndex(prompts, undefined)).toBe(3);
    expect(placementIndex(prompts, "last")).toBe(3);
  });

  test("first is the top", () => {
    expect(placementIndex(prompts, "first")).toBe(0);
  });

  test("before and after bracket the named block", () => {
    expect(placementIndex(prompts, { before: "b" })).toBe(1);
    expect(placementIndex(prompts, { after: "b" })).toBe(2);
  });

  test("after the last block is the end", () => {
    expect(placementIndex(prompts, { after: "c" })).toBe(3);
  });

  test("naming a block that is not there is an error, not an append", () => {
    /**
     * SILENTLY PUTTING IT LAST is exactly the failure this argument exists to prevent. A model that
     * asked for "before the main prompt" and got "at the end" would report success while leaving the
     * block somewhere nobody wanted it.
     */
    expect(placementIndex(prompts, { before: "nope" })).toBeNull();
    expect(placementIndex(prompts, { after: "nope" })).toBeNull();
  });

  test("an empty preset takes a block anywhere", () => {
    expect(placementIndex([], "first")).toBe(0);
    expect(placementIndex([], "last")).toBe(0);
  });
});

describe("addPresetBlock", () => {
  test("it still appends when nothing is said", () => {
    expect(ids(addPresetBlock(body("a", "b"), block("new")))).toEqual(["a", "b", "new"]);
  });

  test("first puts the README where a README goes", () => {
    // The case that started this.
    expect(ids(addPresetBlock(body("a", "b"), block("readme"), "first"))).toEqual(["readme", "a", "b"]);
  });

  test("before and after land either side of the anchor", () => {
    expect(ids(addPresetBlock(body("a", "b", "c"), block("x"), { before: "b" }))).toEqual(["a", "x", "b", "c"]);
    expect(ids(addPresetBlock(body("a", "b", "c"), block("x"), { after: "b" }))).toEqual(["a", "b", "x", "c"]);
  });

  test("an anchor that is not there refuses, and says which one", () => {
    expect(() => addPresetBlock(body("a"), block("x"), { before: "ghost" }))
      .toThrow(/ghost/);
  });

  test("a duplicate id is still refused, wherever it was aimed", () => {
    // The existing guard must not be skippable by asking for a position.
    expect(() => addPresetBlock(body("a"), block("a"), "first")).toThrow(/already exists/);
  });

  test("the original body is not mutated", () => {
    const before = body("a", "b");
    addPresetBlock(before, block("x"), "first");
    expect(ids(before)).toEqual(["a", "b"]);
  });
});
