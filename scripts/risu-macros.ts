/**
 * Generate src/core/preset/macros/risu.ts from RisuAI's own CBS documentation.
 *
 * WHY A GENERATOR AND NOT A HAND-WRITTEN CATALOG. macros/index.ts is explicit that Risu's catalog
 * must be generated and never hand-copied, and it is right: cbs_docs.cbs is 170 machine-readable
 * rows maintained by the engine's own authors, and a hand transcription of that is 170 chances to
 * invent a macro. Every other catalog here was transcribed by hand from prose sources because those
 * engines publish no machine-readable list; Risu does, so it gets read rather than retyped.
 *
 * WHY THE OUTPUT IS COMMITTED. Hoplight ships the macro reference to people who have no RisuAI
 * checkout - that is the whole point of a library. So this runs once, by somebody who has the
 * source, and its output is a normal file in the repo. The script stays so the next person can
 * regenerate against a newer RisuAI and diff it.
 *
 * Run: bun run scripts/risu-macros.ts --risu-root=<path to a RisuAI checkout>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DOC_PATH = join("src", "etc", "docs", "cbs_docs.cbs");
const OUT_PATH = join("src", "core", "preset", "macros", "risu.ts");
/** The five columns this script knows how to read. A sixth, or a rename, must stop the run. */
const EXPECTED_HEADER = ["name", "description", "aliases", "arguments", "example"];

const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const fail = (msg: string): never => {
  console.error(`risu-macros: ${msg}`);
  process.exit(1);
};

const root = resolve(arg("risu-root") ?? process.env["HOPLIGHT_RISU_ROOT"] ?? "");
if (!root || !existsSync(join(root, DOC_PATH))) {
  fail(`no RisuAI checkout at "${root}": ${DOC_PATH} is missing. Pass --risu-root=<path>.`);
}

/** The commit the catalog was read out of, so a stale catalog can be spotted rather than guessed. */
function sourceCommit(): string {
  const head = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root });
  const sha = new TextDecoder().decode(head.stdout).trim();
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : "unknown";
}

/**
 * Split the whole block into records, honouring quotes ACROSS NEWLINES.
 *
 * NOT LINE BY LINE, and the difference is 21 macros. Several descriptions are quoted fields
 * containing real newlines - `filter` and `metadata` each document their options as an indented list
 * inside the description cell - so a reader that splits on newline first tears those records in half
 * and then discards both halves as malformed. The first version of this script did exactly that and
 * silently shipped a catalog missing 13% of Risu's macros, which is the shape of failure a macro
 * reference can least afford: absence reads as "that engine cannot do this".
 *
 * Commas inside quotes are likewise not separators. Everything here is ordinary CSV; the point is
 * that it must be parsed as CSV rather than as lines.
 */
function readRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  // NOT trimmed here: an unquoted description fragment carries the space after its comma, and the
  // rejoin in readRow needs it to put the sentence back together. Trimming happens per column there.
  const endField = (): void => { record.push(field); field = ""; };
  const endRecord = (): void => {
    endField();
    if (record.some((f) => f.length > 0)) records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; continue; }
      if (ch === '"') { quoted = false; continue; }
      field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { endField(); continue; }
    if (ch === "\n") { endRecord(); continue; }
    if (ch === "\r") continue;
    field += ch;
  }
  endRecord();
  return records;
}

const raw = readFileSync(join(root, DOC_PATH), "utf8");

/**
 * The file is prose with one fenced csv block in it; only the block is data.
 *
 * THE FENCE IS NEVER CLOSED. cbs_docs.cbs opens ```csv and simply ends, so a regex demanding the
 * closing fence matches nothing and this script would report "the format changed" about a file that
 * is exactly as its authors wrote it. Read to the closing fence if one appears, to EOF otherwise.
 */
const opened = /```csv\r?\n/.exec(raw);
if (!opened) {
  fail(`${DOC_PATH} carries no \`\`\`csv block. The format changed; read it before trusting this.`);
}
const afterFence = raw.slice(opened!.index + opened![0].length);
const closing = afterFence.indexOf("```");
const block = closing === -1 ? afterFence : afterFence.slice(0, closing);
// Newlines inside quoted descriptions are real content and are kept; the carriage return is not,
// and one baked into a catalog string is a stray character on screen for every reader.
const records = readRecords(block.replace(/\r\n/g, "\n"));

const header = (records[0] ?? []).map((h) => h.trim());
if (header.join(",") !== EXPECTED_HEADER.join(",")) {
  // Loudly, because a partial catalog that emits successfully is worse than a script that stops.
  fail(`unexpected columns: got [${header.join(", ")}], expected [${EXPECTED_HEADER.join(", ")}]`);
}

interface Row {
  name: string;
  description: string;
  aliases: string[];
  args: string[];
}

/**
 * SOME DESCRIPTIONS ARE UNQUOTED AND CONTAIN COMMAS, which is not valid CSV and is what the source
 * actually contains: `slot,returns the current element being iterated over, identified by named
 * first argument,"slot","name",...`. A correct CSV parse of that yields SIX fields and shifts every
 * later column left, so the alias list becomes half a sentence and the argument list becomes the
 * word "slot" - which is exactly the wrong-by-one-column failure that produced `{{slot::slot}}` on
 * the first run of this script.
 *
 * The last three columns are always quoted, so they are read from the END and everything between the
 * name and them is the description, rejoined. Fewer than five fields is a row this script does not
 * understand and is reported rather than guessed at.
 */
