/**
 * Compare a hand-written macro catalog against what the engine itself says it has.
 *
 * WHY AN AUDIT AND NOT A GENERATOR. Risu's catalog could be generated outright because RisuAI
 * publishes a machine-readable list and Hoplight had nothing to lose. These four are different: they
 * were transcribed by hand, they carry 56 hand-authored `op` annotations that drive every
 * cross-engine answer, and some entries record forms the registry does not (SillyTavern's registry
 * lists one spelling of `{{random}}`; the catalog records the comma form as well, and both are real).
 * Replacing them wholesale would silently drop working knowledge to gain generated knowledge, which
 * is a trade nobody asked for.
 *
 * AND SILLYTAVERN HAS TWO MACRO SURFACES, which is the thing to get right before reading any of
 * this. `power_user.experimental_macro_engine` - default true since 1.17.0 - chooses between the
 * registry the dumper reads and the older regex table in public/scripts/macros.js. An earlier
 * version of this script knew only the registry and reported `{{roll:1d6}}` as a defect; the legacy
 * pattern is `/{{roll[ : ]([^}]+)}}/`, so that form is one SillyTavern parses and our catalog was
 * right. Five of six "separator defects" evaporated when the second surface was read. Every bucket
 * below therefore names which engine it is talking about.
 *
 * Five buckets, and only one of them is unambiguously ours to fix:
 *
 *   MISSING         - in the registry, not in our catalog. Marked [new engine only] where the
 *                     legacy table has no such name.
 *   LEGACY ONLY     - in our catalog and in macros.js. Correct, for the older engine.
 *   UNKNOWN         - in our catalog and in NEITHER surface. Stale, or provided by an extension;
 *                     the audit cannot tell those apart and does not pretend to.
 *   BOTH SURFACES   - the two engines spell it differently and ours is the legacy spelling. A
 *                     choice about which engine the catalog describes, not an error.
 *   SPELLING DEFECT - the registry disagrees and legacy does not carry the name either. This one
 *                     bites silently, because ops.ts reads arity and separator off the FORM string.
 *
 * Run: bun run scripts/macro-audit.ts --st-root=<a SillyTavern checkout>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SILLYTAVERN_MACRO_GROUPS } from "../src/core/preset/macros/sillytavern";
import { macroName } from "../src/core/preset/macros/support";
import { separatorOf } from "../src/core/preset/macros/ops";
import type { MacroEntry } from "../src/core/preset/macros/types";

const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const stRoot = arg("st-root") ?? process.env["HOPLIGHT_ST_ROOT"] ?? "";
if (!stRoot) {
  console.error("macro-audit: pass --st-root=<a SillyTavern checkout>");
  process.exit(1);
}

interface DumpedMacro {
  name: string;
  description: string;
  category: string;
  aliases: string[];
  exampleUsage: string[];
}

/** Ask the engine, through the same staging the renderer uses. */
const dumped = Bun.spawnSync(
  ["node", "tools/renderers/sillytavern/dump.mjs", `--st-root=${stRoot}`],
  { stdout: "pipe", stderr: "pipe" },
);
if (dumped.exitCode !== 0) {
  console.error(`macro-audit: the dumper failed: ${new TextDecoder().decode(dumped.stderr).trim()}`);
  process.exit(1);
}
const reply = JSON.parse(new TextDecoder().decode(dumped.stdout)) as {
  engine: { name: string; version: string };
  macros: DumpedMacro[];
};

/** Every spelling the engine answers to, aliases included, lowercased like macroName returns. */
const engineNames = new Map<string, DumpedMacro>();
for (const m of reply.macros) {
  engineNames.set(m.name.toLowerCase(), m);
  for (const alias of m.aliases) engineNames.set(alias.toLowerCase(), m);
}

/**
 * SILLYTAVERN HAS TWO MACRO SURFACES, and reading only one of them produces confident nonsense.
 *
 * `power_user.experimental_macro_engine` (default true since 1.17.0) chooses between the registry the
 * dumper reads and the older regex table in public/scripts/macros.js. They are not the same list and
 * they do not spell everything the same way. The legacy patterns are deliberately permissive:
 *
 *     /{{roll[ : ]([^}]+)}}/      space OR colon
 *     /{{random\s?::?([^}]+)}}/   one colon OR two
 *     /{{banned "(.*)"}}/         a quoted argument
 *     /{{datetimeformat +...}}/   a space
 *
 * while the registry canonicalises on `::`. An audit that knows only the registry therefore reports
 * `{{roll:1d6}}` as a defect, when it is a form SillyTavern still parses - which is precisely the
 * false finding this comment exists to stop the next person repeating.
 *
 * Scraped, and only ever used to CLASSIFY. There is no registry to ask for the legacy surface, so
 * this reads its patterns out of the source; that is acceptable for deciding which of three buckets
 * a name belongs in, and would not be acceptable for generating a catalog.
 */
