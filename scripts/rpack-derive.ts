/**
 * One-off RPack table derivation (not shipped). Rebuilds the 256-byte decode map from real
 * .charx module bytes using public structure facts + known-plaintext cribs (JSON keys, Lua).
 * Run: bun scripts/rpack-derive.ts <a.charx> [b.charx ...]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";

/** Schema keys + Lua / host API strings that appear as plaintext in real modules. */
const MUST_STRINGS = [
  // JSON skeleton / schema
  '"name"', '"description"', '"id"', '"type"', '"comment"', '"content"', '"key"',
  '"secondkey"', '"mode"', '"insertorder"', '"alwaysActive"', '"selective"',
  '"trigger"', '"lorebook"', '"regex"', '"assets"', '"conditions"', '"effect"',
  '"triggerlua"', '"code"', '"lowLevelAccess"', '"ableFlag"', '"extentions"',
  '"risu_case_sensitive"', '"namespace"', '"true"', '"false"', '"null"',
  // Lua keywords / patterns (space-padded where unique)
  "function ", "function\n", "local ", "return ", " then", " else", "elseif",
  "end\n", "end)", "nil", "true", "false", "and ", " not ", " or ",
  "while ", "for ", "do\n", "break", "until ", "repeat",
  "tostring", "tonumber", "pcall", "pairs", "ipairs", "require",
  "getChatVar", "setChatVar", "getvar", "setvar",
  "string.", "table.", "math.",
  // high-value identifiers seen on complex cards
  "TRIGGER", "ACTIVE_TRIGGER", "KWU", "Constants", "Startup", "Runtime",
  "Campus", "Assets", "Prompts", "Tables", "Settings",
  "setCampusContext", "getCampusId", "getCampusName",
  // comment banners (must be dashes, not stars)
  "-- ===", "--=", "-- ",
  // common ops contexts
  " == ", " ~= ", " <= ", " >= ", " + ", " - ", " * ", " / ", " < ", " > ",
  " = ",
];

const paths = process.argv.slice(2).filter(Boolean);
if (paths.length === 0) {
  console.error("usage: bun scripts/rpack-derive.ts <path.charx> [more.charx ...]");
  process.exit(1);
}

function extractMain(charxPath: string): Uint8Array {
  const files = unzipSync(new Uint8Array(readFileSync(charxPath)));
  const m = files["module.risum"];
  if (!m) throw new Error(`rpack-derive: no module.risum in ${charxPath}`);
  if (m[0] !== 111 || m[1] !== 0) throw new Error(`rpack-derive: bad magic/version in ${charxPath}`);
  const mainLen = m[2]! | (m[3]! << 8) | (m[4]! << 16) | (m[5]! << 24);
  if (mainLen <= 0 || 6 + mainLen > m.length) throw new Error(`rpack-derive: bad mainLen in ${charxPath}`);
  return m.slice(6, 6 + mainLen);
}

const mains = paths.map((p) => {
  const main = extractMain(p);
  console.log(`loaded ${p.split(/[/\\]/).pop()}: main ${main.length} bytes`);
  return main;
});

type Map256 = Int16Array; // -1 unmapped

const empty = (): Map256 => {
  const a = new Int16Array(256);
  a.fill(-1);
  return a;
};

const usedPlains = (d: Map256): Set<number> => {
  const s = new Set<number>();
  for (let i = 0; i < 256; i++) if (d[i]! >= 0) s.add(d[i]!);
  return s;
};

const put = (d: Map256, cipher: number, plain: number): boolean => {
  if (d[cipher] === plain) return false;
  if (d[cipher] >= 0 && d[cipher] !== plain) return false;
  const used = usedPlains(d);
  if (d[cipher] < 0 && used.has(plain)) return false;
  d[cipher] = plain;
  return true;
};

/** Force-put only if free or already equal; returns false on hard conflict. */
const force = (d: Map256, cipher: number, plain: number): boolean => {
  if (d[cipher] === plain) return true;
  if (d[cipher] >= 0 && d[cipher] !== plain) return false;
  if (usedPlains(d).has(plain) && d[cipher] !== plain) return false;
  d[cipher] = plain;
  return true;
};

