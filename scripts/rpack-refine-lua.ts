/**
 * Refine RPack table using high-value Lua/Risu identifier cribs + wasmoon accept loop.
 * One-off tool. Run: bun scripts/rpack-refine-lua.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { DECODE as BASE } from "../src/formats/risu/rpack/table";
import { decodeRisum, listScriptEffects } from "../src/formats/risu/rpack";
import { runLua } from "../src/sandbox/lua/run";

const D = Int16Array.from(BASE as readonly number[]);

const force = (cipher: number, plain: number, why: string): boolean => {
  if (D[cipher] === plain) return false;
  const holder = [...D].findIndex((p) => p === plain);
  if (holder >= 0 && holder !== cipher) {
    const old = D[cipher]!;
    D[cipher] = plain;
    D[holder] = old;
    console.log(`  swap ${cipher}<->${holder} ${why}`);
  } else {
    D[cipher] = plain;
    console.log(`  set ${cipher}->${plain} ${why}`);
  }
  return true;
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

/** Place word only where a long unique suffix/prefix already matches (reduces false hits). */
function cribWithAnchor(main: Uint8Array, word: string, anchor: string, anchorAt: "start" | "end"): number {
  const plain = dec(main);
  const w = new TextEncoder().encode(word);
  const a = new TextEncoder().encode(anchor);
  let applied = 0;
  if (anchorAt === "end") {
    if (!word.endsWith(anchor)) return 0;
    let from = 0;
    for (;;) {
      const at = findSeq(plain.subarray(from), a);
      if (at < 0) break;
      const abs = from + at;
      const start = abs - (w.length - a.length);
      from = abs + a.length;
      if (start < 0) continue;
      // verify overlapping anchor matches
      let ok = true;
      for (let k = w.length - a.length; k < w.length; k++) {
        if (plain[start + k] !== w[k]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let k = 0; k < w.length; k++) {
        if (force(main[start + k]!, w[k]!, word)) applied++;
      }
      // one solid hit is enough for a global table
      if (applied > 0) break;
    }
  } else {
    if (!word.startsWith(anchor)) return 0;
    let from = 0;
    for (;;) {
      const at = findSeq(plain.subarray(from), a);
      if (at < 0) break;
      const start = from + at;
      from = start + a.length;
      let ok = true;
      for (let k = 0; k < a.length; k++) {
        if (plain[start + k] !== w[k]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let k = 0; k < w.length; k++) {
        if (force(main[start + k]!, w[k]!, word)) applied++;
      }
      if (applied > 0) break;
    }
  }
  return applied;
}

/** Crib exact word wherever current decode already matches all but <= maxMismatch bytes. */
function cribFuzzy(main: Uint8Array, word: string, maxMismatch: number): number {
  const plain = dec(main);
  const w = new TextEncoder().encode(word);
  let best = -1;
  let bestMiss = 99;
  for (let i = 0; i + w.length <= plain.length; i++) {
    let miss = 0;
    for (let k = 0; k < w.length; k++) {
      if (plain[i + k] !== w[k]) miss++;
      if (miss > maxMismatch) break;
    }
    if (miss <= maxMismatch && miss < bestMiss) {
      bestMiss = miss;
      best = i;
      if (miss === 0) break;
    }
  }
  if (best < 0) return 0;
  let n = 0;
  for (let k = 0; k < w.length; k++) {
    if (force(main[best + k]!, w[k]!, `${word}~${bestMiss}`)) n++;
  }
  return n;
}

const KWU = "C:/Users/chiev/Downloads/한국여자대학교 V1.0.charx";
const UMA = "C:/Users/chiev/Downloads/우마무스메_봇_1.12ver.charx";
const mainK = loadMain(KWU);
const mainU = loadMain(UMA);

const WORDS = [
  "MAX_LLM_RETRIES",
  "INJECT_MARKER",
  "ACTIVE_TRIGGER_ID",
  "setCampusContext",
  "getCampusId",
  "getCampusName",
  "getCampusEnglishName",
  "getChatVar",
  "setChatVar",
  "tostring",
  "tonumber",
  "string.gsub",
  "string.format",
  "table.concat",
  "table.insert",
  "math.floor",
  "math.random",
  "pcall",
  "pairs",
  "ipairs",
  "function ",
  "local ",
  "return ",
  "elseif ",
  " then",
  " end",
  "nil",
  "true",
  "false",
  "KWU.Constants",
  "KWU.Startup",
  "KWU.Runtime",
  "KWU.Campus",
  "KWU.Tables",
  "KWU.Assets",
  "KWU.Prompts",
  "KWU.Util",
  "htmlEscape",
  "safeStr",
  "lowLevelAccess",
  "triggerlua",
];

console.log("cribbing...");
for (const w of WORDS) {
  for (const main of [mainK, mainU]) {
    cribFuzzy(main, w, 2);
  }
}
// anchor-based for stubborn ones
cribWithAnchor(mainK, "MAX_LLM_RETRIES", "LLM_RETRIES", "end");
cribWithAnchor(mainK, "INJECT_MARKER", "ECT_MARKER", "end");
cribWithAnchor(mainK, "ACTIVE_TRIGGER_ID", "TRIGGER_ID", "end");

function emit(): void {
  const plains = new Set<number>();
  for (let i = 0; i < 256; i++) plains.add(D[i]!);
  if (plains.size !== 256) throw new Error(`bijection ${plains.size}`);
  const body = [
    "/**",
    " * RPack substitution table for .risum: DECODE[cipher] = plain, ENCODE is the inverse.",
    " * Emitted by scripts/rpack-derive.ts / rpack-refine*.ts from real module bytes + public cribs.",
    " */",
    `export const DECODE: readonly number[] = [${[...D].join(",")}];`,
    "export const ENCODE: readonly number[] = (() => { const e = new Array(256).fill(0); DECODE.forEach((p, c) => { e[p] = c; }); return e; })();",
    "",
  ].join("\n");
  writeFileSync("src/formats/risu/rpack/table.ts", body);
}

emit();

// reload decode via re-import is hard; use local dec for wasmoon via re-decode of module
// After emit, use decode path with in-memory D by reconstructing code from main JSON

async function luaFromMain(main: Uint8Array): Promise<string> {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(dec(main));
  const obj = JSON.parse(text) as {
    module?: { trigger?: Array<{ effect?: Array<{ type?: string; code?: string }> }> };
    trigger?: Array<{ effect?: Array<{ type?: string; code?: string }> }>;
  };
  const mod = obj.module ?? obj;
  const code = mod.trigger?.[0]?.effect?.find((e) => e.type === "triggerlua")?.code ?? "";
  return code;
}

async function firstFailLine(code: string): Promise<{ okTo: number; msg: string }> {
  const lines = code.split("\n");
  let lo = 0;
  let hi = Math.min(lines.length, 500);
  // exponential find fail
  let lastOk = 0;
  for (const n of [10, 20, 40, 60, 80, 100, 150, 200, 300, 400, 500, lines.length]) {
    if (n > lines.length) continue;
    const head = `${lines.slice(0, n).join("\n")}\nreturn 1\n`;
    const r = await runLua(head, { deadlineMs: 4000 });
    if (r.ok) lastOk = n;
    else {
      hi = n;
      break;
    }
  }
  if (lastOk === Math.min(lines.length, 500) || lastOk === lines.length) {
    // try full
    const r = await runLua(`${code}\nreturn 1\n`, { deadlineMs: 15000 });
    if (r.ok) return { okTo: lines.length, msg: "FULL_OK" };
  }
  let a = lastOk;
  let b = hi;
  let msg = "";
  while (b - a > 1) {
    const mid = (a + b) >> 1;
    const head = `${lines.slice(0, mid).join("\n")}\nreturn 1\n`;
    const r = await runLua(head, { deadlineMs: 4000 });
    if (r.ok) a = mid;
    else {
      b = mid;
      msg = r.message;
    }
  }
  if (b <= lines.length && a < b) {
    const r = await runLua(`${lines.slice(0, b).join("\n")}\nreturn 1\n`, { deadlineMs: 4000 });
    if (!r.ok) msg = r.message;
  }
  return { okTo: a, msg };
}

// iterate: crib more from failing line context
for (let round = 0; round < 8; round++) {
  const code = await luaFromMain(mainK);
  const { okTo, msg } = await firstFailLine(code);
  console.log(`\nround ${round}: ok through line ${okTo} / ${code.split("\n").length}`);
  console.log(" ", msg.slice(0, 160));
  if (msg === "FULL_OK" || okTo >= code.split("\n").length) {
    console.log("WASMOON ACCEPTS FULL TRIGGERLUA (+ return 1)");
    break;
  }
  const lines = code.split("\n");
  const bad = lines[okTo] ?? lines[okTo - 1] ?? "";
  console.log("  bad line:", JSON.stringify(bad).slice(0, 160));
  // pull identifier-like tokens with non-ascii and try dictionary near-matches
  const ids = bad.match(/[A-Za-z_][A-Za-z0-9_\u0080-\uFFFF]*/g) ?? [];
  console.log("  tokens", ids.slice(0, 12));
  // known repairs from common corruptions
  const repairs: Array<[string, string]> = [
    ["INZECT", "INJECT"],
    ["MA\u00AF_", "MAX_"],
    ["MA\uFFFD_", "MAX_"],
    ["FACTI\uFFFDN", "FACTION"],
    ["N\uFFFDN", "NON"],
    ["N\uFFFD", "NO"],
  ];
  for (const [from, to] of repairs) {
    if (bad.includes(from) || code.includes(from)) {
      // force via fuzzy
      cribFuzzy(mainK, to.length >= 4 ? to : from.replace(/./g, (c, i) => to[i] ?? c), 3);
    }
  }
  // fuzzy crib whole bad-line identifiers if we can guess
  for (const id of ids) {
    if (/^[\x00-\x7F]+$/.test(id) && id.length >= 6) {
      // already ascii - try as-is fuzzy
      cribFuzzy(mainK, id, 0);
    }
  }
  emit();
}

// final report both cards + JSON RT
for (const [label, path] of [["KWU", KWU], ["UMA", UMA]] as const) {
  const main = loadMain(path);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(dec(main));
  try {
    JSON.parse(text);
    console.log(label, "JSON ok");
  } catch (e) {
    console.log(label, "JSON FAIL", (e as Error).message.slice(0, 80));
  }
}

emit();
console.log("done emit");

// final wasmoon on KWU full
const finalCode = await luaFromMain(mainK);
const full = await runLua(`${finalCode}\nreturn 1\n`, { deadlineMs: 20000 });
console.log("FULL wasmoon", full.ok ? "OK" : full.message.slice(0, 200));
if (!full.ok) {
  const { okTo, msg } = await firstFailLine(finalCode);
  console.log("still fails after line", okTo, msg.slice(0, 160));
}
