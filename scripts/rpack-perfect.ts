/**
 * Rebuild/refine RPack table carefully: dual-sample hard derive is NOT re-run (slow/fragile).
 * Starts from committed table, applies only high-confidence anchored cribs, verifies JSON.parse
 * on both samples after every batch, and expands wasmoon-accepted line prefix.
 *
 * Run: bun scripts/rpack-perfect.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { DECODE as BASE } from "../src/formats/risu/rpack/table";
import { runLua } from "../src/sandbox/lua/run";

const KWU = "C:/Users/chiev/Downloads/한국여자대학교 V1.0.charx";
const UMA = "C:/Users/chiev/Downloads/우마무스메_봇_1.12ver.charx";

const D = Int16Array.from(BASE as readonly number[]);

const force = (cipher: number, plain: number): boolean => {
  if (D[cipher] === plain) return false;
  const holder = [...D].findIndex((p) => p === plain);
  if (holder >= 0 && holder !== cipher) {
    const old = D[cipher]!;
    D[cipher] = plain;
    D[holder] = old;
  } else {
    D[cipher] = plain;
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

function countSeq(hay: Uint8Array, needle: Uint8Array): number {
  let n = 0;
  let i = 0;
  while (i < hay.length) {
    const j = findSeq(hay.subarray(i), needle);
    if (j < 0) return n;
    n++;
    i += j + Math.max(1, needle.length);
  }
  return n;
}

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Force whole word only at positions where at least minKnown already-correct bytes match. */
function cribExactWhereKnown(main: Uint8Array, word: string, minKnown: number): number {
  const plain = dec(main);
  const w = enc(word);
  let best = -1;
  let bestKnown = -1;
  for (let i = 0; i + w.length <= plain.length; i++) {
    let known = 0;
    let conflict = false;
    for (let k = 0; k < w.length; k++) {
      if (plain[i + k] === w[k]) known++;
      // if current plain is ASCII letter/digit and disagrees, still allow (we may fix)
    }
    // require no conflict with already-matching long unique strings nearby
    if (known >= minKnown && known > bestKnown) {
      // extra: if word has a distinctive 4+ letter run that matches, prefer
      bestKnown = known;
      best = i;
      if (known === w.length) break;
    }
    void conflict;
  }
  if (best < 0 || bestKnown < minKnown) return 0;
  let n = 0;
  for (let k = 0; k < w.length; k++) {
    if (force(main[best + k]!, w[k]!)) n++;
  }
  if (n) console.log(`  crib ${word} @${best} known=${bestKnown} forced=${n}`);
  return n;
}

/** Anchor: word ends with known good ASCII anchor already in plaintext. */
function cribEndAnchor(main: Uint8Array, word: string, anchor: string): number {
  if (!word.endsWith(anchor)) return 0;
  const plain = dec(main);
  const w = enc(word);
  const a = enc(anchor);
  const at = findSeq(plain, a);
  if (at < 0) return 0;
  const start = at - (w.length - a.length);
  if (start < 0) return 0;
  // verify anchor region
  for (let k = 0; k < a.length; k++) {
    if (plain[start + (w.length - a.length) + k] !== a[k]) return 0;
  }
  let n = 0;
  for (let k = 0; k < w.length; k++) {
    if (force(main[start + k]!, w[k]!)) n++;
  }
  if (n) console.log(`  anchor ${word} forced=${n}`);
  return n;
}

function bothParse(mains: Uint8Array[]): boolean {
  for (const main of mains) {
    try {
      JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(dec(main)));
    } catch {
      return false;
    }
  }
  return true;
}

function emit(): void {
  if (new Set(D).size !== 256) throw new Error("bijection broken");
  writeFileSync(
    "src/formats/risu/rpack/table.ts",
    [
      "/**",
      " * RPack substitution table for .risum: DECODE[cipher] = plain, ENCODE is the inverse.",
      " * Emitted by scripts/rpack-perfect.ts from real module bytes + public cribs.",
      " */",
      `export const DECODE: readonly number[] = [${[...D].join(",")}];`,
      "export const ENCODE: readonly number[] = (() => { const e = new Array(256).fill(0); DECODE.forEach((p, c) => { e[p] = c; }); return e; })();",
      "",
    ].join("\n"),
  );
}

function snapshot(): Int16Array {
  return Int16Array.from(D);
}

function restore(s: Int16Array): void {
  D.set(s);
}

function luaCode(main: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(dec(main));
  const obj = JSON.parse(text) as {
    module?: { trigger?: Array<{ effect?: Array<{ type?: string; code?: string }> }> };
    trigger?: Array<{ effect?: Array<{ type?: string; code?: string }> }>;
  };
  const mod = obj.module ?? obj;
  return mod.trigger?.[0]?.effect?.find((e) => e.type === "triggerlua")?.code ?? "";
}

