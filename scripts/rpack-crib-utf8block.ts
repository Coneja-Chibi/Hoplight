/**
 * Crib the UTF-8 length-decode block inside kwuStripEmoji + common ops, then compile-check.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { LuaFactory, LuaLibraries } from "wasmoon";
import { DECODE as BASE } from "../src/formats/risu/rpack/table";

const D = Int16Array.from(BASE as readonly number[]);
const KWU = "C:/Users/chiev/Downloads/한국여자대학교 V1.0.charx";
const UMA = "C:/Users/chiev/Downloads/우마무스메_봇_1.12ver.charx";

const force = (cipher: number, plain: number, why: string): void => {
  if (D[cipher] === plain) return;
  const holder = [...D].findIndex((p) => p === plain);
  if (holder >= 0 && holder !== cipher) {
    const old = D[cipher]!;
    D[cipher] = plain;
    D[holder] = old;
    console.log(`swap ${cipher}<->${holder} ${why}`);
  } else {
    D[cipher] = plain;
    console.log(`set ${cipher} ${why}`);
  }
};

function loadMain(path: string): Uint8Array {
  const m = unzipSync(new Uint8Array(readFileSync(path)))["module.risum"]!;
  const len = m[2]! | (m[3]! << 8) | (m[4]! << 16) | (m[5]! << 24);
  return m.slice(6, 6 + len);
}

function dec(main: Uint8Array): Uint8Array {
  const o = new Uint8Array(main.length);
  for (let i = 0; i < main.length; i++) o[i] = D[main[i]!]! & 0xff;
  return o;
}

function both(main: Uint8Array, mainU: Uint8Array): boolean {
  try {
    JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(dec(main)));
    JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(dec(mainU)));
    return true;
  } catch {
    return false;
  }
}

function cribExact(main: Uint8Array, mainU: Uint8Array, text: string, minRatio: number): boolean {
  const plain = dec(main);
  const w = new TextEncoder().encode(text);
  let best = -1;
  let bestK = -1;
  for (let i = 0; i + w.length <= plain.length; i++) {
    let k = 0;
    for (let j = 0; j < w.length; j++) if (plain[i + j] === w[j]) k++;
    if (k > bestK) {
      bestK = k;
      best = i;
    }
  }
  const need = Math.floor(w.length * minRatio);
  console.log(`crib ${JSON.stringify(text).slice(0, 48)} ${bestK}/${w.length}`);
  if (best < 0 || bestK < need) return false;
  const snap = Int16Array.from(D);
  for (let j = 0; j < w.length; j++) force(main[best + j]!, w[j]!, text.slice(0, 24));
  if (!both(main, mainU)) {
    D.set(snap);
    console.log("  REVERT");
    return false;
  }
  return true;
}

function emit(): void {
  writeFileSync(
    "src/formats/risu/rpack/table.ts",
    [
      "/**",
      " * RPack substitution table for .risum: DECODE[cipher] = plain, ENCODE is the inverse.",
      " * Emitted by scripts/rpack-crib-utf8block.ts from real module bytes + public cribs.",
      " */",
      `export const DECODE: readonly number[] = [${[...D].join(",")}];`,
      "export const ENCODE: readonly number[] = (() => { const e = new Array(256).fill(0); DECODE.forEach((p, c) => { e[p] = c; }); return e; })();",
      "",
    ].join("\n"),
  );
}

function luaCode(main: Uint8Array): string {
  const obj = JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(dec(main))) as {
    module: { trigger: Array<{ effect: Array<{ type: string; code: string }> }> };
  };
  return obj.module.trigger[0]!.effect.find((e) => e.type === "triggerlua")!.code;
}

async function compile(code: string): Promise<string> {
  const factory = new LuaFactory();
  const engine = await factory.createEngine({
    openStandardLibs: false,
    injectObjects: false,
    functionTimeout: 120_000,
  });
  for (const lib of [
    LuaLibraries.Base,
    LuaLibraries.Table,
    LuaLibraries.String,
    LuaLibraries.Math,
    LuaLibraries.Coroutine,
    LuaLibraries.UTF8,
  ]) {
    engine.global.loadLibrary(lib);
  }
  engine.doStringSync("_G.loadfile = nil; _G.dofile = nil");
  try {
    engine.global.set("__src", code);
    return String(
      await engine.doString(
        `local f, err = load(__src, "module", "t")
         if not f then return err end
         return "SYNTAX_OK"`,
      ),
    );
  } finally {
    engine.global.close();
  }
}

const main = loadMain(KWU);
const mainU = loadMain(UMA);

const frags = [
  [
    "local b = string.byte(s, i)",
    "        local cp, len",
    "        if b < 0x80 then cp = b; len = 1",
    "        elseif b >= 0xF0 then cp = b & 0x07; len = 4",
    "        elseif b >= 0xE0 then cp = b & 0x0F; len = 3",
    "        elseif b >= 0xC0 then cp = b & 0x1F; len = 2",
    "        else cp = b; len = 1 end",
  ].join("\n"),
  "cp = cp << 6 | (b & 0x3F)",
  "i = i + len",
  "i = i + 1",
  "local n = #s",
  "local i = 1",
  "while i <= n do",
  "out[#out+1] = string.char(cp)",
  "return table.concat(out)",
  "if type(s) ~= \"string\" or s == \"\" then return s end",
];

for (const f of frags) cribExact(main, mainU, f, 0.55);
emit();

const code = luaCode(main);
const r = await compile(code);
console.log("compile:", r.slice(0, 200));
if (r !== "SYNTAX_OK") {
  const m = r.match(/\]:(\d+):/);
  const ln = m ? Number(m[1]) : -1;
  if (ln > 0) {
    const lines = code.split("\n");
    for (let i = Math.max(0, ln - 3); i < Math.min(lines.length, ln + 3); i++) {
      console.log(i + 1, JSON.stringify(lines[i]).slice(0, 160));
    }
  }
  process.exitCode = 1;
} else {
  console.log("PASS");
}
