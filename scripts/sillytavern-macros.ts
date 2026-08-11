/**
 * Generate src/core/preset/macros/sillytavern-new.ts from SillyTavern's registry engine.
 *
 * BOTH SURFACES, NOT ONE. SillyTavern carries two macro engines and
 * power_user.experimental_macro_engine - default true since 1.17.0 - picks between them. Rather than
 * migrate the catalog and lose the older one, this writes a SECOND catalog: sillytavern.ts keeps
 * describing the regex table, this describes the registry, and MacroDialect offers both.
 *
 * THE COMPATIBILITY IS ONE-WAY, and the direction matters. The registry engine accepts the legacy
 * spellings as well as its own: {{roll:1d6}} and {{roll::1d6}} both resolve on 1.18.0, verified
 * through the renderer. The reverse is NOT true - the legacy pattern /{{roll[ : ]([^}]+)}}/ matches
 * {{roll::1d20}} but captures ":1d20", droll rejects it, and the macro resolves to the empty string.
 * A registry spelling on the old engine rolls no dice and says nothing about it. So this is not a
 * free choice of spelling, and neither catalog should ever imply it is.
 *
 * What the second catalog buys is the macros that exist ONLY in the registry: the indexed-variable
 * family, the instruct family, {{chardescription}}.
 *
 * A MERGE, NEVER A REPLACEMENT, and there are two separate reasons - both of which cost real macros
 * if ignored.
 *
 *  1. THE DUMP CANNOT SEE EVERY MACRO. dump.mjs loads the macro folder and stubs everything outside
 *     it, so macros registered by other modules are invisible: {{authorsNote}} comes from
 *     authors-note.js, {{summary}} from extensions/memory, {{charPrefix}} from
 *     extensions/stable-diffusion. Those are verified registrations. The preserved set also carries
 *     entries this script CANNOT verify either way - {{pipe}} and {{var::name}} are substituted
 *     inside STscript closures rather than registered, {{bias}} is read off message text - and it
 *     does not claim they are registry macros. They are kept because dropping a macro somebody can
 *     type is the worse error, and marked in the generated file as unverified.
 *  2. THE `op` ANNOTATIONS ARE HAND-AUTHORED and are the only thing here that generation cannot
 *     reproduce. They drive every cross-engine answer, and losing one silently turns a detected
 *     collision back into a clean pass. Any annotation this script cannot place is a hard failure.
 *
 * Run: bun run scripts/sillytavern-macros.ts --st-root=<a SillyTavern checkout>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SILLYTAVERN_MACRO_GROUPS } from "../src/core/preset/macros/sillytavern";
import { macroName } from "../src/core/preset/macros/support";
import type { MacroEntry } from "../src/core/preset/macros/types";

const OUT_PATH = "src/core/preset/macros/sillytavern-new.ts";

const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const fail = (msg: string): never => {
  console.error(`sillytavern-macros: ${msg}`);
  process.exit(1);
};

const stRoot = arg("st-root") ?? process.env["HOPLIGHT_ST_ROOT"] ?? "";
if (!stRoot) fail("pass --st-root=<a SillyTavern checkout>");

interface DumpedMacro {
  name: string;
  description: string;
  category: string;
  aliases: string[];
  minArgs: number;
  maxArgs: number;
  args: { name: string; optional: boolean; sample: string }[];
  exampleUsage: string[];
}

const dumped = Bun.spawnSync(
  ["node", "tools/renderers/sillytavern/dump.mjs", `--st-root=${stRoot}`],
  { stdout: "pipe", stderr: "pipe" },
);
if (dumped.exitCode !== 0) {
  fail(`the dumper failed: ${new TextDecoder().decode(dumped.stderr).trim()}`);
}
const reply = JSON.parse(new TextDecoder().decode(dumped.stdout)) as {
  engine: { name: string; version: string };
  macros: DumpedMacro[];
};
if (reply.macros.length === 0) fail("the registry answered with no macros");

/**
 * The engine's own spelling, preferred over anything rebuilt from argument names.
 *
 * exampleUsage is the registry stating its own form, separators included, which is exactly where a
 * name-level catalog goes wrong. Only 33 of 93 carry one, so the rest are built from the declared
 * arguments - and an optional-argument macro is emitted in its BARE form, because that is the shape
 * somebody types and the one ops.ts should read an arity of zero from.
 */
function formOf(m: DumpedMacro): string {
  const stated = m.exampleUsage.find((e) => e.startsWith(`{{${m.name}`));
  if (stated && !stated.includes("}}", stated.indexOf("}}") + 2)) return stated;
  const required = m.args.filter((a) => !a.optional);
  if (required.length === 0) return `{{${m.name}}}`;
  return `{{${m.name}::${required.map((a) => a.name).join("::")}}}`;
}

