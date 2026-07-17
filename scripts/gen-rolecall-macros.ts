/**
 * Generate vaud's rolecall macro catalog straight from RC's MacroReferenceDropdown, so it is a real
 * 1-1 and cannot drift or be abridged by hand. RC is a sibling product in the same AGPL family.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "C:/Users/chiev/Documents/VAUDEVILLE/apps/rc/src/components/presets/editor/MacroReferenceDropdown.tsx";
const OUT = "C:/Users/chiev/Documents/vaudeville-studios/src/core/preset/macros/rolecall.ts";

const src = readFileSync(SRC, "utf8");
const start = src.indexOf("const MACRO_GROUPS");
if (start < 0) throw new Error("gen-rolecall: MACRO_GROUPS not found in RC source");
// open AFTER the `=`, or `MacroGroup[]` in the type annotation is mistaken for the array literal
const eq = src.indexOf("=", start);
const open = src.indexOf("[", eq);
if (eq < 0 || open < 0) throw new Error("gen-rolecall: could not locate the MACRO_GROUPS literal");
// walk to the matching close bracket, ignoring brackets inside strings
let depth = 0, end = -1, quote = false;
for (let i = open; i < src.length; i++) {
  const c = src[i];
  if (quote) { if (c === "\\") i++; else if (c === '"') quote = false; continue; }
  if (c === '"') quote = true;
  else if (c === "[") depth++;
  else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
}
if (end < 0) throw new Error("gen-rolecall: unterminated MACRO_GROUPS literal");
const literal = src.slice(open, end + 1);

type Raw = { name: string; icon?: string; description: string; macros: { macro: string; description: string; example?: string }[] };

// The slice must be an inert DATA literal before we evaluate it. Strip string contents, then assert
// nothing executable survives: no calls, no arrows, no template literals, and only the known keys.
const skeleton = literal.replace(/"(?:[^"\\]|\\.)*"/g, '""');
for (const [bad, why] of [
  [/[(){}]\s*=>/, "arrow function"],
  [/\w\s*\(/, "call expression"],
  [/[`;]/, "template literal or statement"],
] as Array<[RegExp, string]>) {
  if (bad.test(skeleton)) throw new Error(`gen-rolecall: refusing to evaluate, found ${why}`);
}
const stray = skeleton.replace(/\b(name|icon|description|macros|macro|example)\b|[[\]{}:,\s"]|\d/g, "");
if (stray.length > 0) throw new Error(`gen-rolecall: refusing to evaluate, unexpected tokens: ${stray.slice(0, 40)}`);

const groups: Raw[] = new Function(`return ${literal};`)();

// Fail LOUD, never write an abridged catalog. The first cut of this script silently emitted an
// empty array (it matched the `[]` in the type annotation) and reported success - the exact
// failure this whole catalog rework exists to prevent.
const total = groups.reduce((n, g) => n + (g.macros?.length ?? 0), 0);
if (groups.length < 10 || total < 150) {
  throw new Error(`gen-rolecall: parsed only ${groups.length} groups / ${total} macros - refusing to write`);
}
for (const g of groups) {
  if (!g.name || !g.description || !Array.isArray(g.macros) || g.macros.length === 0) {
    throw new Error(`gen-rolecall: malformed group ${JSON.stringify(g.name)}`);
  }
  for (const m of g.macros) {
    if (!m.macro?.startsWith("{{") || !m.description) {
      throw new Error(`gen-rolecall: malformed macro ${JSON.stringify(m.macro)} in ${g.name}`);
    }
  }
}

const q = (s: string): string => JSON.stringify(s);
const lines: string[] = [];
lines.push(`/**`);
lines.push(` * RoleCall's macro reference. GENERATED 1-1 from RC's own MacroReferenceDropdown`);
lines.push(` * (apps/rc/src/components/presets/editor/MacroReferenceDropdown.tsx) by`);
lines.push(` * scripts/gen-rolecall-macros.ts - do not hand-edit, regenerate.`);
lines.push(` * hand-transcribing this silently dropped 66 of RC's macros while the header still claimed 1-1;`);
lines.push(` * generating removes the chance to abridge. RC is a sibling product, so its prose carries over.`);
lines.push(` *`);
lines.push(` * This is RC's dialect ONLY. Its separators and meanings are NOT portable: {{roll::NdM}} and`);
lines.push(` * {{random::min::max}} (a real range here) both differ from SillyTavern's and Marinara's forms.`);
lines.push(` * Never reuse this catalog for another lens - see ./sillytavern.ts and ./marinara.ts.`);
lines.push(` */`);
lines.push(`import type { MacroGroup } from "./types";`);
lines.push(``);
lines.push(`export const ROLECALL_MACRO_GROUPS: MacroGroup[] = [`);
for (const g of groups) {
  lines.push(`  {`);
  lines.push(`    name: ${q(g.name)},`);
  lines.push(`    description: ${q(g.description)},`);
  lines.push(`    macros: [`);
  for (const m of g.macros) {
    const ex = m.example === undefined ? "" : `, example: ${q(m.example)}`;
    lines.push(`      { macro: ${q(m.macro)}, description: ${q(m.description)}${ex} },`);
  }
  lines.push(`    ],`);
  lines.push(`  },`);
}
lines.push(`];`);
writeFileSync(OUT, lines.join("\n") + "\n", "utf8");

console.log(`groups: ${groups.length}  macros: ${groups.reduce((n, g) => n + g.macros.length, 0)}`);
for (const g of groups) console.log(`  ${String(g.macros.length).padStart(3)} ${g.name}`);
