/**
 * One-off: crib Uma module title into the RPack table and re-emit table.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { DECODE as BASE } from "../src/formats/risu/rpack/table";

const D = Int16Array.from(BASE as readonly number[]);

const forceCipher = (cipher: number, plain: number, why: string): void => {
  if (D[cipher] === plain) return;
  const holder = [...D].findIndex((p) => p === plain);
  if (holder >= 0 && holder !== cipher) {
    const old = D[cipher]!;
    D[cipher] = plain;
    D[holder] = old;
    console.log(`force swap ${cipher}<->${holder} (${why})`);
  } else {
    D[cipher] = plain;
    console.log(`force ${cipher} -> ${plain} (${why})`);
  }
};

function loadMain(p: string): Uint8Array {
  const m = unzipSync(new Uint8Array(readFileSync(p)))["module.risum"]!;
  const len = m[2]! | (m[3]! << 8) | (m[4]! << 16) | (m[5]! << 24);
  return m.slice(6, 6 + len);
}

function dec(main: Uint8Array): Uint8Array {
  const o = new Uint8Array(main.length);
  for (let i = 0; i < main.length; i++) o[i] = D[main[i]!]! & 0xff;
  return o;
}

function findSeq(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

const uma = "C:/Users/chiev/Downloads/우마무스메_봇_1.12ver.charx";
const main = loadMain(uma);
const plain = dec(main);
const anchor = new TextEncoder().encode(" 6.61 ver Module");
const at = findSeq(plain, anchor);
if (at < 0) throw new Error("rpack-refine-uma: anchor not found");
const known = new TextEncoder().encode("우마무스메 6.61 ver Module");
const start = at - (known.length - anchor.length);
if (start < 0) throw new Error("rpack-refine-uma: bad start");
for (let k = 0; k < known.length; k++) {
  forceCipher(main[start + k]!, known[k]!, "uma title");
}

const text = new TextDecoder("utf-8", { fatal: false }).decode(dec(main));
const obj = JSON.parse(text) as { module?: { name?: string }; name?: string };
console.log("uma name", obj.module?.name ?? obj.name);

const kwu = loadMain("C:/Users/chiev/Downloads/한국여자대학교 V1.0.charx");
const kt = new TextDecoder("utf-8", { fatal: false }).decode(dec(kwu));
JSON.parse(kt);
const kn = (JSON.parse(kt) as { module?: { name?: string }; name?: string }).module?.name;
console.log("kwu name", kn);

const plains = new Set<number>();
for (let i = 0; i < 256; i++) plains.add(D[i]!);
if (plains.size !== 256) throw new Error(`bijection broken ${plains.size}`);

const body =
  `/**\n` +
  ` * RPack substitution table for .risum: DECODE[cipher] = plain, ENCODE is the inverse.\n` +
  ` * Emitted by scripts/rpack-derive.ts / rpack-refine.ts from real module bytes + public cribs.\n` +
  ` */\n` +
  `export const DECODE: readonly number[] = [${[...D].join(",")}];\n` +
  `export const ENCODE: readonly number[] = (() => { const e = new Array(256).fill(0); DECODE.forEach((p, c) => { e[p] = c; }); return e; })();\n`;

writeFileSync("src/formats/risu/rpack/table.ts", body);
console.log("[emitted] src/formats/risu/rpack/table.ts");