async function wasmoonOkLines(code: string, cap = 800): Promise<{ okTo: number; msg: string }> {
  const lines = code.split("\n");
  const limit = Math.min(lines.length, cap);
  let lastOk = 0;
  let failAt = limit + 1;
  let msg = "";
  for (const n of [20, 40, 60, 80, 100, 150, 200, 300, 400, 500, 600, 800, limit]) {
    if (n > limit) continue;
    const r = await runLua(`${lines.slice(0, n).join("\n")}\nreturn 1\n`, { deadlineMs: 5000 });
    if (r.ok) lastOk = n;
    else {
      failAt = n;
      msg = r.message;
      break;
    }
  }
  if (lastOk >= limit) {
    const r = await runLua(`${code}\nreturn 1\n`, { deadlineMs: 30000 });
    if (r.ok) return { okTo: lines.length, msg: "FULL_OK" };
    msg = r.message;
    // find fail in upper half
    failAt = lines.length;
  }
  let a = lastOk;
  let b = Math.min(failAt, limit);
  if (b <= a) b = a + 1;
  while (b - a > 1) {
    const mid = (a + b) >> 1;
    const r = await runLua(`${lines.slice(0, mid).join("\n")}\nreturn 1\n`, { deadlineMs: 5000 });
    if (r.ok) a = mid;
    else {
      b = mid;
      msg = r.message;
    }
  }
  return { okTo: a, msg };
}

const mainK = loadMain(KWU);
const mainU = loadMain(UMA);
const mains = [mainK, mainU];

if (!bothParse(mains)) {
  console.error("starting table does not JSON.parse both samples - abort");
  process.exit(1);
}
console.log("start: both JSON ok");

// Safe anchored cribs (ASCII identifiers that appear in real modules)
const ANCHORS: Array<[string, string]> = [
  ["MAX_LLM_RETRIES", "LLM_RETRIES"],
  ["INJECT_MARKER", "ECT_MARKER"],
  ["ACTIVE_TRIGGER_ID", "TRIGGER_ID"],
  ["setCampusContext", "CampusContext"],
  ["getCampusEnglishName", "EnglishName"],
  ["getCampusName", "CampusName"],
  ["getCampusId", "CampusId"],
  ["htmlEscape", "scape"],
  ["safeStr", "afeStr"],
  ["markKmuEncounterCodexFromText", "CodexFromText"],
  ["getFactionPromptNote", "PromptNote"],
  ["buildFactionGlossary", "Glossary"],
  ["getIntercampusExchangeSourceCampus", "SourceCampus"],
  ["getIntercampusExchangeSourceName", "SourceName"],
  ["getIntercampusExchangeDirectionLabel", "DirectionLabel"],
  ["string.gsub", "gsub"],
  ["string.format", "format"],
  ["table.concat", "concat"],
  ["table.insert", "insert"],
  ["math.floor", "floor"],
  ["math.random", "random"],
  ["getChatVar", "ChatVar"],
  ["setChatVar", "etChatVar"],
];

for (const [word, anchor] of ANCHORS) {
  const snap = snapshot();
  let n = 0;
  for (const main of mains) n += cribEndAnchor(main, word, anchor);
  if (!bothParse(mains)) {
    console.log(`  REVERT ${word} (broke JSON)`);
    restore(snap);
  } else if (n) {
    console.log(`  keep ${word}`);
  }
}

// High-confidence exact words with many known bytes already
const EXACT = [
  "function ",
  "local ",
  "return ",
  "elseif ",
  "pcall",
  "tostring",
  "tonumber",
  "getChatVar",
  "setChatVar",
  "INJECT_MARKER",
  "MAX_LLM_RETRIES",
  "ACTIVE_TRIGGER_ID",
  "KWU.Constants",
  "KWU.Startup",
  "KWU.Runtime",
  "KWU.Campus",
  "KWU.Tables",
  "KWU.Assets",
  "KWU.Prompts",
  "KWU.Util",
  "KWU.NPC",
  "KWU.Stats",
  "true",
  "false",
  "nil",
];

for (const word of EXACT) {
  const snap = snapshot();
  let n = 0;
  for (const main of mains) n += cribExactWhereKnown(main, word, Math.max(3, word.length - 2));
  if (!bothParse(mains)) {
    console.log(`  REVERT exact ${JSON.stringify(word)}`);
    restore(snap);
  }
}

