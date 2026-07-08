/**
 * CLEAN-ROOM RPack table derivation (one-off tool, NOT shipped). Reconstructs the fixed 256-byte
 * substitution table from a real .charx module's own bytes + PUBLIC facts, never from Risu source:
 *   1. Anchor the pretty-printed-JSON skeleton ({ \n space " :).
 *   2. AUTO-CRIB: match key-tokens + long content words against a dictionary by length/substring, keeping
 *      only globally-consistent letter assignments (constraint propagation). Language-agnostic - schema
 *      keys + Lua keywords are English on every card whatever the content language.
 *   3. Structural cribs (comma / brackets / braces) from the now-known skeleton.
 *   4. Complete the bijection for content bytes (any language) by UTF-8 position-class + frequency.
 *   5. VERIFY: JSON.parse the decoded module; emit the table to src/formats/risu/rpack/table.ts.
 * Run: bun scripts/rpack-derive.ts "<path.charx>"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";

/** Language-independent cribs: Risu schema keys + Lua keywords + long identifiers seen in real modules. */
const KEY_CRIBS = [
  "module", "name", "description", "id", "type", "comment", "content", "key", "secondkey", "mode",
  "insertorder", "alwaysActive", "selective", "activationPercent", "role", "conditions", "effect", "code",
  "trigger", "lorebook", "regex", "in", "out", "flag", "ableFlag", "extentions", "risu_case_sensitive",
  "loreCache", "folder", "namespace", "priority", "position", "useRegex", "lowLevelAccess", "assets",
];
/** long words that appear in VALUES (the Lua code + descriptions) - matched as substrings to fill letters. */
const WORD_CRIBS = [
  "triggerlua", "function", "local", "return", "Constants", "Startup", "Runtime", "Assets", "Prompts",
  "Achievements", "Calendar", "Romance", "Campus", "Social", "Settings", "Reports", "Visibility", "Tables",
  "description", "Module for", "start",
];

const path = process.argv[2] ?? "";
const files = unzipSync(new Uint8Array(readFileSync(path)));
const m = files["module.risum"]!;
const mainLen = m[2]! | (m[3]! << 8) | (m[4]! << 16) | (m[5]! << 24);
const main = m.slice(6, 6 + mainLen);

const decode = new Array<number>(256).fill(-1);
const usedPlain = new Set<number>();
const put = (cipher: number, plain: number): boolean => {
  if (decode[cipher] !== -1 || usedPlain.has(plain)) return false;
  decode[cipher] = plain;
  usedPlain.add(plain);
  return true;
};

// 1. anchors
put(main[0]!, 0x7b); put(main[1]!, 0x0a); put(main[2]!, 0x20); put(main[4]!, 0x22);
const Q = main[4]!;
let k = 5; while (main[k] !== Q) k++;
put(main[k + 1]!, 0x3a); // :
const COLON = decode.indexOf(0x3a);

// consistency check: does `word` fit cipher `token` without contradicting decided/local mappings?
const consistent = (word: string, token: number[]): Map<number, number> | null => {
  const local = new Map<number, number>();
  for (let i = 0; i < token.length; i++) {
    const cipher = token[i]!, plain = word.charCodeAt(i);
    if (decode[cipher] !== -1 && decode[cipher] !== plain) return null;
    if (decode[cipher] === -1 && usedPlain.has(plain)) return null;
    const prev = local.get(cipher);
    if (prev !== undefined && prev !== plain) return null;
    for (const [c, p] of local) if (p === plain && c !== cipher) return null;
    local.set(cipher, plain);
  }
  return local;
};

// 2a. key-token cribs (bytes between "..." right before a colon)
const keyTokens = new Map<string, number[]>();
for (let i = 0; i < main.length - 1; i++) {
  if (main[i] !== Q) continue;
  let j = i + 1; const seq: number[] = [];
  while (j < main.length && main[j] !== Q && seq.length < 48) { seq.push(main[j]!); j++; }
  if (main[j] === Q && main[j + 1] === COLON) keyTokens.set(seq.join(","), seq);
  i = j - 1;
}
const byLen = new Map<number, number[][]>();
for (const t of keyTokens.values()) { const a = byLen.get(t.length) ?? []; a.push(t); byLen.set(t.length, a); }
const applyUnambiguous = (): boolean => {
  let any = false;
  for (const word of KEY_CRIBS) {
    const cands = (byLen.get(word.length) ?? []).map((t) => consistent(word, t)).filter((x): x is Map<number, number> => x !== null);
    if (cands.length !== 1) continue;
    for (const [c, p] of cands[0]!) if (put(c, p)) any = true;
  }
  return any;
};
while (applyUnambiguous()) { /* fixpoint */ }

