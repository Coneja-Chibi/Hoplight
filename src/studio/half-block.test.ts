/**
 * Half-block rendering, tested on the two things that actually go wrong: aspect ratio and alpha.
 *
 * A colour being slightly off is invisible. An image at double height is instantly wrong and is the
 * classic bug in this technique - forgetting that one cell carries TWO pixels vertically.
 */
import { describe, expect, test } from "bun:test";
import { toAnsi, toHalfBlocks, type Pixels } from "./half-block";

/** A solid block of one colour, fully opaque. */
const solid = (width: number, height: number, r: number, g: number, b: number, a = 255): Pixels => {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
  }
  return { width, height, rgba };
};

/** Top half one colour, bottom half another - so the fold into fg/bg is checkable. */
const split = (width: number, height: number): Pixels => {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const top = y < height / 2;
      rgba[o] = top ? 255 : 0;
      rgba[o + 1] = 0;
      rgba[o + 2] = top ? 0 : 255;
      rgba[o + 3] = 255;
    }
  }
  return { width, height, rgba };
};

describe("aspect ratio", () => {
  test("a square image comes back square, NOT double height", () => {
    // The bug this pins: rows = cols * (h/w) forgets that a cell holds two pixels vertically, so a
    // square image renders twice as tall as it should and every face is stretched.
    const grid = toHalfBlocks(solid(100, 100, 200, 100, 50), { cols: 40 });
    expect(grid[0]!.length).toBe(40);
    // 40 cols wide x (rows*2) pixels tall should be square: rows*2 === 40, so rows === 20.
    expect(grid.length).toBe(20);
  });

  test("a 2:3 portrait keeps its 2:3 shape", () => {
    // 400x600 is the SillyTavern card standard, and portrait art is the whole point of this.
    const grid = toHalfBlocks(solid(400, 600, 10, 20, 30), { cols: 40 });
    const renderedRatio = grid[0]!.length / (grid.length * 2);
    expect(renderedRatio).toBeCloseTo(400 / 600, 1);
  });

  test("maxRows SHRINKS to fit and keeps the aspect - it must not squash", () => {
    // The first version capped rows and left cols alone, re-sampling the whole image into fewer
    // rows. That compresses the picture vertically, and the original test only checked the grid
    // dimensions - so it passed while every capped portrait came out squat.
    const grid = toHalfBlocks(solid(400, 600, 10, 20, 30), { cols: 40, maxRows: 10 });
    expect(grid.length).toBe(10);
    expect(grid[0]!.length).toBeLessThan(40);
    expect(grid[0]!.length / (grid.length * 2)).toBeCloseTo(400 / 600, 1);
  });
});

describe("the two pixels in a cell", () => {
  test("foreground is the UPPER pixel and background is the lower one", () => {
    const grid = toHalfBlocks(split(40, 40), { cols: 20 });
    const first = grid[0]![0]!;
    const last = grid[grid.length - 1]![0]!;
    // Top of the image is red, bottom is blue.
    expect(first.fg.toLowerCase()).toBe("#ff0000");
    expect(last.bg.toLowerCase()).toBe("#0000ff");
  });

  test("every cell uses the upper-half block, so a caller never needs the magic character", () => {
    const grid = toHalfBlocks(solid(8, 8, 1, 2, 3), { cols: 4 });
    for (const row of grid) for (const cell of row) expect(cell.ch).toBe("▀");
  });
});

describe("transparency", () => {
  test("a fully transparent image reads as the stage, not as black", () => {
    // Ignoring alpha puts a black halo around every cut-out portrait, which is the most common art
    // shape on a character card.
    const grid = toHalfBlocks(solid(20, 20, 255, 255, 255, 0), { cols: 10, stage: [0x0e, 0x0c, 0x10] });
    expect(grid[0]![0]!.fg.toLowerCase()).toBe("#0e0c10");
  });

  test("half-opaque white over the dark stage lands between the two", () => {
    const grid = toHalfBlocks(solid(20, 20, 255, 255, 255, 128), { cols: 10, stage: [0, 0, 0] });
    const value = parseInt(grid[0]![0]!.fg.slice(1, 3), 16);
    expect(value).toBeGreaterThan(100);
    expect(value).toBeLessThan(160);
  });
});

describe("totality", () => {
  test("a zero-sized image is an empty grid, never a throw", () => {
    expect(toHalfBlocks({ width: 0, height: 0, rgba: new Uint8Array() }, { cols: 10 })).toEqual([]);
  });

  test("asking for fewer than one column still yields one", () => {
    expect(toHalfBlocks(solid(10, 10, 1, 1, 1), { cols: 0 })[0]!.length).toBe(1);
  });
});

describe("ansi", () => {
  test("emits truecolor pairs and resets at the end of every row", () => {
    const ansi = toAnsi(toHalfBlocks(solid(4, 4, 255, 0, 0), { cols: 2 }));
    expect(ansi).toContain("38;2;255;0;0");
    expect(ansi).toContain("48;2;255;0;0");
    // Without a reset the last cell's background bleeds across the rest of the terminal line.
    for (const line of ansi.split("\n")) expect(line.endsWith("[0m")).toBe(true);
  });
});
