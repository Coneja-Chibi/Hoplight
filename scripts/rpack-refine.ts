/**
 * One-off RPack table refinement. Starts from the multi-sample table and applies empirical
 * swaps/cribs from known plaintext on real cards. Run: bun scripts/rpack-refine.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { DECODE as BASE } from "../src/formats/risu/rpack/table";

const D = Int16Array.from(BASE as readonly number[]);

const swapC = (a: number, b: number, why: string): void => {
  if (a < 0 || b < 0 || a === b) return;
  const t = D[a]!;
  D[a] = D[b]!;
  D[b] = t;
  console.log(`swap ${a}<->${b} (${why})`);
};

const forceCipher = (cipher: number, plain: number, why: string): void => {
  if (D[cipher] === plain) return;
  const holder = [...D].findIndex((p) => p === plain);
  if (holder >= 0 && holder !== cipher) {
    // swap so bijection preserved
    const old = D[cipher]!;
    D[cipher] = plain;
    D[holder] = old;
    console.log(`force swap ${cipher}<->${holder} -> ${plain} (${why})`);
  } else {
    D[cipher] = plain;
    console.log(`force ${cipher} -> ${plain} (${why})`);
  }
};

function loadMain(charxPath: string): Uint8Array {
  const m = unzipSync(new Uint8Array(readFileSync(charxPath)))["module.risum"]!;
  const len = m[2]! | (m[3]! << 8) | (m[4]! << 16) | (m[5]! << 24);
  return m.slice(6, 6 + len);
}

function decBytes(main: Uint8Array): Uint8Array {
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

// --- known empirical letter/punct fixes (from dual-card + Lua patterns) ---
swapC(56, 27, "| <-> G for TRIGGER");
swapC(12, 254, "* <-> - for -- comments");
swapC(25, 47, "D <-> Z for Direction / TRIGGER_ID");
swapC(84, 35, "< <-> ~ for ~= nil");

const KWU = "C:/Users/chiev/Downloads/한국여자대학교 V1.0.charx";
const UMA = "C:/Users/chiev/Downloads/우마무스메_봇_1.12ver.charx";
const mainK = loadMain(KWU);
const mainU = loadMain(UMA);

// Korean module title crib: card name stem + " V6.0 Module" (seen as ASCII tail after decode)
const card = JSON.parse(
  Buffer.from(unzipSync(new Uint8Array(readFileSync(KWU)))["card.json"]!).toString(),
) as { data: { name: string } };
const stem = String(card.data.name).replace(/\s*V[\d.]+$/, "").trim(); // 한국여자대학교
const titleGuesses = [`${stem} V6.0 Module`, `${stem} V1.0 Module`, stem];

function applyStringCrib(main: Uint8Array, known: string, anchorAscii: string): boolean {
  const plain = decBytes(main);
  const anchor = enc(anchorAscii);
  const at = findSeq(plain, anchor);
  if (at < 0) return false;
  // known string should END at anchor end or contain anchor
  const knownB = enc(known);
  // try: known ends with anchor
  if (!known.endsWith(anchorAscii) && !known.includes(anchorAscii)) return false;
  const start = known.endsWith(anchorAscii)
    ? at - (knownB.length - anchor.length)
    : findSeq(plain, knownB);
  if (known.endsWith(anchorAscii)) {
    if (start < 0) return false;
    for (let k = 0; k < knownB.length; k++) {
      forceCipher(main[start + k]!, knownB[k]!, `title crib ${knownB[k]}`);
    }
    return true;
  }
  return false;
}

for (const g of titleGuesses) {
  if (g.includes("V6.0 Module") && applyStringCrib(mainK, g, " V6.0 Module")) {
    console.log("applied title crib", g);
    break;
  }
  if (g.includes("V1.0 Module") && applyStringCrib(mainK, g, " V1.0 Module")) {
    console.log("applied title crib", g);
    break;
  }
}

// Uma title if we can read card name
try {
  const ucard = JSON.parse(
    Buffer.from(unzipSync(new Uint8Array(readFileSync(UMA)))["card.json"]!).toString(),
  ) as { data: { name: string } };
  const uname = String(ucard.data.name);
  console.log("uma card name", uname);
  // try crib "Module for " + something - skip if unstable
} catch {
  /* ignore */
}

