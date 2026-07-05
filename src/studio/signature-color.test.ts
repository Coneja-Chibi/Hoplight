/**
 * signature-color tests - synthetic PNGs with KNOWN pixel fields prove the scorer: skin masked,
 * gray ignored, the prevalent saturated color wins, garbage decodes to null.
 */
import { describe, expect, test } from "bun:test";
import encode from "png-chunks-encode";
import { zlibSync } from "fflate";
import { decodePngPixels, signatureColor, signatureFromPng } from "./signature-color";

/** Build a real 8-bit RGBA PNG from a pixel-fill function (filter 0 scanlines, zlib IDAT). */
function makePng(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): Uint8Array {
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return new Uint8Array(
    encode([
      { name: "IHDR", data: ihdr },
      { name: "IDAT", data: zlibSync(raw) },
      { name: "IEND", data: new Uint8Array(0) },
    ]),
  );
}

const hueOf = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return (h + 360) % 360;
};

describe("decodePngPixels", () => {
  test("round-trips a real encoded PNG", () => {
    const png = makePng(8, 8, () => [10, 200, 30]);
    const px = decodePngPixels(png);
    expect(px?.width).toBe(8);
    expect(px?.rgba[1]).toBe(200);
  });
  test("garbage reads as null, never throws", () => {
    expect(decodePngPixels(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("signatureColor", () => {
  test("skin is masked: a mostly-skin portrait with a blue jacket signs BLUE", () => {
    // 70% skin tones, 20% gray backdrop, 10% saturated blue
    const png = makePng(100, 100, (x) => {
      if (x < 70) return [224, 172, 140]; // skin
      if (x < 90) return [90, 90, 95]; // gray coat
      return [40, 90, 220]; // the blue
    });
    const hex = signatureFromPng(png);
    expect(hex).not.toBeNull();
    const hue = hueOf(hex!);
    expect(hue).toBeGreaterThan(200);
    expect(hue).toBeLessThan(260);
  });

  test("prevalence x saturation wins: a big dull field loses to a vivid field", () => {
    // 60% desaturated olive vs 40% vivid rose
    const png = makePng(100, 100, (x) => (x < 60 ? [120, 115, 70] : [225, 29, 72]));
    const hue = hueOf(signatureFromPng(png)!);
    expect(hue > 330 || hue < 15).toBe(true); // rose
  });

  test("an all-gray card has no signature (fail closed)", () => {
    const png = makePng(50, 50, () => [80, 80, 82]);
    expect(signatureFromPng(png)).toBeNull();
  });

  test("single-pixel neon noise is not a signature", () => {
    const px = decodePngPixels(makePng(100, 100, (x, y) => (x === 0 && y === 0 ? [0, 255, 0] : [70, 70, 72])))!;
    expect(signatureColor(px)).toBeNull();
  });
});
