/**
 * The shelf's selection model: click, range, modifier, box.
 *
 * The tests that earn their place are the ones about NOT LOSING A BATCH. Somebody staging thirty
 * presets out of a hundred and forty-seven has spent real attention on it, and every gesture here
 * is one mis-specified line away from throwing that away in a single click.
 */
import { describe, expect, test } from "bun:test";
import {
  applyMarquee,
  applyPick,
  boxOf,
  isDrag,
  marqueeHits,
  rangeBetween,
  selectedText,
  type Picking,
} from "./select-core";

const ORDER = ["preset:a", "preset:b", "preset:c", "preset:d", "preset:e"];
const NONE: ReadonlySet<string> = new Set();
const at = (selected: string[], anchor = ""): Picking => ({ selected: new Set(selected), anchor });
const pick = (state: Picking, key: string, over: Partial<{ shift: boolean; meta: boolean; open: ReadonlySet<string> }> = {}) =>
  applyPick(state, { key, order: ORDER, shift: false, meta: false, open: NONE, ...over });

describe("rangeBetween", () => {
  test("inclusive, and the same either way round", () => {
    expect(rangeBetween(ORDER, "preset:b", "preset:d")).toEqual(["preset:b", "preset:c", "preset:d"]);
    expect(rangeBetween(ORDER, "preset:d", "preset:b")).toEqual(["preset:b", "preset:c", "preset:d"]);
  });

  test("AN ANCHOR THAT IS NO LONGER ON THE SHELF IS NOT A RANGE", () => {
    // Filter the shelf after clicking, then shift-click: ranging over pieces nobody can see would
    // stage things that are not on screen.
    expect(rangeBetween(ORDER, "preset:gone", "preset:c")).toEqual(["preset:c"]);
  });
});

describe("applyPick", () => {
  test("a plain click toggles one and keeps the rest", () => {
    const one = pick(at([]), "preset:a");
    expect([...one.selected]).toEqual(["preset:a"]);
    const two = pick(one, "preset:c");
    expect([...two.selected].sort()).toEqual(["preset:a", "preset:c"]);
    expect([...pick(two, "preset:a").selected]).toEqual(["preset:c"]);
  });

  test("every click moves the anchor", () => {
    expect(pick(at([]), "preset:c").anchor).toBe("preset:c");
  });

  test("shift takes everything between", () => {
    const from = pick(at([]), "preset:b");
    expect([...pick(from, "preset:d", { shift: true }).selected].sort())
      .toEqual(["preset:b", "preset:c", "preset:d"]);
  });

  test("A RANGE ADDS TO THE BATCH, IT DOES NOT REPLACE IT", () => {
    /**
     * Somebody picks two at the top, then shift-ranges four at the bottom. Replacing would drop the
     * first two at the exact moment they are plainly building one big selection.
     */
    const start: Picking = { selected: new Set(["preset:a"]), anchor: "preset:c" };
    const got = pick(start, "preset:e", { shift: true });
    expect([...got.selected].sort()).toEqual(["preset:a", "preset:c", "preset:d", "preset:e"]);
  });

  test("THE ANCHOR STAYS PUT ACROSS SHIFT-CLICKS, so a range can be re-aimed", () => {
    // Shift-click too far, shift-click back: the range shrinks from the same origin, the way every
    // list in every operating system behaves.
    const start = pick(at([]), "preset:b");
    const wide = pick(start, "preset:e", { shift: true });
    expect(wide.anchor).toBe("preset:b");
    const narrow = pick(wide, "preset:c", { shift: true });
    expect(narrow.anchor).toBe("preset:b");
  });

  test("shift with no anchor yet is just a click", () => {
    expect([...pick(at([]), "preset:c", { shift: true }).selected]).toEqual(["preset:c"]);
  });

  test("ctrl or cmd toggles one, like a plain click, and keeps the rest", () => {
    const two = pick(pick(at([]), "preset:a"), "preset:c");
    expect([...pick(two, "preset:c", { meta: true }).selected]).toEqual(["preset:a"]);
  });

  test("A PIECE ALREADY ON THE WORKBENCH IS NEVER STAGED", () => {
    /**
     * Staging one is a no-op the shelf already refuses on a plain click. A range that swept it in
     * would put a key in the batch that the sendbar then acts on, and "send" would mean nothing for
     * that piece while the count said otherwise.
     */
    const open = new Set(["preset:c"]);
    expect([...pick(at([]), "preset:c", { open }).selected]).toEqual([]);
    const from = pick(at([]), "preset:b", { open });
    expect([...pick(from, "preset:d", { shift: true, open }).selected].sort())
      .toEqual(["preset:b", "preset:d"]);
  });
});

describe("the dragged box", () => {
  const card = (key: string, top: number) => ({ key, box: { left: 0, right: 100, top, bottom: top + 50 } });

  test("a rectangle comes out the same whichever corner you started from", () => {
    expect(boxOf({ x: 90, y: 90 }, { x: 10, y: 10 })).toEqual({ left: 10, top: 10, right: 90, bottom: 90 });
  });

  test("A WOBBLE IS A CLICK, NOT A DRAG", () => {
    // Without a threshold, every click on empty space would clear the selection as a zero-size box.
    expect(isDrag(boxOf({ x: 10, y: 10 }, { x: 12, y: 11 }))).toBe(false);
    expect(isDrag(boxOf({ x: 10, y: 10 }, { x: 40, y: 11 }))).toBe(true);
  });

  test("TOUCHING COUNTS, NOT SWALLOWING", () => {
    /**
     * Requiring the box to contain a card whole means dragging across a row of tall cards selects
     * nothing at all, which reads as the feature being broken.
     */
    const cards = [card("a", 0), card("b", 100), card("c", 200)];
    const hits = marqueeHits(cards, { left: 10, right: 20, top: 40, bottom: 120 }, NONE);
    expect(hits).toEqual(["a", "b"]);
  });

  test("a box skips pieces already on the bench", () => {
    const cards = [card("a", 0), card("b", 100)];
    expect(marqueeHits(cards, { left: 0, right: 100, top: 0, bottom: 200 }, new Set(["a"]))).toEqual(["b"]);
  });

  test("a box says what is picked; a held modifier adds to what was", () => {
    const before = at(["preset:z"]);
    expect([...applyMarquee(before, ["a", "b"], false).selected].sort()).toEqual(["a", "b"]);
    expect([...applyMarquee(before, ["a"], true).selected].sort()).toEqual(["a", "preset:z"]);
  });

  test("an empty additive box changes nothing at all", () => {
    expect([...applyMarquee(at(["preset:z"]), [], true).selected]).toEqual(["preset:z"]);
  });
});

describe("selectedText", () => {
  test("a real highlight is text, so the click must not also stage", () => {
    expect(selectedText({ isCollapsed: false, toString: () => "3035a5467e" })).toBe(true);
  });

  test("A CARET IS NOT A SELECTION", () => {
    // Every ordinary click leaves a collapsed selection behind. Treating that as text would make
    // the shelf unclickable.
    expect(selectedText({ isCollapsed: true, toString: () => "" })).toBe(false);
    expect(selectedText({ isCollapsed: false, toString: () => "   " })).toBe(false);
    expect(selectedText(null)).toBe(false);
  });
});
