/**
 * Signature color - derive an entity's accent from its own card art (Chi, 2026-07-05: "block out
 * all skin colors, then look for the bright most poppin and prevalent actual color"). Pure
 * functions, no dependencies beyond fflate (already ours): a minimal PNG pixel decoder (8-bit
 * RGB/RGBA, non-interlaced - virtually all card art) + a vibrant-swatch scorer that masks skin,
 * gray, and near-black/white, buckets the rest by hue, and scores prevalence x saturation.
 * Everything fails closed to null: no color is always safe (views fall back to the deck accent).
 */
import extract from "png-chunks-extract";
import { unzlibSync } from "fflate";

// -- minimal PNG pixel decode ------------------------------------------------------------------------

interface Pixels {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel */
  rgba: Uint8Array;
}

/** Decode an 8-bit truecolor PNG (color type 2/6, no interlace); anything else reads as null. */
export function decodePngPixels(bytes: Uint8Array): Pixels | null {
  try {
    const chunks = extract(bytes);
    const ihdr = chunks.find((c) => c.name === "IHDR");
    if (!ihdr) return null;
    const dv = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
    const width = dv.getUint32(0);
    const height = dv.getUint32(4);
    const bitDepth = ihdr.data[8]!;
    const colorType = ihdr.data[9]!;
    const interlace = ihdr.data[12]!;
    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) return null;
    if (width === 0 || height === 0 || width * height > 64_000_000) return null; // decompression cap

    const idat = chunks.filter((c) => c.name === "IDAT");
    if (idat.length === 0) return null;
    const compressed = new Uint8Array(idat.reduce((n, c) => n + c.data.length, 0));
    let at = 0;
    for (const c of idat) {
      compressed.set(c.data, at);
      at += c.data.length;
    }
    const raw = unzlibSync(compressed);

    const bpp = colorType === 6 ? 4 : 3;
    const stride = width * bpp;
    if (raw.length < (stride + 1) * height) return null;

    // unfilter scanlines (PNG filters 0-4), then normalize to RGBA
    const out = new Uint8Array(width * height * 4);
    const prev = new Uint8Array(stride);
    const line = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
      const rowStart = y * (stride + 1);
      const filter = raw[rowStart]!;
      for (let x = 0; x < stride; x++) {
        const cur = raw[rowStart + 1 + x]!;
        const left = x >= bpp ? line[x - bpp]! : 0;
        const up = prev[x]!;
        const upLeft = x >= bpp ? prev[x - bpp]! : 0;
        let v: number;
        switch (filter) {
          case 0: v = cur; break;
          case 1: v = cur + left; break;
          case 2: v = cur + up; break;
          case 3: v = cur + ((left + up) >> 1); break;
          case 4: v = cur + paeth(left, up, upLeft); break;
          default: return null;
        }
        line[x] = v & 0xff;
      }
      for (let px = 0; px < width; px++) {
        const s = px * bpp;
        const d = (y * width + px) * 4;
        out[d] = line[s]!;
        out[d + 1] = line[s + 1]!;
        out[d + 2] = line[s + 2]!;
        out[d + 3] = bpp === 4 ? line[s + 3]! : 255;
      }
      prev.set(line);
    }
    return { width, height, rgba: out };
  } catch {
    return null;
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// -- the vibrant-swatch scorer -----------------------------------------------------------------------

/** Classic RGB skin rule + a pale/anime-skin extension (warm hue, low sat, bright). */
function isSkin(r: number, g: number, b: number, hue: number, sat: number, val: number): boolean {
  const rgbRule = r > 95 && g > 40 && b > 20 && r > g && g > b && r - g > 15 && r - Math.min(g, b) > 15;
  const paleRule = hue >= 5 && hue <= 50 && sat < 0.38 && val > 0.5;
  return rgbRule || paleRule;
}

const HUE_BUCKETS = 30; // 12 degrees each

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
  sat: number;
  val: number;
}

/**
 * The signature color of decoded art, or null when nothing survives the masks (an all-sepia card
 * has no signature; the caller falls back to the deck accent). Scoring: prevalence x saturation^2
 * x brightness - "the bright most poppin and prevalent actual color color".
 */
export function signatureColor(pixels: Pixels): string | null {
  const { rgba, width, height } = pixels;
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 24_000)); // sample ~24k pixels regardless of size
  const buckets = new Map<number, Bucket>();
  let sampled = 0;

  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    const a = rgba[o + 3]!;
    if (a < 128) continue;
    const r = rgba[o]!;
    const g = rgba[o + 1]!;
    const b = rgba[o + 2]!;
    sampled++;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const val = max / 255;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.22 || val < 0.18) continue; // gray / near-black carry no signature
    if (val > 0.95 && sat < 0.3) continue; // near-white

    let hue = 0;
    const d = max - min;
    if (d > 0) {
      if (max === r) hue = 60 * (((g - b) / d) % 6);
      else if (max === g) hue = 60 * ((b - r) / d + 2);
      else hue = 60 * ((r - g) / d + 4);
      if (hue < 0) hue += 360;
    }
    if (isSkin(r, g, b, hue, sat, val)) continue;

    // quantize: hue bucket x coarse sat/val bands, so one hue at two intensities stays two candidates
    const key =
      Math.floor(hue / (360 / HUE_BUCKETS)) * 4 + (sat > 0.55 ? 2 : 0) + (val > 0.55 ? 1 : 0);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, sat: 0, val: 0 };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.sat += sat;
    bucket.val += val;
    buckets.set(key, bucket);
  }
  if (sampled === 0) return null;

  let best: Bucket | null = null;
  let bestScore = 0;
  const minCount = Math.max(8, sampled * 0.004); // single-pixel neon noise is not a signature
  for (const bucket of buckets.values()) {
    if (bucket.count < minCount) continue;
    const avgSat = bucket.sat / bucket.count;
    const avgVal = bucket.val / bucket.count;
    const score = bucket.count * avgSat * avgSat * Math.pow(avgVal, 0.8);
    if (score > bestScore) {
      bestScore = score;
      best = bucket;
    }
  }
  if (!best) return null;

  // presentation lift: the accent must read on the dark stage (documented nudge, not a lie -
  // hue is untouched; only floor the brightness/saturation for legibility)
  let [h, s, v] = rgbToHsv(best.r / best.count, best.g / best.count, best.b / best.count);
  s = Math.max(s, 0.45);
  v = Math.max(v, 0.55);
  const [r, g, b] = hsvToRgb(h, s, v);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** One call for the whole pipeline: PNG bytes -> signature hex, null when undecidable. */
export function signatureFromPng(bytes: Uint8Array): string | null {
  const pixels = decodePngPixels(bytes);
  return pixels ? signatureColor(pixels) : null;
}

const hex = (n: number): string => Math.round(n).toString(16).padStart(2, "0");

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max / 255];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
}