/** Anchor pretty-JSON skeleton (universal on every Risu module main block). */
function anchor(main: Uint8Array, d: Map256): void {
  // { \n two-spaces "
  force(d, main[0]!, 0x7b);
  force(d, main[1]!, 0x0a);
  force(d, main[2]!, 0x20);
  force(d, main[4]!, 0x22);
  const Q = main[4]!;
  let k = 5;
  while (k < main.length && main[k] !== Q) k++;
  if (k + 1 < main.length) force(d, main[k + 1]!, 0x3a); // :
}

/**
 * Try to place `word` at every offset; keep only cipher->plain edges that are consistent
 * across ALL successful placements (and with current map). Apply unambiguous edges.
 */
function cribWord(main: Uint8Array, d: Map256, word: string): number {
  const wlen = word.length;
  if (wlen === 0) return 0;
  const edgeVotes = new Map<string, number>(); // "c->p" -> count
  let hits = 0;
  const limit = main.length; // full scan - musts are short

  outer: for (let i = 0; i + wlen <= limit; i++) {
    const local = new Map<number, number>();
    for (let k = 0; k < wlen; k++) {
      const c = main[i + k]!;
      const p = word.charCodeAt(k);
      if (d[c]! >= 0 && d[c] !== p) continue outer;
      const prev = local.get(c);
      if (prev !== undefined && prev !== p) continue outer;
      // plain already claimed by another cipher in this placement
      for (const [oc, op] of local) if (op === p && oc !== c) continue outer;
      if (d[c]! < 0) {
        // plain already used by a different mapped cipher
        for (let x = 0; x < 256; x++) {
          if (d[x] === p && x !== c) continue outer;
        }
      }
      local.set(c, p);
    }
    hits++;
    for (const [c, p] of local) {
      const key = `${c}->${p}`;
      edgeVotes.set(key, (edgeVotes.get(key) ?? 0) + 1);
    }
    if (hits > 2000) break; // enough signal
  }
  if (hits === 0) return 0;

  // An edge is trusted if it appears in every hit (or all hits we counted)
  let applied = 0;
  for (const [key, n] of edgeVotes) {
    if (n < hits) continue; // must be in every placement
    const [cs, ps] = key.split("->");
    const c = Number(cs);
    const p = Number(ps);
    if (put(d, c, p)) applied++;
  }
  return applied;
}

/** Cross-main: only keep mappings present and equal on every main that defined them. */
function mergeMaps(maps: Map256[]): Map256 {
  const out = empty();
  for (let c = 0; c < 256; c++) {
    let plain = -1;
    let conflict = false;
    for (const m of maps) {
      const p = m[c]!;
      if (p < 0) continue;
      if (plain < 0) plain = p;
      else if (plain !== p) conflict = true;
    }
    if (!conflict && plain >= 0) {
      // resolve plain collisions: first cipher wins
      if (![...usedPlains(out)].includes(plain) || out[c] === plain) {
        if (!usedPlains(out).has(plain)) out[c] = plain;
      }
    } else if (conflict) {
      console.log(`  drop conflict cipher ${c}`);
    }
  }
  return out;
}

/** Lua comment dash: modal doubled unmapped-or-dashlike after newline in decoded-ish scan. */
function cribCommentDash(main: Uint8Array, d: Map256): void {
  // Count doubled cipher pairs that appear after \n (comment banners `-- ===`)
  const nl = [...d].findIndex((p) => p === 0x0a);
  if (nl < 0) return;
  const counts = new Map<number, number>();
  for (let i = 0; i < main.length - 3; i++) {
    if (main[i] !== nl) continue;
    // optional spaces then XX XX
    let j = i + 1;
    const sp = [...d].findIndex((p) => p === 0x20);
    while (sp >= 0 && j < main.length && main[j] === sp) j++;
    if (j + 1 >= main.length) continue;
    if (main[j] === main[j + 1]) {
      const c = main[j]!;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked[0] && ranked[0][1] >= 5) {
    if (force(d, ranked[0][0], 0x2d)) {
      console.log(`  comment dash: cipher ${ranked[0][0]} -> '-' (n=${ranked[0][1]})`);
    }
  }
}

/** Digits: bytes that appear outside JSON strings (quote-aware) map to 0-9 by frequency. */
function cribDigits(main: Uint8Array, d: Map256): void {
  const q = [...d].findIndex((p) => p === 0x22);
  const bs = [...d].findIndex((p) => p === 0x5c);
  if (q < 0) return;
  const outside = new Map<number, number>();
  let inStr = false;
  for (let i = 0; i < main.length; i++) {
    const c = main[i]!;
    if (c === q && !(i > 0 && main[i - 1] === bs)) {
      inStr = !inStr;
      continue;
    }
    if (!inStr && d[c]! < 0) outside.set(c, (outside.get(c) ?? 0) + 1);
  }
  // only assign digit 0-9; leave . - e + for later cribs
  const glyphs = [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39];
  const ranked = [...outside.entries()].sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < ranked.length && i < glyphs.length; i++) {
    put(d, ranked[i]![0], glyphs[i]!);
  }
}

