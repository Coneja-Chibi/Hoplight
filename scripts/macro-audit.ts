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
 * So this reports the three differences that matter and changes nothing:
 *
 *   MISSING     - the engine has it, we do not. Reported as literal text, so a person can see it
 *                 will reach the model unexpanded rather than being told a name.
 *   UNKNOWN     - we have it, the engine does not. Either stale, or provided by an extension rather
 *                 than core; the audit cannot tell those apart and does not pretend to.
 *   SEPARATORS  - we and the engine spell the same macro differently. This is the one that bites
 *                 silently: ops.ts reads arity and separator off the FORM string, so a catalog
 *                 saying {{roll:1d6}} where the engine says {{roll::1d20}} computes translation
 *                 against a macro shape that does not exist.
 *
 * Run: bun run scripts/macro-audit.ts --st-root=<a SillyTavern checkout>
 */
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

const ours: MacroEntry[] = SILLYTAVERN_MACRO_GROUPS.flatMap((g) => g.macros);
const ourNames = new Set(ours.map((m) => macroName(m.macro)).filter(Boolean));

const missing = [...engineNames.keys()].filter((n) => !ourNames.has(n)).sort();
const unknown = ours.filter((m) => {
  const n = macroName(m.macro);
  return n !== "" && !engineNames.has(n);
});

/** Where our recorded form and the engine's own example disagree about punctuation. */
const separators: string[] = [];
for (const entry of ours) {
  const name = macroName(entry.macro);
  const engine = name ? engineNames.get(name) : undefined;
  const theirs = engine?.exampleUsage[0];
  if (!theirs) continue;
  if (separatorOf(entry.macro) !== separatorOf(theirs)) {
    separators.push(`${entry.macro}   engine spells it   ${theirs}`);
  }
}

const line = (s: string): void => console.log(s);
line(`macro-audit: sillytavern ${reply.engine.version}`);
line(`  engine spellings: ${engineNames.size}   our entries: ${ours.length}`);
line("");
line(`MISSING - the engine has these, our catalog does not (${missing.length}):`);
for (const n of missing) line(`  {{${n}}}`);
line("");
line(`UNKNOWN - our catalog has these, this engine build does not (${unknown.length}):`);
for (const m of unknown) line(`  ${m.macro}${m.op ? `   [op: ${m.op}]` : ""}`);
line("");
line(`SEPARATORS - same macro, different spelling (${separators.length}):`);
for (const s of separators) line(`  ${s}`);
line("");
line("Nothing was changed. Each row is a judgement: a missing macro may be worth adding, an unknown");
line("one may be extension-provided rather than stale, and a separator difference must be checked");
line("against the engine before editing, because ops.ts computes arity from the form string.");

// A findings report, not a gate: exit 0 so this can be run for information without failing a build.