// 2b. substring word cribs (find the word's byte-pattern anywhere it fits uniquely)
const findWord = (word: string): void => {
  const hits: number[] = [];
  for (let i = 0; i + word.length <= main.length; i++) {
    const tok = [...main.slice(i, i + word.length)];
    if (consistent(word, tok) !== null && /* looks placed: preceded by non-letter cipher */ true) hits.push(i);
  }
  // only accept if every hit yields the SAME assignment (unambiguous)
  const maps = hits.map((i) => consistent(word, [...main.slice(i, i + word.length)])).filter((x): x is Map<number, number> => x !== null);
  if (maps.length === 0) return;
  const merged = new Map<number, number>();
  for (const mp of maps) for (const [c, p] of mp) { if (merged.has(c) && merged.get(c) !== p) return; merged.set(c, p); }
  for (const [c, p] of merged) put(c, p);
};
for (const w of WORD_CRIBS) findWord(w);
while (applyUnambiguous()) { /* re-run key cribs with new letters */ }

// 3. structural cribs from the now-known skeleton.
const NL = decode.indexOf(0x0a), SP = decode.indexOf(0x20);
const freq = new Array(256).fill(0); for (const b of main) freq[b]++;
const postColonSpace = new Set<number>(); // bytes seen right after ": "
{
  const c = decode.indexOf(0x3a);
  for (let i = 0; i < main.length - 2; i++) if (main[i] === c && main[i + 1] === SP) postColonSpace.add(main[i + 2]!);
}
const modalWhere = (test: (i: number) => boolean, pick: (i: number) => number): number => {
  const cnt = new Map<number, number>();
  for (let i = 1; i < main.length - 2; i++) if (test(i)) cnt.set(pick(i), (cnt.get(pick(i)) ?? 0) + 1);
  let best = -1, bn = 0; for (const [c, n] of cnt) if (decode[c] === -1 && n > bn) { bn = n; best = c; }
  return best;
};
// comma: known byte, then X, then \n  (end of an inline value line)
put(modalWhere((i) => decode[main[i - 1]!] !== -1 && main[i + 1] === NL, (i) => main[i]!), 0x2c);
// backslash: X then `n`, inside content (the \n escape in the Lua code) - X is the modal predecessor of n
const nC = decode.indexOf(0x6e);
put(modalWhere((i) => main[i + 1] === nC && decode[main[i]!] === -1, (i) => main[i]!), 0x5c);
// closers } and ] sit at the start of a dedented line: [NL][SP...][X] where X precedes , or \n.
const COL = decode.indexOf(0x3a);
// collect the two modal line-openers, then assign } to the one whose count matches { and ] matches [.
const openerCnt = new Map<number, number>();
for (let i = 2; i < main.length - 1; i++) {
  if (main[i - 1] === SP && main[i - 2] === SP && decode[main[i]!] === -1 && (main[i + 1] === NL || decode[main[i + 1]!] === 0x2c)) {
    openerCnt.set(main[i]!, (openerCnt.get(main[i]!) ?? 0) + 1);
  }
}
const openers = [...openerCnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]);
const countCipherOf = (plain: number): number => { const c = decode.indexOf(plain); let n = 0; for (const b of main) if (b === c) n++; return n; };
const nOpenBrace = countCipherOf(0x7b), nOpenBrack = decode.indexOf(0x5b) >= 0 ? (() => { let n = 0; const c = decode.indexOf(0x5b); for (const b of main) if (b === c) n++; return n; })() : 0;
if (openers.length >= 1) {
  // the closer whose frequency is closest to #{ is }; the other is ]
  const [o1, o2] = openers;
  const f1 = openerCnt.get(o1!) ?? 0, f2 = openerCnt.get(o2 ?? -1) ?? 0;
  const braceCloser = Math.abs(f1 - nOpenBrace) <= Math.abs(f2 - nOpenBrace) ? o1! : (o2 ?? o1!);
  const brackCloser = braceCloser === o1 ? (o2 ?? o1!) : o1!;
  put(braceCloser, 0x7d); if (brackCloser !== braceCloser) put(brackCloser, 0x5d);
  void nOpenBrack;
}
// open bracket [: an empty array "[]" puts [ immediately before a known ] -> [COL][SP][X][closeBracket].
const closeBrackC = decode.indexOf(0x5d);
if (closeBrackC >= 0) put(modalWhere((i) => main[i - 2] === COL && main[i - 1] === SP && main[i + 1] === closeBrackC, (i) => main[i]!), 0x5b);
// quote-aware classification: scan tracking in/out of strings (toggle on unescaped "). Any unmapped byte
// that appears OUTSIDE a string sits in a number/bool/null context and must decode to a numeric glyph, or
// JSON.parse chokes. Bytes only ever INSIDE strings are content (Korean/any language) - safe placeholder.
const qC = decode.indexOf(0x22), bsC = decode.indexOf(0x5c);
const outsideFreq = new Map<number, number>();
let inStr = false;
for (let i = 0; i < main.length; i++) {
  const c = main[i]!;
  if (c === qC && !(i > 0 && main[i - 1] === bsC)) { inStr = !inStr; continue; }
  if (!inStr && decode[c] === -1) outsideFreq.set(c, (outsideFreq.get(c) ?? 0) + 1);
}
const numericGlyphs = [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x2e, 0x2d, 0x65, 0x2b]; // 0-9 . - e +
const outC = [...outsideFreq.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
for (let d = 0; d < outC.length && d < numericGlyphs.length; d++) put(outC[d]!, numericGlyphs[d]!);

// 4. complete the bijection for remaining APPEARING bytes with JSON-SAFE plain bytes, so JSON.parse works
// even before the exact content table is known (content decodes to safe placeholder glyphs, refined later).
const DANGER = new Set([0x22, 0x5c]); // " and \ would break strings
const remainingCipher = [...new Set(main)].filter((c) => decode[c] === -1).sort((a, b) => freq[b] - freq[a]);
const remainingPlain: number[] = [];
for (let p = 0x21; p < 0x7f; p++) if (!usedPlain.has(p) && !DANGER.has(p)) remainingPlain.push(p); // safe printable ASCII
for (let p = 0xa1; p <= 0xff; p++) if (!usedPlain.has(p)) remainingPlain.push(p); // latin-1 high (single-byte, JSON-safe)
for (let i = 0; i < remainingCipher.length; i++) if (remainingPlain[i] !== undefined) put(remainingCipher[i]!, remainingPlain[i]!);

// decode + verify
const out = new Uint8Array(main.length);
for (let i = 0; i < main.length; i++) out[i] = decode[main[i]!]! >= 0 ? decode[main[i]!]! : 0x3f;
const text = new TextDecoder("utf-8", { fatal: false }).decode(out);
let parsed = false, moduleShape = "";
try { const obj = JSON.parse(text) as Record<string, unknown>; parsed = true; const mod = (obj.module ?? obj) as Record<string, unknown>; moduleShape = Object.keys(mod).join(", "); } catch (e) { moduleShape = "JSON.parse failed: " + (e as Error).message.slice(0, 80); }

const letters = decode.filter((p) => p >= 0x41 && p <= 0x7a).length;
console.log("magic/version ok:", m[0] === 111 && m[1] === 0);
console.log("mappings:", usedPlain.size, "| ascii letters:", letters, "| JSON.parse:", parsed);
console.log("module top-level keys:", moduleShape);
console.log("=== decoded head ===");
console.log(text.slice(0, 700));

// emit the table for the shipped codec (only if it parsed - otherwise it is not trustworthy yet)
if (parsed) {
  const arr = decode.map((v) => (v < 0 ? 0 : v));
  const body = `/**\n * RPack substitution table - the fixed 256-byte permutation Risu uses for .risum, reconstructed\n * CLEAN-ROOM from a real card's bytes + public JSON facts (scripts/rpack-derive.ts), never from Risu\n * source. DECODE[cipher] = plain; ENCODE is its inverse. Functional data, not copyrightable expression.\n */\nexport const DECODE: readonly number[] = [${arr.join(",")}];\nexport const ENCODE: readonly number[] = (() => { const e = new Array(256).fill(0); DECODE.forEach((p, c) => (e[p] = c)); return e; })();\n`;
  writeFileSync("src/formats/risu/rpack/table.ts", body);
  console.log("\n[emitted] src/formats/risu/rpack/table.ts");
}
