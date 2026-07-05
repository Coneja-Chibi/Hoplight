/**
 * Rasterize the LOCKED beam-V mark (design/DECISIONS.md geometry) into build/vaude.ico.
 * Pure Bun: a minimal PNG encoder (zlib via node:zlib + hand CRC) wrapped in an ICO container
 * (Vista+ ICOs embed PNG directly). No imagemagick, no deps - the five-line-helper doctrine.
 */
import { deflateSync } from "node:zlib";
import { mkdir } from "node:fs/promises";

const SIZE = 256;
const ROSE = { r: 0xe1, g: 0x1d, b: 0x48 };

// the locked polygons in a 0..100 viewBox
const BEAMS: [number, number][][] = [
  [[60, 92], [4, 12], [34, 3]],
  [[40, 92], [96, 12], [66, 3]],
];

const sign = (p: [number, number], a: [number, number], b: [number, number]): number =>
  (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);

function inTriangle(p: [number, number], t: [number, number][]): boolean {
  const d1 = sign(p, t[0]!, t[1]!);
  const d2 = sign(p, t[1]!, t[2]!);
  const d3 = sign(p, t[2]!, t[0]!);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** 4x supersampled coverage for clean edges. */
function coverage(x: number, y: number): number {
  let hit = 0;
  for (let sy = 0; sy < 4; sy++) {
    for (let sx = 0; sx < 4; sx++) {
      const u = ((x + (sx + 0.5) / 4) / SIZE) * 100;
      const v = ((y + (sy + 0.5) / 4) / SIZE) * 100;
      if (BEAMS.some((t) => inTriangle([u, v], t))) hit++;
    }
  }
  return hit / 16;
}

// -- raw RGBA -> PNG --------------------------------------------------------------------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(rgba: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, SIZE);
  dv.setUint32(4, SIZE);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = new Uint8Array((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) raw.set(rgba.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), y * (SIZE * 4 + 1) + 1);
  const idat = new Uint8Array(deflateSync(raw));
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, part) => n + part.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const part of parts) {
    png.set(part, off);
    off += part.length;
  }
  return png;
}

/** ICO container: one PNG-compressed 256px entry (Vista+). */
function wrapIco(png: Uint8Array): Uint8Array {
  const out = new Uint8Array(22 + png.length);
  const dv = new DataView(out.buffer);
  dv.setUint16(2, 1, true); // type: icon
  dv.setUint16(4, 1, true); // count
  out[6] = 0; // 0 = 256px
  out[7] = 0;
  out[8] = 0; // palette
  dv.setUint16(10, 1, true); // planes
  dv.setUint16(12, 32, true); // bpp
  dv.setUint32(14, png.length, true);
  dv.setUint32(18, 22, true); // offset
  out.set(png, 22);
  return out;
}

const rgba = new Uint8Array(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const a = coverage(x, y);
    const i = (y * SIZE + x) * 4;
    rgba[i] = ROSE.r;
    rgba[i + 1] = ROSE.g;
    rgba[i + 2] = ROSE.b;
    rgba[i + 3] = Math.round(a * 255); // transparent ground; the mark floats
  }
}

await mkdir("build", { recursive: true });
const png = encodePng(rgba);
await Bun.write("build/vaude-256.png", png);
await Bun.write("build/vaude.ico", wrapIco(png));
console.log(`wrote build/vaude.ico (${wrapIco(png).length}b) + build/vaude-256.png`);
