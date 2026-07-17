/**
 * Signature color - derive an entity's accent from its own card art: mask out skin, gray, and
 * near-black/white, then take the most vibrant and prevalent remaining hue. Pure functions, no
 * dependencies beyond fflate (already ours): a minimal PNG pixel decoder (8-bit
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
    // Hard pixel and decoded-byte ceilings before inflate (fail closed; no 256 MiB RGBA alloc).
    const MAX_PIXELS = 16_000_000;
    const MAX_DECODED = 48 * 1024 * 1024;
    const MAX_IDAT = 32 * 1024 * 1024;
    if (width === 0 || height === 0 || width > 16384 || height > 16384) return null;
    if (width * height > MAX_PIXELS) return null;

    const bpp = colorType === 6 ? 4 : 3;
    const stride = width * bpp;
    const expectedRaw = (stride + 1) * height;
    if (expectedRaw > MAX_DECODED || !Number.isFinite(expectedRaw) || expectedRaw <= 0) return null;

    const idat = chunks.filter((c) => c.name === "IDAT");
    if (idat.length === 0) return null;
    const idatTotal = idat.reduce((n, c) => n + c.data.length, 0);
    if (idatTotal === 0 || idatTotal > MAX_IDAT) return null;
    const compressed = new Uint8Array(idatTotal);
    let at = 0;
    for (const c of idat) {
      compressed.set(c.data, at);
      at += c.data.length;
    }
    // Cap inflate output to expected scanlines + 1 sentinel byte so overflow cannot look valid.
    let raw: Uint8Array;
    try {
      raw = unzlibSync(compressed, { out: new Uint8Array(expectedRaw + 1) });
    } catch {
      return null;
    }
    if (raw.length !== expectedRaw) return null;

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

/**
 * The FULL human skin gamut, every tone: the warm-brown hue band at low-to-moderate saturation is
 * skin-adjacent at ANY brightness (pale, tan, brown, dark - and sepia lighting with it), so it is
 * never a signature. Only genuinely VIVID warm colors (tiger orange, marigold) clear the sat bar.
 * (Masking only light skin let brown darker-skin tones through as false accents - hence the band.)
 */
function isSkin(r: number, g: number, b: number, hue: number, sat: number, _val: number): boolean {
  const rgbRule = r > 95 && g > 40 && b > 20 && r > g && g > b && r - g > 15 && r - Math.min(g, b) > 15;
  const warmBand = hue >= 5 && hue <= 50 && sat < 0.68;
  return rgbRule || warmBand;
}

const HUE_BUCKETS = 30; // 12 degrees each

interface Cluster {
  count: number;
  r: number;
  g: number;
  b: number;
  sat: number;
  val: number;
}

interface Family {
  count: number;
  sat: number;
  val: number;
  /** sub-clusters by sat/val band: the same hue at different intensities stays distinguishable */
  subs: Map<number, Cluster>;
}

const satBand = (s: number): number => (s < 0.4 ? 0 : s < 0.7 ? 1 : 2);
const valBand = (v: number): number => (v < 0.4 ? 0 : v < 0.7 ? 1 : 2);

/**
 * The signature color of decoded art, or null when nothing survives the masks (an all-sepia card
 * has no signature; the caller falls back to the deck accent). Two-stage by design:
 * PREVALENCE x saturation picks the winning hue FAMILY; then the most VIBRANT real sub-cluster of
 * that family present in the image becomes the exemplar - the family's poppin' member, never its
 * muddy average.
 */