/**
 * ST's own category names, mapped onto the group vocabulary this repo already draws icons for.
 * A category with no house equivalent keeps its own name rather than being forced into one.
 */
const GROUP_OF: Record<string, string> = {
  names: "Identity",
  character: "Character Card",
  chat: "Chat Context",
  time: "Time & Date",
  variable: "Variables",
  random: "Random & Dice",
  utility: "Text Processing",
  state: "Runtime & Stats",
  prompts: "Runtime & Stats",
};
const groupName = (category: string): string =>
  GROUP_OF[category] ?? (category ? `${category[0]!.toUpperCase()}${category.slice(1)}` : "Other");

/**
 * Every op we already know, keyed by the macro NAME it was attached to.
 *
 * KEYING BY NAME COLLAPSES FORMS, and that is safe here only because it was checked. ops.ts is
 * explicit that annotations are per ENTRY and not per name, precisely so one name can carry
 * different operations at different argument counts - RoleCall documents {{random::min::max}} as a
 * range and {{random::a::b::c}} as a pick. SillyTavern's two {{random}} forms happen to share
 * random.pick, so collapsing loses nothing; a catalog where they differ must not use this generator
 * unchanged, so the disagreement is fatal rather than last-write-wins.
 */
const knownOps = new Map<string, { op: string; macro: string }>();
const opConflicts: string[] = [];
/**
 * An annotation on a form that invokes no NAME cannot be carried by a name-keyed merge, and it must
 * not be skipped quietly.
 *
 * THIS WAS A HOLE IN THE GATE BELOW. `if (!name) continue` ran BEFORE knownOps was built, so such an
 * entry never entered the map and `unplaced` could never report it: the script printed "14/14 ops
 * carried" and exited zero while dropping one. Not contrived - comment and flag syntax genuinely
 * differ between engines ({{//}}, {{#}}, Lumiverse's prefix flags), so an op on a nameless form is a
 * plausible annotation to write.
 */
const opsWithoutName: string[] = [];
for (const group of SILLYTAVERN_MACRO_GROUPS) {
  for (const entry of group.macros) {
    if (!entry.op) continue;
    const name = macroName(entry.macro);
    if (!name) {
      opsWithoutName.push(`  ${entry.macro} [op: ${entry.op}] invokes no macro name`);
      continue;
    }
    const seen = knownOps.get(name);
    if (seen && seen.op !== entry.op) {
      opConflicts.push(`  ${seen.macro} [${seen.op}] vs ${entry.macro} [${entry.op}]`);
      continue;
    }
    knownOps.set(name, { op: entry.op, macro: entry.macro });
  }
}
if (opConflicts.length > 0) {
  fail(
    "two entries share a name and carry different operations, which keying by name cannot "
    + `represent:\n${opConflicts.join("\n")}`,
  );
}
if (opsWithoutName.length > 0) {
  fail(
    "these operations are annotated on forms that invoke no macro name, so a name-keyed merge "
    + `cannot carry them and would drop them silently:\n${opsWithoutName.join("\n")}`,
  );
}

const registryNames = new Set<string>();
for (const m of reply.macros) {
  registryNames.add(m.name.toLowerCase());
  for (const a of m.aliases) registryNames.add(a.toLowerCase());
}