// Operator cribs: look for `i + 1` style after letters fixed - digit space OP space digit
// Prefer assigning remaining unmapped-looking high-frequency ops
function recoverOps(main: Uint8Array): void {
  const plain = decBytes(main);
  const dig = (b: number): boolean => b >= 0x30 && b <= 0x39;
  // Collect cipher of middle byte in dig SP X SP dig
  const mid = new Map<number, number>(); // cipher -> count
  for (let i = 2; i < plain.length - 2; i++) {
    if (!dig(plain[i - 2]!) || plain[i - 1] !== 0x20 || plain[i + 1] !== 0x20 || !dig(plain[i + 2]!)) {
      continue;
    }
    const c = main[i]!;
    mid.set(c, (mid.get(c) ?? 0) + 1);
  }
  const ranked = [...mid.entries()].sort((a, b) => b[1] - a[1]);
  console.log(
    "digit-op-digit ciphers",
    ranked.slice(0, 8).map(([c, n]) => `${c}->${D[c]}(${JSON.stringify(String.fromCharCode(D[c]!))}) n=${n}`),
  );
  // Want + - * / % among these. - may already be correct (space-flanked minus).
  const want = [0x2b, 0x2f, 0x2a, 0x25]; // + / * %
  const usedPlain = new Set<number>();
  for (let i = 0; i < 256; i++) usedPlain.add(D[i]!);
  for (const [cipher, n] of ranked) {
    if (n < 3) break;
    const cur = D[cipher]!;
    if ([0x2b, 0x2d, 0x2a, 0x2f, 0x25, 0x3c, 0x3e].includes(cur)) continue; // already op-like
  }
  // Forced: common Lua ` + 1` after known patterns - search cipher stream for digit 1 after space
  // Pattern: SP X SP 0x31 where X should be + often
  const plusVotes = new Map<number, number>();
  for (let i = 1; i < plain.length - 2; i++) {
    if (plain[i - 1] === 0x20 && plain[i + 1] === 0x20 && plain[i + 2] === 0x31) {
      // space X space '1'
      const c = main[i]!;
      plusVotes.set(c, (plusVotes.get(c) ?? 0) + 1);
    }
  }
  const plusRank = [...plusVotes.entries()].sort((a, b) => b[1] - a[1]);
  console.log(
    "space X space 1",
    plusRank.slice(0, 6).map(([c, n]) => `${c}->${D[c]}(${String.fromCharCode(D[c]!)}) n=${n}`),
  );
  // If top is not + and not - (minus also before 1), assign + to top non-minus
  for (const [c, n] of plusRank) {
    if (n < 5) break;
    if (D[c] === 0x2d) continue; // keep minus
    if (D[c] === 0x2b) break;
    // only if current plain is "wrong op placeholder" (high or letter)
    const p = D[c]!;
    if (p === 0x2f || p === 0x2a || p > 0x7f || (p >= 0x41 && p <= 0x7a)) {
      forceCipher(c, 0x2b, `+ from ' X 1' n=${n}`);
      break;
    }
  }
}

recoverOps(mainK);

// Quality report
function report(label: string, main: Uint8Array): void {
  const plain = decBytes(main);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(plain);
  let parsed = false;
  try {
    JSON.parse(text);
    parsed = true;
  } catch {
    parsed = false;
  }
  console.log(`\n=== ${label} ===`);
  console.log("JSON.parse", parsed);
  console.log("TRIGGER_ID", countSeq(plain, enc("TRIGGER_ID")));
  console.log("TRI||", countSeq(plain, enc("TRI||")));
  console.log("-- ===", countSeq(plain, enc("-- ===")));
  console.log("** ===", countSeq(plain, enc("** ===")));
  console.log("Direction", countSeq(plain, enc("Direction")));
  console.log("~= nil", countSeq(plain, enc("~= nil")));
  console.log("getChatVar", countSeq(plain, enc("getChatVar")));
  let plus = 0;
  let minus = 0;
  let slash = 0;
  let star = 0;
  for (let i = 1; i < plain.length - 1; i++) {
    if (plain[i - 1] !== 0x20 || plain[i + 1] !== 0x20) continue;
    const o = plain[i]!;
    if (o === 0x2b) plus++;
    else if (o === 0x2d) minus++;
    else if (o === 0x2f) slash++;
    else if (o === 0x2a) star++;
  }
  console.log({ plus, minus, slash, star });
  try {
    const obj = JSON.parse(text) as { module?: { name?: string }; name?: string };
    const name = obj.module?.name ?? obj.name;
    console.log("name", name);
  } catch {
    /* ignore */
  }
  // lua load syntax smoke: extract first triggerlua code if possible
  try {
    const obj = JSON.parse(text) as {
      module?: { trigger?: Array<{ effect?: Array<{ type?: string; code?: string }> }> };
      trigger?: Array<{ effect?: Array<{ type?: string; code?: string }> }>;
    };
    const mod = obj.module ?? obj;
    const code = mod.trigger?.[0]?.effect?.find((e) => e.type === "triggerlua")?.code ?? "";
    console.log("lua head", JSON.stringify(code.slice(0, 220)));
  } catch {
    /* ignore */
  }
}

report("KWU", mainK);
report("UMA", mainU);

// bijection check
const plains = new Set<number>();
for (let i = 0; i < 256; i++) plains.add(D[i]!);
if (plains.size !== 256) {
  console.error("bijection broken", plains.size);
  process.exit(1);
}

// both must parse
for (const main of [mainK, mainU]) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(decBytes(main));
  JSON.parse(text);
}

const body =
  `/**\n` +
  ` * RPack substitution table for .risum: DECODE[cipher] = plain, ENCODE is the inverse.\n` +
  ` * Emitted by scripts/rpack-derive.ts / rpack-refine.ts from real module bytes + public cribs.\n` +
  ` */\n` +
  `export const DECODE: readonly number[] = [${[...D].join(",")}];\n` +
  `export const ENCODE: readonly number[] = (() => { const e = new Array(256).fill(0); DECODE.forEach((p, c) => { e[p] = c; }); return e; })();\n`;

writeFileSync("src/formats/risu/rpack/table.ts", body);
console.log("\n[emitted] src/formats/risu/rpack/table.ts");