// Korean titles (known from card / prior cribs)
const kTitle = "한국여자대학교 V6.0 Module";
const uTitle = "우마무스메 6.61 ver Module";
{
  const snap = snapshot();
  cribEndAnchor(mainK, kTitle, " V6.0 Module");
  if (!bothParse(mains)) restore(snap);
}
{
  const snap = snapshot();
  cribEndAnchor(mainU, uTitle, " 6.61 ver Module");
  if (!bothParse(mains)) restore(snap);
}

emit();
console.log("emitted mid");

// Wasmoon expand loop: read failing line, try to fix obvious ASCII identifier with dictionary
const DICT = [
  "INJECT_MARKER",
  "MAX_LLM_RETRIES",
  "ACTIVE_TRIGGER_ID",
  "UI_MARKER",
  "FACTION_NAME_NORM",
  "FACTION",
  "Constants",
  "Startup",
  "Runtime",
  "Campus",
  "Tables",
  "Assets",
  "Prompts",
  "Visibility",
  "Settings",
  "Reports",
  "Romance",
  "Calendar",
  "Achievements",
  "htmlEscape",
  "safeStr",
  "setCampusContext",
  "getCampusId",
  "getCampusName",
  "getCampusEnglishName",
  "kwuStripEmoji",
  "alertNormal",
  "alertError",
  "kwuSvg",
  "getFactionPromptNote",
  "buildFactionGlossary",
  "addFaction",
  "markKmuEncounterCodexFromText",
  "getIntercampusExchangeSourceCampus",
  "getIntercampusExchangeSourceName",
  "getIntercampusExchangeDirectionLabel",
];

for (let round = 0; round < 15; round++) {
  if (!bothParse(mains)) {
    console.error("JSON broke mid-loop");
    break;
  }
  const code = luaCode(mainK);
  const lines = code.split("\n");
  const { okTo, msg } = await wasmoonOkLines(code, lines.length);
  console.log(`\nwasmoon round ${round}: okTo=${okTo}/${lines.length} ${msg.slice(0, 100)}`);
  if (msg === "FULL_OK" || okTo >= lines.length) {
    console.log("SUCCESS: full triggerlua loads in wasmoon");
    break;
  }
  const badLine = lines[okTo] ?? "";
  console.log("  line", okTo + 1, JSON.stringify(badLine).slice(0, 140));

  // Extract near-ascii tokens and fuzzy-match dictionary (Hamming <= 2, length equal)
  const tokens = badLine.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  let fixed = false;
  for (const tok of tokens) {
    if (tok.length < 4) continue;
    for (const dict of DICT) {
      if (dict.length !== tok.length) continue;
      let miss = 0;
      for (let i = 0; i < tok.length; i++) if (tok[i] !== dict[i]) miss++;
      if (miss === 0 || miss > 2) continue;
      const snap = snapshot();
      const n = cribExactWhereKnown(mainK, dict, dict.length - miss);
      if (n > 0 && bothParse(mains)) {
        console.log(`  fix token ${tok} -> ${dict}`);
        fixed = true;
        break;
      }
      restore(snap);
    }
    if (fixed) break;
  }

  // Also try full-dict anchored cribs each round
  if (!fixed) {
    for (const dict of DICT) {
      if (dict.length < 6) continue;
      const snap = snapshot();
      const n = cribExactWhereKnown(mainK, dict, dict.length - 1);
      if (n > 0 && bothParse(mains)) {
        console.log(`  broad crib ${dict}`);
        fixed = true;
        break;
      }
      restore(snap);
    }
  }

  emit();
  if (!fixed) {
    console.log("  no automatic fix this round; stopping expand loop");
    break;
  }
}

emit();

// Report
const pK = dec(mainK);
const pU = dec(mainU);
console.log("\n=== report ===");
console.log("KWU name", (JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(pK)) as { module?: { name?: string } }).module?.name);
console.log("UMA name", (JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(pU)) as { module?: { name?: string } }).module?.name);
console.log("MAX", countSeq(pK, enc("MAX_LLM_RETRIES")), "INJECT", countSeq(pK, enc("INJECT_MARKER")));
console.log("TRIGGER_ID", countSeq(pK, enc("TRIGGER_ID")), "getChatVar", countSeq(pK, enc("getChatVar")));
const code = luaCode(mainK);
const { okTo, msg } = await wasmoonOkLines(code, code.split("\n").length);
console.log("wasmoon okTo", okTo, "/", code.split("\n").length, msg.slice(0, 120));
if (msg === "FULL_OK") {
  const r = await runLua(`${code}\nreturn 1\n`, { deadlineMs: 30000 });
  console.log("full run", r.ok ? "OK value=" + String(r.value) : r.message.slice(0, 120));
}