/** Structural punctuation from known skeleton. */
function cribStructural(main: Uint8Array, d: Map256): void {
  const nl = [...d].findIndex((p) => p === 0x0a);
  const sp = [...d].findIndex((p) => p === 0x20);
  if (nl < 0 || sp < 0) return;

  const modal = (pred: (i: number) => boolean): number => {
    const cnt = new Map<number, number>();
    for (let i = 1; i < main.length - 1; i++) {
      if (!pred(i)) continue;
      const c = main[i]!;
      if (d[c]! >= 0) continue;
      cnt.set(c, (cnt.get(c) ?? 0) + 1);
    }
    let best = -1;
    let bn = 0;
    for (const [c, n] of cnt) if (n > bn) {
      bn = n;
      best = c;
    }
    return best;
  };

  // comma before newline
  const comma = modal((i) => d[main[i - 1]!]! >= 0 && main[i + 1] === nl);
  if (comma >= 0) put(d, comma, 0x2c);

  // closers } ] at dedented lines
  const openerCnt = new Map<number, number>();
  for (let i = 2; i < main.length - 1; i++) {
    if (main[i - 1] === sp && main[i - 2] === sp && d[main[i]!]! < 0) {
      const next = main[i + 1]!;
      if (next === nl || d[next]! === 0x2c) {
        openerCnt.set(main[i]!, (openerCnt.get(main[i]!) ?? 0) + 1);
      }
    }
  }
  const openers = [...openerCnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (openers[0]) put(d, openers[0][0], 0x7d);
  if (openers[1]) put(d, openers[1][0], 0x5d);

  // [ before ]
  const closeBr = [...d].findIndex((p) => p === 0x5d);
  const col = [...d].findIndex((p) => p === 0x3a);
  if (closeBr >= 0 && col >= 0) {
    const ob = modal((i) => main[i - 2] === col && main[i - 1] === sp && main[i + 1] === closeBr);
    if (ob >= 0) put(d, ob, 0x5b);
  }

  // backslash before known 'n'
  const nC = [...d].findIndex((p) => p === 0x6e);
  if (nC >= 0) {
    const bs = modal((i) => main[i + 1] === nC && d[main[i]!]! < 0);
    if (bs >= 0) put(d, bs, 0x5c);
  }

  // ( after letter
  const isLower = (c: number): boolean => {
    const p = d[c]!;
    return p >= 0x61 && p <= 0x7a;
  };
  const lp = modal((i) => isLower(main[i - 1]!) && d[main[i]!]! < 0);
  if (lp >= 0) put(d, lp, 0x28);
  const cm = [...d].findIndex((p) => p === 0x2c);
  const rp = modal(
    (i) => (main[i + 1] === cm || main[i + 1] === nl) && d[main[i]!]! < 0 && d[main[i - 1]!]! >= 0,
  );
  if (rp >= 0) put(d, rp, 0x29);

  // . between letters
  const dot = modal((i) => isLower(main[i - 1]!) && d[main[i]!]! < 0 && isLower(main[i + 1]!));
  if (dot >= 0) put(d, dot, 0x2e);

  // = space-flanked modal (assignment)
  const eq = modal((i) => main[i - 1] === sp && main[i + 1] === sp && d[main[i]!]! < 0);
  if (eq >= 0) put(d, eq, 0x3d);
}

function deriveOne(main: Uint8Array): Map256 {
  const d = empty();
  anchor(main, d);
  // iterate cribs to fixpoint
  for (let round = 0; round < 12; round++) {
    let gained = 0;
    for (const w of MUST_STRINGS) gained += cribWord(main, d, w);
    cribStructural(main, d);
    cribCommentDash(main, d);
    if (round === 2) cribDigits(main, d);
    const n = [...d].filter((p) => p >= 0).length;
    console.log(`  round ${round}: +${gained} edges, mapped ${n}`);
    if (gained === 0 && round > 3) break;
  }
  return d;
}

function completeBijection(d: Map256, mains: Uint8Array[]): void {
  const appearing = new Set<number>();
  for (const main of mains) for (const b of main) appearing.add(b);

  // Prefer leaving appearing unmapped as last resort with SAFE placeholders only if needed for parse
  const DANGER = new Set([0x22, 0x5c]);
  const used = usedPlains(d);
  const need = [...appearing].filter((c) => d[c]! < 0).sort((a, b) => a - b);
  const freePlain: number[] = [];
  for (let p = 0x21; p < 0x7f; p++) if (!used.has(p) && !DANGER.has(p)) freePlain.push(p);
  for (let p = 0xa1; p <= 0xff; p++) if (!used.has(p)) freePlain.push(p);
  for (let p = 1; p < 0x20; p++) if (!used.has(p) && p !== 0x0a && p !== 0x0d && p !== 0x09) freePlain.push(p);

  let fi = 0;
  for (const c of need) {
    const p = freePlain[fi++];
    if (p === undefined) break;
    d[c] = p;
  }

  // fill never-seen ciphers for full permutation (encode inverse)
  const used2 = usedPlains(d);
  const rest: number[] = [];
  for (let p = 0; p < 256; p++) if (!used2.has(p)) rest.push(p);
  let ri = 0;
  for (let c = 0; c < 256; c++) {
    if (d[c]! >= 0) continue;
    d[c] = rest[ri++] ?? 0;
  }
}

function decodeText(main: Uint8Array, d: Map256): string {
  const out = new Uint8Array(main.length);
  for (let i = 0; i < main.length; i++) {
    const p = d[main[i]!]!;
    out[i] = p >= 0 ? p : 0x3f;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(out);
}

// --- drive ---
const per = mains.map((main, i) => {
  console.log(`derive sample ${i}`);
  return deriveOne(main);
});
let d = mergeMaps(per);
console.log(`merged mapped: ${[...d].filter((p) => p >= 0).length}`);

// joint crib rounds on shared map across all mains
for (let round = 0; round < 8; round++) {
  let gained = 0;
  for (const main of mains) {
    for (const w of MUST_STRINGS) gained += cribWord(main, d, w);
    cribStructural(main, d);
    cribCommentDash(main, d);
  }
  console.log(`joint round ${round}: +${gained}, mapped ${[...d].filter((p) => p >= 0).length}`);
  if (gained === 0) break;
}

completeBijection(d, mains);

// quality gates
let allOk = true;
for (let i = 0; i < mains.length; i++) {
  const text = decodeText(mains[i]!, d);
  try {
    JSON.parse(text);
    console.log(`\nOK parse sample ${i}`);
  } catch (e) {
    allOk = false;
    console.log(`\nFAIL parse sample ${i}: ${(e as Error).message.slice(0, 100)}`);
    console.log(text.slice(0, 300));
    continue;
  }
  const stars = (text.match(/^\s*\*\*/gm) || []).length;
  const dashes = (text.match(/^\s*--/gm) || []).length;
  const trigPipe = (text.match(/TRI\|\|/g) || []).length;
  const trigger = (text.match(/TRIGGER/g) || []).length;
  const getChat = (text.match(/getChatVar/g) || []).length;
  console.log(`  -- comments: ${dashes}  ** comments: ${stars}`);
  console.log(`  TRIGGER: ${trigger}  TRI||: ${trigPipe}  getChatVar: ${getChat}`);
  const idx = text.indexOf("function ");
  if (idx >= 0) console.log(`  function head: ${JSON.stringify(text.slice(idx, idx + 120))}`);
}

if (!allOk) {
  console.error("not emitting (JSON.parse failed)");
  process.exit(1);
}

const arr = [...d];
const body =
  `/**\n` +
  ` * RPack substitution table for .risum: DECODE[cipher] = plain, ENCODE is the inverse.\n` +
  ` * Emitted by scripts/rpack-derive.ts from real module bytes + public cribs.\n` +
  ` */\n` +
  `export const DECODE: readonly number[] = [${arr.join(",")}];\n` +
  `export const ENCODE: readonly number[] = (() => { const e = new Array(256).fill(0); DECODE.forEach((p, c) => { e[p] = c; }); return e; })();\n`;

writeFileSync("src/formats/risu/rpack/table.ts", body);
console.log("\n[emitted] src/formats/risu/rpack/table.ts");
