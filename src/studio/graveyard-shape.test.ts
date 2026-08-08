/**
 * What a graveyard promises about a block somebody took out of a preset.
 *
 * Every test here is about NOT LOSING WRITING. This file is the only copy of everything in it: a
 * block that is buried and then dropped by a tolerant parser, a cap that trims the wrong end, or a
 * restore that hands back something subtly different are all the same failure - somebody's work,
 * gone, with the app reporting success.
 */
import { describe, expect, test } from "bun:test";
import {
  bury,
  EMPTY_GRAVEYARD,
  exhume,
  graveById,
  gravesNewestFirst,
  MAX_GRAVES,
  parseGraveyard,
  type Grave,
} from "./graveyard-shape";
import type { PresetPrompt } from "../entities/preset/schema";

const block = (id: string, content = "the words"): PresetPrompt => ({
  id, name: `Block ${id}`, content, role: "system", enabled: true,
  systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4,
} as unknown as PresetPrompt);

const grave = (id: string, at = 1, over: Partial<Grave> = {}): Grave => ({
  id, block: block(`b-${id}`), at,
  from: { presetId: "astrolabe", presetName: "Astrolabe" },
  ...over,
});

describe("burying", () => {
  test("the whole block is kept, verbatim", () => {
    /**
     * A grave holding a name and a note about what the block did would be a memorial. The point is
     * to be able to put it back, which means keeping the thing itself.
     */
    const file = bury(EMPTY_GRAVEYARD, grave("g1"));
    expect(file.graves[0]?.block.content).toBe("the words");
    expect(file.graves[0]?.block.id).toBe("b-g1");
  });

  test("IT REMEMBERS WHERE IT CAME FROM", () => {
    // Without an origin, "put it back" has no answer.
    const file = bury(EMPTY_GRAVEYARD, grave("g1"));
    expect(file.graves[0]?.from).toEqual({ presetId: "astrolabe", presetName: "Astrolabe" });
  });

  test("THE SAME BLOCK ID TWICE IS TWO GRAVES", () => {
    /**
     * One block id can exist in two presets with different content. Collapsing them would silently
     * discard one preset's version because another happened to reuse the identifier.
     */
    const one = bury(EMPTY_GRAVEYARD, { ...grave("g1"), block: block("shared", "from preset A") });
    const two = bury(one, { ...grave("g2"), block: block("shared", "from preset B") });
    expect(two.graves).toHaveLength(2);
    expect(two.graves.map((g) => g.block.content)).toEqual(["from preset A", "from preset B"]);
  });

  test("THE CAP DROPS THE OLDEST, never the newest", () => {
    // The newest burial is the one somebody is most likely to be undoing.
    let file = EMPTY_GRAVEYARD;
    for (let n = 0; n < MAX_GRAVES + 5; n += 1) file = bury(file, grave(`g${String(n)}`, n));
    expect(file.graves).toHaveLength(MAX_GRAVES);
    expect(file.graves.at(-1)?.id).toBe(`g${String(MAX_GRAVES + 4)}`);
    expect(file.graves[0]?.id).toBe("g5");
  });
});

describe("reading a graveyard back", () => {
  test("newest first, because that is the order it is read in", () => {
    const file = bury(bury(EMPTY_GRAVEYARD, grave("old", 100)), grave("new", 900));
    expect(gravesNewestFirst(file).map((g) => g.id)).toEqual(["new", "old"]);
  });

  test("one unreadable grave does not take the others with it", () => {
    // This file is the only copy of everything in it.
    const got = parseGraveyard({
      graves: [
        { id: "good", at: 1, from: {}, block: block("b1") },
        { id: "bad-no-block", at: 2, from: {} },
        { id: "bad-empty-block", at: 3, from: {}, block: { id: "x" } },
        { id: "also-good", at: 4, from: {}, block: block("b2") },
      ],
    });
    expect(got.graves.map((g) => g.id)).toEqual(["good", "also-good"]);
  });

  test("A BLOCK WITHOUT ITS CONTENT IS NOT A GRAVE", () => {
    // An empty box with a label reads as a rescue and is not one.
    const got = parseGraveyard({
      graves: [{ id: "g", at: 1, from: {}, block: { id: "b", name: "n", role: "system" } }],
    });
    expect(got.graves).toEqual([]);
  });

  test("an unknown origin is kept rather than refused", () => {
    // Losing the block because nobody recorded which preset it came from would be the wrong trade.
    const got = parseGraveyard({ graves: [{ id: "g", at: 1, block: block("b") }] });
    expect(got.graves).toHaveLength(1);
    expect(got.graves[0]?.from.presetId).toBe("");
  });

  test("nonsense reads as an empty graveyard, never a throw", () => {
    for (const junk of [null, "graves", 7, {}, { graves: "no" }]) {
      expect(parseGraveyard(junk)).toEqual(EMPTY_GRAVEYARD);
    }
  });
});

describe("taking one back out", () => {
  test("exhume removes exactly one and leaves the rest", () => {
    const file = bury(bury(EMPTY_GRAVEYARD, grave("a")), grave("b"));
    expect(exhume(file, "a").graves.map((g) => g.id)).toEqual(["b"]);
  });

  test("the block comes back as itself, ready to go home", () => {
    const file = bury(EMPTY_GRAVEYARD, grave("g1"));
    expect(graveById(file, "g1")?.block).toEqual(block("b-g1"));
    expect(graveById(file, "nope")).toBeNull();
  });

  test("exhuming something that is not there changes nothing", () => {
    const file = bury(EMPTY_GRAVEYARD, grave("a"));
    expect(exhume(file, "ghost")).toEqual(file);
  });
});