/** Names the OLD regex table carries, scraped, and used only to tell two absences apart. */
const legacyNames = new Set<string>();
try {
  const src = readFileSync(join(stRoot, "public", "scripts", "macros.js"), "utf8");
  for (const m of src.matchAll(/\{\{\\?\/?([A-Za-z_][A-Za-z0-9_]*)/g)) {
    legacyNames.add(m[1]!.toLowerCase());
  }
} catch { /* an install without the legacy file simply has one surface */ }

/**
 * Entries the registry does not carry but the new engine still has.
 *
 * TWO KINDS OF ABSENCE, and only one belongs in a new-engine catalog. A macro missing from the dump
 * because it is registered outside the macro folder - {{authorsNote}}, {{summary}}, {{charPrefix}} -
 * is present on this engine and must be carried. A macro missing because it only ever existed in the
 * old regex table - {{time_UTC±#}} - is not, and carrying it would put a legacy-only macro in a file
 * whose whole claim is that it describes the registry.
 *
 * The old catalog keeps documenting the second kind, which is the point of having both.
 */
const preserved: { group: string; entry: MacroEntry }[] = [];
const legacyOnly: string[] = [];
for (const group of SILLYTAVERN_MACRO_GROUPS) {
  for (const entry of group.macros) {
    const name = macroName(entry.macro);
    if (!name || registryNames.has(name)) continue;
    if (legacyNames.has(name)) { legacyOnly.push(entry.macro); continue; }
    preserved.push({ group: group.name, entry });
  }
}

// ---- build ---------------------------------------------------------------------------------------

const placed = new Set<string>();
const byGroup = new Map<string, string[]>();
const push = (group: string, line: string): void => {
  const list = byGroup.get(group) ?? [];
  list.push(line);
  byGroup.set(group, list);
};
const q = (s: string): string => JSON.stringify(s);

for (const m of reply.macros) {
  const parts = [`macro: ${q(formOf(m))}`, `description: ${q(m.description)}`];
  if (m.aliases.length > 0) parts.push(`aliases: [${m.aliases.map(q).join(", ")}]`);
  const known = knownOps.get(m.name.toLowerCase());
  if (known) {
    parts.push(`op: ${q(known.op)}`);
    placed.add(m.name.toLowerCase());
  }
  push(groupName(m.category), `      { ${parts.join(", ")} },`);
}

for (const { group, entry } of preserved) {
  const parts = [`macro: ${q(entry.macro)}`, `description: ${q(entry.description)}`];
  if (entry.example) parts.push(`example: ${q(entry.example)}`);
  if (entry.aliases?.length) parts.push(`aliases: [${entry.aliases.map(q).join(", ")}]`);
  if (entry.op) {
    parts.push(`op: ${q(entry.op)}`);
    placed.add(macroName(entry.macro));
  }
  push(group, `      { ${parts.join(", ")} },`);
}

/**
 * THE GATE. An annotation that found no home is a cross-engine answer silently switching off, and
 * the symptom - a collision quietly becoming a clean pass - is invisible until somebody's prompt
 * breaks on another platform. Named and fatal, never warned.
 */
const unplaced = [...knownOps.entries()].filter(([name]) => !placed.has(name));
if (unplaced.length > 0) {
  fail(
    `${unplaced.length} op annotation(s) could not be placed, so the rebuild would lose them:\n`
    + unplaced.map(([n, v]) => `  ${v.macro} [op: ${v.op}] - no macro named "${n}" in the result`).join("\n"),
  );
}

const groups = [...byGroup.entries()]
  .map(([name, lines]) => `  {
    name: ${q(name)},
    description: ${q(`SillyTavern's ${name.toLowerCase()} macros.`)},
    macros: [
${lines.join("\n")}
    ],
  },`)
  .join("\n");

const file = `/**
 * SillyTavern's macro catalog, read from that engine's own registry.
 *
 * DO NOT EDIT THE ENTRIES BY HAND. Regenerate with:
 *   bun run scripts/sillytavern-macros.ts --st-root=<a SillyTavern checkout>
 *
 * Source: the MacroRegistry of SillyTavern ${reply.engine.version}, ${reply.macros.length} macros,
 * plus ${preserved.length} preserved below.
 *
 * THE NEW ENGINE, DELIBERATELY. SillyTavern carries two macro surfaces and
 * power_user.experimental_macro_engine - default true since 1.17.0 - picks between them. This catalog
 * documents the REGISTRY, which is what a default install runs. The older regex table in
 * public/scripts/macros.js spells several macros differently and more permissively
 * ({{roll:1d6}} and {{roll::1d20}} are both parsed by it), so text written for the old engine is
 * not wrong - it is simply not what this file describes. scripts/macro-audit.ts reports the
 * difference between the two.
 *
 * PRESERVED ENTRIES ARE NOT AN OVERSIGHT. Macros registered outside the macro folder are invisible
 * to the dumper, which stubs everything it does not stage: {{authorsNote}} comes from
 * authors-note.js, {{summary}} from extensions/memory, {{charPrefix}} from
 * extensions/stable-diffusion. They are real, so the generator carries them through untouched
 * rather than deleting what it cannot see.
 *
 * The \`op\` annotations are hand-authored, carried across by macro name, and the generator refuses
 * to write this file if any of them cannot be placed.
 */
import type { MacroGroup } from "./types";

export const SILLYTAVERN_NEW_MACRO_GROUPS: MacroGroup[] = [
${groups}
];
`;

writeFileSync(OUT_PATH, file, "utf8");
console.log(
  `sillytavern-macros: wrote ${OUT_PATH} - ${reply.macros.length} from the registry of `
  + `${reply.engine.version}, ${preserved.length} module-registered preserved, `
  + `${legacyOnly.length} legacy-only left to sillytavern.ts, ${placed.size}/${knownOps.size} ops carried`,
);
