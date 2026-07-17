/**
 * Iteratively compile-check triggerlua and print the failing line for manual/auto cribs.
 * After each fix we re-emit table.ts. Run: bun scripts/rpack-fix-syntax.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { LuaFactory, LuaLibraries } from "wasmoon";
import { DECODE as BASE } from "../src/formats/risu/rpack/table";

const KWU = "C:/Users/chiev/Downloads/한국여자대학교 V1.0.charx";
const D = Int16Array.from(BASE as readonly number[]);

const force = (cipher: number, plain: number, why: string): void => {
  if (D[cipher] === plain) return;
  const holder = [...D].findIndex((p) => p === plain);
  if (holder >= 0 && holder !== cipher) {
    const old = D[cipher]!;
    D[cipher] = plain;
    D[holder] = old;
    console.log(`swap ${cipher}<->${holder} (${why}) ${old}->${plain}`);
  } else {
    D[cipher] = plain;
    console.log(`set ${cipher}->${plain} (${why})`);
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

function findSeq(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

const enc = (s: string): string extends string ? Uint8Array : never => new TextEncoder().encode(s);

function luaCode(main: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(dec(main));
  const obj = JSON.parse(text) as {
    module?: { trigger?: Array<{ effect?: Array<{ type?: string; code?: string }> }> };
  };
  return obj.module?.trigger?.[0]?.effect?.find((e) => e.type === "triggerlua")?.code ?? "";
}

function emit(): void {
  writeFileSync(
    "src/formats/risu/rpack/table.ts",
    [
      "/**",
      " * RPack substitution table for .risum: DECODE[cipher] = plain, ENCODE is the inverse.",
      " * Emitted by scripts/rpack-fix-syntax.ts from real module bytes + public cribs.",
      " */",
      `export const DECODE: readonly number[] = [${[...D].join(",")}];`,
      "export const ENCODE: readonly number[] = (() => { const e = new Array(256).fill(0); DECODE.forEach((p, c) => { e[p] = c; }); return e; })();",
      "",
    ].join("\n"),
  );
}

function bothJson(main: Uint8Array, main2: Uint8Array): boolean {
  try {
    JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(dec(main)));
    JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(dec(main2)));
    return true;
  } catch {
    return false;
  }
}

async function compile(code: string): Promise<string | "SYNTAX_OK"> {
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
    const result = (await engine.doString(
      `local f, err = load(__src, "module", "t")
       if not f then return err end
       return "SYNTAX_OK"`,
    )) as unknown;
    return result === "SYNTAX_OK" ? "SYNTAX_OK" : String(result);
  } finally {
    engine.global.close();
  }
}

/** Parse "]:77:" line numbers from wasmoon errors. */
function errLine(msg: string): number {
  const m = msg.match(/\]:(\d+):/);
  return m ? Number(m[1]) : -1;
}

const main = loadMain(KWU);
const mainU = loadMain("C:/Users/chiev/Downloads/우마무스메_봇_1.12ver.charx");

// Dictionary of full identifiers to force when a near-miss appears on the bad line
const DICT = [
  "kwuStripEmoji",
  "string.byte",
  "string.char",
  "string.sub",
  "string.gsub",
  "string.format",
  "string.find",
  "string.match",
  "string.gmatch",
  "table.insert",
  "table.concat",
  "table.remove",
  "math.floor",
  "math.max",
  "math.min",
  "math.random",
  "utf8.len",
  "utf8.codes",
  "utf8.char",
  "INJECT_MARKER",
  "MAX_LLM_RETRIES",
  "ACTIVE_TRIGGER_ID",
  "getChatVar",
  "setChatVar",
  "htmlEscape",
  "safeStr",
];