function legacyNames(root: string): Set<string> {
  const names = new Set<string>();
  let src = "";
  try {
    src = readFileSync(join(root, "public", "scripts", "macros.js"), "utf8");
  } catch {
    return names; // an install without the legacy file simply has one surface
  }
  for (const m of src.matchAll(/\{\{\\?\/?([A-Za-z_][A-Za-z0-9_]*)/g)) {
    names.add(m[1]!.toLowerCase());
  }
  return names;
}

const legacy = legacyNames(stRoot);

const ours: MacroEntry[] = SILLYTAVERN_MACRO_GROUPS.flatMap((g) => g.macros);
const ourNames = new Set(ours.map((m) => macroName(m.macro)).filter(Boolean));

const missing = [...engineNames.keys()].filter((n) => !ourNames.has(n)).sort();

/** In our catalog and in NEITHER surface: the only bucket that is a candidate for stale. */
const unknown = ours.filter((m) => {
  const n = macroName(m.macro);
  return n !== "" && !engineNames.has(n) && !legacy.has(n);
});

/** In our catalog and in the legacy table but not the registry: correct, and only for the old engine. */
const legacyOnly = ours.filter((m) => {
  const n = macroName(m.macro);
  return n !== "" && !engineNames.has(n) && legacy.has(n);
});

/**
 * Where our recorded form and the registry's own example disagree about punctuation.
 *
 * A DIFFERENCE, NOT A DEFECT, when the legacy table also carries the name - and it usually does.
 * The legacy patterns accept spellings the registry does not, so our form can be perfectly valid on
 * one engine and simply not canonical on the other. Split accordingly.
 */
const separators: string[] = [];
const bothSurfaces: string[] = [];
for (const entry of ours) {
  const name = macroName(entry.macro);
  const engine = name ? engineNames.get(name) : undefined;
  const theirs = engine?.exampleUsage[0];
  if (!theirs || !name) continue;
  if (separatorOf(entry.macro) === separatorOf(theirs)) continue;
  const row = `${entry.macro}   registry spells it   ${theirs}`;
  if (legacy.has(name)) bothSurfaces.push(row);
  else separators.push(row);
}

const line = (s: string): void => console.log(s);
line(`macro-audit: sillytavern ${reply.engine.version}`);
line(`  registry spellings: ${engineNames.size}   legacy names: ${legacy.size}   our entries: ${ours.length}`);
line("");
line("SillyTavern has TWO macro surfaces and power_user.experimental_macro_engine (default true");
line("since 1.17.0) picks between them. Every row below says which surface it is about.");
line("");
line(`MISSING - in the registry, not in our catalog (${missing.length}):`);
for (const n of missing) line(`  {{${n}}}${legacy.has(n) ? "" : "   [new engine only]"}`);
line("");
line(`LEGACY ONLY - in our catalog and in macros.js, not in the registry (${legacyOnly.length}):`);
for (const m of legacyOnly) line(`  ${m.macro}${m.op ? `   [op: ${m.op}]` : ""}`);
line("");
line(`UNKNOWN - in our catalog and in NEITHER surface (${unknown.length}):`);
for (const m of unknown) line(`  ${m.macro}${m.op ? `   [op: ${m.op}]` : ""}`);
line("");
line(`BOTH SURFACES, DIFFERENT SPELLING - ours is legacy-valid, not registry-canonical (${bothSurfaces.length}):`);
for (const s of bothSurfaces) line(`  ${s}`);
line("");
line(`SPELLING DEFECTS - registry disagrees and legacy does not carry the name (${separators.length}):`);
for (const s of separators) line(`  ${s}`);
line("");
line("Nothing was changed. Only the last bucket is unambiguously ours to fix; the one above it is a");
line("choice about which engine the catalog describes, and UNKNOWN needs each row checked against");
line("extensions before anything is removed.");

// A findings report, not a gate: exit 0 so this can be run for information without failing a build.