function readRow(f: string[]): Row | null {
  if (f.length < 5) return null;
  const name = (f[0] ?? "").trim();
  const aliases = (f[f.length - 3] ?? "").trim();
  const args = (f[f.length - 2] ?? "").trim();
  const description = f.slice(1, f.length - 3).join(",").trim();
  if (!name || !description) return null;
  return {
    name,
    description,
    // `/`-separated, and the list normally repeats the macro's own name. Deduped, and the name
    // itself dropped: MacroEntry.aliases means "as well as", not "including".
    aliases: aliases.split("/").map((a) => a.trim()).filter((a) => a && a !== name),
    args: args.split("/").map((a) => a.trim()).filter(Boolean),
  };
}

const rows: Row[] = [];
const unreadable: string[] = [];
for (const record of records.slice(1)) {
  const row = readRow(record);
  if (row) rows.push(row);
  else unreadable.push(record.join(",").slice(0, 60));
}
if (rows.length === 0) fail("the csv block parsed to zero macros");
if (unreadable.length > 0) {
  // Named, because a row silently skipped is a macro this catalog claims the engine does not have.
  console.warn(`risu-macros: ${unreadable.length} unreadable row(s): ${unreadable.join(" | ")}`);
}

/**
 * The form this engine parses, built from the documented arguments.
 *
 * `::` IS THE SEPARATOR AND `{{}}` IS THE DELIMITER, both read from the engine rather than assumed.
 * Every argument-taking example in cbs_docs.cbs spells them `::`, and parser.svelte.ts dispatches on
 * `{` followed by `{` or `#`. The doc file writes its examples as [[name]] purely so the docs are not
 * themselves parsed as macros; nothing in the parser treats [[ as a delimiter.
 *
 * A trailing "..." in the arguments column means variadic, which ops.ts reads off the form string.
 */
const formOf = (row: Row): string =>
  row.args.length === 0 ? `{{${row.name}}}` : `{{${row.name}::${row.args.join("::")}}}`;

const q = (s: string): string => JSON.stringify(s);

/**
 * One entry per FORM, keeping the first description.
 *
 * The source really does document one name twice: `slot` appears with two descriptions, for its
 * argument form and its bare form, while declaring the same argument for both - so both rows
 * generate the identical token. Emitting the duplicate would give findMacro two answers to the same
 * question and hand React two children with one key. Reported rather than swallowed, because a
 * duplicate appearing where there was none before is a change in the source worth seeing.
 */
const byForm = new Map<string, Row>();
const dropped: string[] = [];
for (const row of rows) {
  const form = formOf(row);
  if (byForm.has(form)) { dropped.push(form); continue; }
  byForm.set(form, row);
}
if (dropped.length > 0) {
  console.warn(`risu-macros: ${dropped.length} duplicate form(s) kept once: ${dropped.join(", ")}`);
}

const entries = [...byForm.values()]
  .map((row) => {
    const parts = [`macro: ${q(formOf(row))}`, `description: ${q(row.description)}`];
    if (row.aliases.length > 0) parts.push(`aliases: [${row.aliases.map(q).join(", ")}]`);
    return `      { ${parts.join(", ")} },`;
  })
  .join("\n");

const file = `/**
 * RisuAI's macro catalog (CBS), GENERATED from that engine's own documentation.
 *
 * DO NOT EDIT BY HAND. Regenerate with:
 *   bun run scripts/risu-macros.ts --risu-root=<a RisuAI checkout>
 *
 * Source: ${DOC_PATH.split("\\").join("/")} at RisuAI ${sourceCommit()}
 * Read ${byForm.size} macros (from ${rows.length} documented rows).
 *
 * WHY THIS ONE IS GENERATED AND THE OTHERS ARE NOT. RisuAI publishes a machine-readable CSV of its
 * own macros; SillyTavern, RoleCall, Marinara and Lumiverse do not, so those catalogs were read out
 * of prose and source by hand. Where a list exists, retyping it is 170 chances to invent a macro.
 *
 * TWO HONEST LIMITS, both consequences of what the source carries.
 *
 * NO GROUPS. The CSV has no categories, so everything is one group rather than a hand-invented
 * taxonomy - grouping 170 entries by eye would be organisation this file cannot support, and the
 * reference is searchable instead.
 *
 * NO OPERATION ANNOTATIONS. MacroEntry.op is what lets the hub compute cross-engine equivalence and
 * collisions, and nothing in the CSV maps to one; they have to be added by reading the parser, per
 * entry, where a name would otherwise lie. Until they exist Risu is a REFERENCE here and not a
 * translation target - see macroGroupsForDialect. The known worklist is the set of names Risu shares
 * with Lumiverse while meaning something else.
 */
import type { MacroGroup } from "./types";

export const RISU_MACRO_GROUPS: MacroGroup[] = [
  {
    name: "All CBS macros",
    description:
      "Every macro RisuAI documents, as its own CBS reference lists them. Risu writes examples as "
      + "[[name]] so its documentation is not itself parsed; the engine reads {{name}}.",
    macros: [
${entries}
    ],
  },
];
`;

writeFileSync(OUT_PATH, file, "utf8");
console.log(`risu-macros: wrote ${OUT_PATH} (${byForm.size} macros from RisuAI ${sourceCommit()})`);