for (let round = 0; round < 40; round++) {
  if (!bothJson(main, mainU)) {
    console.error("JSON broken - stop");
    process.exit(1);
  }
  const code = luaCode(main);
  const lines = code.split("\n");
  const result = await compile(code);
  if (result === "SYNTAX_OK") {
    console.log("PASS full compile round", round);
    emit();
    process.exit(0);
  }
  console.log(`\nround ${round}: ${result.slice(0, 120)}`);
  const ln = errLine(result);
  if (ln > 0) {
    const bad = lines[ln - 1] ?? "";
    console.log("  line", ln, JSON.stringify(bad).slice(0, 160));
    // auto: if near ' = Xs' where X wrong and s letter, try #
    const mHash = bad.match(/=\s*([^\s])s\b/);
    if (mHash && mHash[1] !== "#") {
      const plain = dec(main);
      const needle = enc(bad.slice(0, Math.min(40, bad.length)));
      // fall through to token fixes
    }
    // token vs dict equal-length hamming <= 2
    const tokens = bad.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    let fixed = false;
    for (const tok of tokens) {
      for (const dict of DICT) {
        if (dict.length !== tok.length) continue;
        let miss = 0;
        for (let i = 0; i < tok.length; i++) if (tok[i] !== dict[i]) miss++;
        if (miss === 0 || miss > 2) continue;
        const snap = Int16Array.from(D);
        const p = dec(main);
        const at = findSeq(p, enc(tok));
        // search for dict placement with high overlap
        const w = enc(dict);
        let best = -1;
        let bestK = -1;
        for (let i = 0; i + w.length <= p.length; i++) {
          let k = 0;
          for (let j = 0; j < w.length; j++) if (p[i + j] === w[j]) k++;
          if (k > bestK) {
            bestK = k;
            best = i;
          }
        }
        if (best >= 0 && bestK >= dict.length - 2) {
          for (let j = 0; j < w.length; j++) force(main[best + j]!, w[j]!, `${tok}->${dict}`);
          if (bothJson(main, mainU)) {
            console.log(`  fixed ${tok} -> ${dict}`);
            fixed = true;
            break;
          }
          D.set(snap);
        }
        void at;
      }
      if (fixed) break;
    }
    // ops: line looks like bitwise with missing &
    if (!fixed && /0x[0-9A-Fa-f]+/.test(bad)) {
      // common pattern: b & 0x07 etc - if we see 'b  0x' or 'b � 0x'
      const snap = Int16Array.from(D);
      // force crib of " & 0x" if we find " 0x" after a letter with wrong middle
      const p = dec(main);
      const hex = findSeq(p, enc(" 0x"));
      // look for string.byte context already good
      if (findSeq(p, enc("0x80")) < 0 && findSeq(p, enc("0xF0")) >= 0) {
        // try force 0x80 by finding wrong 0x30 near F0 block - too risky
      }
      // crib full fragments
      for (const frag of ["b < 0x80", "b >= 0xF0", "b >= 0xE0", "b >= 0xC0", "b & 0x07", "b & 0x0F", "b & 0x1F", "b & 0x3F", "#s"]) {
        const w = enc(frag);
        let best = -1;
        let bestK = -1;
        for (let i = 0; i + w.length <= p.length; i++) {
          let k = 0;
          for (let j = 0; j < w.length; j++) if (p[i + j] === w[j]) k++;
          if (k > bestK) {
            bestK = k;
            best = i;
          }
        }
        if (best >= 0 && bestK >= frag.length - 2) {
          for (let j = 0; j < w.length; j++) force(main[best + j]!, w[j]!, frag);
        }
      }
      if (bothJson(main, mainU)) {
        console.log("  applied bitwise/hex cribs");
        fixed = true;
      } else {
        D.set(snap);
      }
      void hex;
    }
    if (!fixed) {
      console.log("  no auto-fix; emit and stop for inspection");
      emit();
      process.exit(1);
    }
  } else {
    console.log("  no line number; stop");
    emit();
    process.exit(1);
  }
  emit();
}
console.log("exhausted rounds");
emit();
process.exit(1);
