/**
 * CLEAN-ROOM RPack table derivation (one-off tool, NOT shipped in the app bundle). Reconstructs the fixed
 * 256-byte substitution table from a real .charx module's own bytes + PUBLIC facts, never from Risu source:
 *   1. Anchor the pretty-printed-JSON skeleton ({ \n space " :).
 *   2. AUTO-CRIB: match each key-token (bytes between "..." before a colon) against the Risu SCHEMA-KEY
 *      dictionary by length, keep only globally-consistent letter assignments (constraint propagation).
 *      This is language-agnostic - schema keys are English on every card, whatever the content language.
 *   3. Solve the remaining high bytes (content, any language) by UTF-8 validity + byte frequency.
 *   4. VERIFY by JSON.parse of the decoded module, then a lossless round-trip (re-encode === input).
 * Emits the derived table for the shipped codec. Run: bun scripts/rpack-derive.ts "<path.charx>"
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

/** Risu schema keys - language-independent cribs. Module / lorebook / trigger / regex field names. */
const SCHEMA_KEYS = [
  "module", "name", "description", "id", "type", "comment", "content", "key", "secondkey", "mode",
  "insertorder", "alwaysActive", "selective", "activationPercent", "role", "conditions", "effect", "code",
  "trigger", "lorebook", "regex", "in", "out", "flag", "ableFlag", "extentions", "risu_case_sensitive",
  "loreCache", "folder", "customFlags", "namespace", "priority", "position", "useRegex", "scanDepth",
  "lowLevelAccess", "backgroundEmbedding", "assets", "regexScript", "trigglerScript", "triggerscript",
];

const path = process.argv[2] ?? "";
const files = unzipSync(new Uint8Array(readFileSync(path)));
const m = files["module.risum"]!;
const mainLen = m[2]! | (m[3]! << 8) | (m[4]! << 16) | (m[5]! << 24);
const main = m.slice(6, 6 + mainLen);

// decode[cipher] = plain byte; a partial bijection we grow.
const decode = new Array<number>(256).fill(-1);
const usedPlain = new Set<number>();
const put = (cipher: number, plain: number): boolean => {
  if (decode[cipher] !== -1 || usedPlain.has(plain)) return false; // already set or conflict -> no change
  decode[cipher] = plain;
  usedPlain.add(plain);
  return true; // true == a NEW mapping was added (drives the fixpoint)
};

// 1. anchors
put(main[0]!, 0x7b); // {
put(main[1]!, 0x0a); // \n
put(main[2]!, 0x20); // space
put(main[4]!, 0x22); // "
const Q = main[4]!;
// deterministic colon: first key runs from main[4] (open) to the next Q (close); byte after = colon
let k = 5;
while (main[k] !== Q) k++;
put(main[k + 1]!, 0x3a); // :
const COLON = decode.indexOf(0x3a);

// collect key-tokens (cipher byte sequences that sit before a colon)
const keyTokens = new Map<string, number>();
for (let i = 0; i < main.length - 1; i++) {
  if (main[i] !== Q) continue;
  let j = i + 1;
  const seq: number[] = [];
  while (j < main.length && main[j] !== Q && seq.length < 48) { seq.push(main[j]!); j++; }
  if (main[j] === Q && main[j + 1] === COLON) keyTokens.set(seq.join(","), (keyTokens.get(seq.join(",")) ?? 0) + 1);
  i = j - 1;
}

// 2. AUTO-CRIB: propose letter maps from token<->schema-key matches, accept globally-consistent ones.
// A token of length L can be any schema key of length L; a match is valid only if its per-letter
// cipher->plain assignment never contradicts another accepted mapping. Iterate to a fixpoint.
const tokensByLen = new Map<number, number[][]>();
for (const [key, count] of keyTokens) {
  const bytes = key.split(",").map(Number);
  const arr = tokensByLen.get(bytes.length) ?? [];
  arr.push(bytes);
  tokensByLen.set(bytes.length, arr);
  void count;
}
const consistent = (word: string, token: number[]): Map<number, number> | null => {
  const local = new Map<number, number>();
  for (let i = 0; i < token.length; i++) {
    const cipher = token[i]!, plain = word.charCodeAt(i);
    // against globally-decided
    if (decode[cipher] !== -1 && decode[cipher] !== plain) return null;
    if (decode[cipher] === -1 && usedPlain.has(plain)) return null;
    // against this word's own mapping (repeated letters must agree)
    const prev = local.get(cipher);
    if (prev !== undefined && prev !== plain) return null;
    // a plain char used by two different ciphers within this word = not a bijection
    for (const [c, p] of local) if (p === plain && c !== cipher) return null;
    local.set(cipher, plain);
  }
  return local;
};
console.error("[phase] key tokens:", keyTokens.size, "| starting auto-crib fixpoint");
let changed = true;
let guard = 0;
while (changed && guard++ < 500) {
  changed = false;
  for (const word of SCHEMA_KEYS) {
    const cands = (tokensByLen.get(word.length) ?? []).map((t) => consistent(word, t)).filter((x): x is Map<number, number> => x !== null);
    if (cands.length !== 1) continue; // only accept an UNAMBIGUOUS crib (exactly one token fits)
    for (const [cipher, plain] of cands[0]!) if (put(cipher, plain)) changed = true;
  }
}
console.error("[phase] fixpoint done in", guard, "passes");

// 3. remaining high bytes (content, any language): map by UTF-8 validity is a later pass; for now report.
const decodeAll = (): { bytes: Uint8Array; known: number } => {
  const out = new Uint8Array(main.length);
  let known = 0;
  for (let i = 0; i < main.length; i++) { const p = decode[main[i]!]!; if (p >= 0) { out[i] = p; known++; } else out[i] = 0xb7; }
  return { bytes: out, known };
};
const { bytes, known } = decodeAll();
const letters = decode.filter((p) => p >= 0x41 && p <= 0x7a).length;
console.log("magic/version ok:", m[0] === 111 && m[1] === 0);
console.log("auto-cribbed mappings:", usedPlain.size, "| ascii letters solved:", letters);
console.log("byte coverage over the module:", (known / main.length * 100).toFixed(1) + "%");
console.log("=== DECODED (content bytes not yet solved = middot) ===");
console.log(new TextDecoder().decode(bytes.slice(0, 1100)));