export function signatureColor(pixels: Pixels): string | null {
  const { rgba, width, height } = pixels;
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 24_000)); // sample ~24k pixels regardless of size
  const families = new Map<number, Family>();
  // light achromatics (white/platinum hair, robes) are tallied apart: they can BE the signature
  // when they dominate and nothing chromatic has a real claim (the white-haired-boy rule)
  const silver = { count: 0, r: 0, g: 0, b: 0 };
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
    // TINTED whites count: real robes/hair sit in shadow and pick up a cool cast (sat up to .30),
    // which otherwise leaks them into a phantom blue family and starves the silver mass
    if (sat < 0.3 && val > 0.6) {
      silver.count++;
      silver.r += r;
      silver.g += g;
      silver.b += b;
      continue;
    }
    if (sat < 0.22 || val < 0.18) continue; // gray / near-black carry no signature
    if (val > 0.95 && sat < 0.3) continue; // near-white but colored-ish: still not a signature

    let hue = 0;
    const d = max - min;
    if (d > 0) {
      if (max === r) hue = 60 * (((g - b) / d) % 6);
      else if (max === g) hue = 60 * ((b - r) / d + 2);
      else hue = 60 * ((r - g) / d + 4);
      if (hue < 0) hue += 360;
    }
    if (isSkin(r, g, b, hue, sat, val)) continue;

    const familyKey = Math.floor(hue / (360 / HUE_BUCKETS));
    const family = families.get(familyKey) ?? { count: 0, sat: 0, val: 0, subs: new Map() };
    family.count++;
    family.sat += sat;
    family.val += val;
    const subKey = satBand(sat) * 3 + valBand(val);
    const sub = family.subs.get(subKey) ?? { count: 0, r: 0, g: 0, b: 0, sat: 0, val: 0 };
    sub.count++;
    sub.r += r;
    sub.g += g;
    sub.b += b;
    sub.sat += sat;
    sub.val += val;
    family.subs.set(subKey, sub);
    families.set(familyKey, family);
  }
  if (sampled === 0) return null;

  // election: a family runs on prevalence x the POP IT CAN DELIVER (its most vibrant real
  // sub-cluster), so a deliberate vivid motif (Adrian's red threads) beats a big muted ambiance,
  // and a family is always represented by its vivid member (Basil's eye-blue, never window-blue)
  const minFamily = Math.max(8, sampled * 0.004); // single-pixel neon noise is not a signature
  const minSub = Math.max(3, sampled * 0.0008); // eye-sized clusters are real; a stray sparkle is not
  let bestFamily: Family | null = null;
  let bestExemplar: Cluster | null = null;
  let bestScore = 0;
  let bestPop = 0;
  for (const family of families.values()) {
    if (family.count < minFamily) continue;
    let exemplar: Cluster | null = null;
    let pop = 0;
    for (const sub of family.subs.values()) {
      if (sub.count < minSub) continue;
      const avgSat = sub.sat / sub.count;
      const avgVal = sub.val / sub.count;
      const vibrance = avgSat * avgSat * avgVal;
      if (vibrance > pop) {
        pop = vibrance;
        exemplar = sub;
      }
    }
    if (!exemplar) continue;
    const score = family.count * pop * pop;
    if (score > bestScore) {
      bestScore = score;
      bestFamily = family;
      bestExemplar = exemplar;
      bestPop = pop;
    }
  }

  // the white-robes rule: a DOMINANT light-achromatic mass signs SILVER unless a chromatic family
  // holds a real MOTIF against it - which takes BOTH spread (Adrian's threads, not Alfred's
  // eye-glints) AND pop (Adrian's scarlet, not Cedric's muted gold braid)
  const motifHolds = bestFamily !== null && bestFamily.count >= sampled * 0.012 && bestPop >= 0.35;
  const silverWins =
    silver.count > sampled * 0.3 &&
    !motifHolds &&
    (!bestFamily || silver.count > 4 * bestFamily.count);
  if (silverWins) {
    let [h, s, v] = rgbToHsv(silver.r / silver.count, silver.g / silver.count, silver.b / silver.count);
    s = Math.min(s, 0.08); // platinum, not a tint
    v = Math.min(Math.max(v, 0.72), 0.88); // readable on BOTH themes: silver, never pure white
    const [r, g, b] = hsvToRgb(h, s, v);
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  if (!bestExemplar) return null;

  // presentation lift: the accent must read on the dark stage (documented nudge, not a lie -
  // hue is untouched; only floor the brightness/saturation for legibility)
  let [h, s, v] = rgbToHsv(
    bestExemplar.r / bestExemplar.count,
    bestExemplar.g / bestExemplar.count,
    bestExemplar.b / bestExemplar.count,
  );
  s = Math.max(s, 0.5);
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
