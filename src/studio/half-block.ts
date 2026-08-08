/**
 * Card art as coloured text, for the places that cannot use a real image.
 *
 * NOT THE KIT UI'S PATH ANY MORE, and saying so here matters more than the technique below. opentui
 * 0.5.1 ships an `<image>` renderable whose `protocol: "auto"` uses kitty graphics or sixel where the
 * terminal has them - a genuine image at real resolution - and falls back to quadrant blocks where it
 * does not. `render/primitives/portrait-block.tsx` uses that. An earlier version of this file argued
 * against protocols on the grounds that a portrait appearing on one machine and not another is worse
 * than one that always looks the same; `auto` degrades on its own, so that reasoning only bought a
 * worse picture everywhere.
 *
 * WHAT THIS IS STILL FOR:
 *   - printing art OUTSIDE opentui - a CLI subcommand piping ANSI to a pipe or a file;
 *   - the sampling maths itself, which is pure and therefore testable without a terminal at all.
 *
 * THE TRICK, since it still has to be right: a terminal cell is roughly twice as tall as it is wide,
 * so drawing U+2580 (UPPER HALF BLOCK) with one colour in the foreground and another in the
 * background gives TWO STACKED SQUARE PIXELS per cell. A 40-column block is a 40x60 image. It needs
 * nothing but truecolor. `opening-banner.tsx` proves the same technique elsewhere in this codebase.
 *
 * Resolution is entirely a function of columns spent: at 34 columns a face is a mosaic, at 90 it
 * reads as an illustration. Nothing about the maths changes - only how much room it is given.
 *
 * Pure. Pixels in, cells out, no I/O and no renderer.
 */

/** One character cell: the glyph plus the two colours that make its two pixels. */
export interface Cell {
  /** Always U+2580; kept explicit so a caller never has to know the magic character. */
  readonly ch: string;
  /** Upper pixel. */
  readonly fg: string;
  /** Lower pixel. */
  readonly bg: string;
}

export interface Pixels {
  readonly width: number;
  readonly height: number;
  /** RGBA, 4 bytes per pixel - the shape signature-color.ts already decodes PNGs into. */
  readonly rgba: Uint8Array;
}

const UPPER_HALF = "▀";

const hex = (n: number): string => Math.round(n).toString(16).padStart(2, "0");
const toHex = (r: number, g: number, b: number): string => `#${hex(r)}${hex(g)}${hex(b)}`;

/**
 * Average one source rectangle down to a single pixel, compositing transparency onto the stage.
 *
 * Box-averaging rather than nearest-neighbour because a portrait shrunk to 40 columns loses ~90% of
 * its pixels: picking one and discarding the rest turns smooth shading into noise, and faces are the
 * subject most punished by it.
 */
function sample(
  px: Pixels,
  stage: readonly [number, number, number],
  x0: number, y0: number, x1: number, y1: number,
): [number, number, number] {
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(px.width, Math.max(xa + 1, Math.ceil(x1)));
  const ya = Math.max(0, Math.floor(y0));
  const yb = Math.min(px.height, Math.max(ya + 1, Math.ceil(y1)));
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const o = (y * px.width + x) * 4;
      const a = (px.rgba[o + 3] ?? 255) / 255;
      // Composite onto the stage rather than ignoring alpha: a cut-out portrait otherwise gets a
      // black halo where the terminal's own background should show through.
      r += (px.rgba[o] ?? 0) * a + stage[0] * (1 - a);
      g += (px.rgba[o + 1] ?? 0) * a + stage[1] * (1 - a);
      b += (px.rgba[o + 2] ?? 0) * a + stage[2] * (1 - a);
      n++;
    }
  }
  return n === 0 ? [stage[0], stage[1], stage[2]] : [r / n, g / n, b / n];
}

export interface HalfBlockOptions {
  /** Target width in character cells. */
  readonly cols: number;
  /** What transparency composites onto; default is theme.well, Kit's stage floor. */
  readonly stage?: readonly [number, number, number];
  /**
   * Cap the height in cells. The image is SCALED DOWN to fit, never squashed: hitting this reduces
   * the column count too, so the aspect ratio is preserved and the result is simply smaller.
   */
  readonly maxRows?: number;
}

/**
 * Render pixels to a grid of cells.
 *
 * Rows are derived from the source aspect ratio, NOT chosen: each cell holds two square pixels, so
 * `rows = cols * (height/width) / 2`. Getting that division wrong is the classic half-block bug - the
 * image renders at double height and every face comes out stretched.
 */
export function toHalfBlocks(px: Pixels, options: HalfBlockOptions): Cell[][] {
  const stage = options.stage ?? [0x0e, 0x0c, 0x10];
  const cols = Math.max(1, Math.floor(options.cols));
  if (px.width <= 0 || px.height <= 0) return [];

  // Rows come from the source aspect, never chosen: each cell holds TWO square pixels vertically,
  // so rows = cols * (h/w) / 2. Dropping that halving is the classic half-block bug - the image
  // renders at double height and every face is stretched.
  let width = cols;
  let rows = Math.max(1, Math.floor(Math.max(2, Math.round((cols * px.height) / px.width)) / 2));

  // Fitting a height cap must SHRINK, not squash. Capping rows alone while leaving the column count
  // alone re-samples the whole image into fewer rows, which silently compresses the picture
  // vertically - the first version did exactly that, and its test only checked the grid's
  // dimensions, so it passed while the portrait came out squat.
  if (options.maxRows !== undefined && rows > Math.floor(options.maxRows)) {
    const capped = Math.max(1, Math.floor(options.maxRows));
    width = Math.max(1, Math.round((capped * 2 * px.width) / px.height));
    rows = capped;
  }

  const sx = px.width / width;
  const sy = px.height / (rows * 2);
  const grid: Cell[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: Cell[] = [];
    for (let col = 0; col < width; col++) {
      const top = sample(px, stage, col * sx, row * 2 * sy, (col + 1) * sx, (row * 2 + 1) * sy);
      const bottom = sample(px, stage, col * sx, (row * 2 + 1) * sy, (col + 1) * sx, (row * 2 + 2) * sy);
      line.push({
        ch: UPPER_HALF,
        fg: toHex(top[0], top[1], top[2]),
        bg: toHex(bottom[0], bottom[1], bottom[2]),
      });
    }
    grid.push(line);
  }
  return grid;
}

/** The grid as ANSI truecolor, for a terminal that is not being driven by opentui (a CLI subcommand). */
export function toAnsi(grid: readonly (readonly Cell[])[]): string {
  const rgb = (h: string): string =>
    `${parseInt(h.slice(1, 3), 16)};${parseInt(h.slice(3, 5), 16)};${parseInt(h.slice(5, 7), 16)}`;
  return grid
    .map((line) => line.map((c) => `[38;2;${rgb(c.fg)}m[48;2;${rgb(c.bg)}m${c.ch}`).join("") + "[0m")
    .join("\n");
}
