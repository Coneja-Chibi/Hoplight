/**
 * Emit docs/FORMAT-SUPPORT.md from the live adapter registry.
 * Run: bun run scripts/format-matrix.ts
 * Check: bun run scripts/format-matrix.ts --check  (fail if committed doc differs)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadFormats, CANONICAL_SCHEMA_VERSION } from "../src/core";

const outPath = join(import.meta.dir, "../docs/FORMAT-SUPPORT.md");
const checkOnly = process.argv.includes("--check");

const found = await loadFormats();

const row = (a: (typeof found)[number]): string =>
  `| \`${a.id}\` | ${a.kind} | .${a.outputExtensions.join(", .")} | ${a.label.replace(/\|/g, "/")} |`;

/** Pure render of the matrix body (date uses a fixed stamp for check stability within a day). */
export function renderFormatMatrix(
  adapters: typeof found,
  schemaVersion: string,
  generatedDate: string,
): string {
  const c = adapters.filter((a) => a.kind === "character");
  const l = adapters.filter((a) => a.kind === "lorebook");
  const p = adapters.filter((a) => a.kind === "persona");
  const r = adapters.filter((a) => a.kind === "regex");
  return `# Format support matrix

Auto-generated from live adapters (\`bun run scripts/format-matrix.ts\`).
Canonical schema version: **${schemaVersion}**.
Generated: ${generatedDate}.

## How to use

\`\`\`bash
bun run vaud formats
bun run vaud inspect path/to/card.png
bun run vaud convert in.png out.json --to sillytavern
bun run vaud validate path/to/card.json
\`\`\`

Default portable character shape for thin hosts (C.AI Tools dumps, Crushon import, etc.):
**SillyTavern / CCv3** (\`sillytavern\` adapter).

## Characters (${c.length})

| id | kind | writes | label |
| --- | --- | --- | --- |
${c.map(row).join("\n")}

## Lorebooks (${l.length})

| id | kind | writes | label |
| --- | --- | --- | --- |
${l.map(row).join("\n")}

## Personas (${p.length})

| id | kind | writes | label |
| --- | --- | --- | --- |
${p.length ? p.map(row).join("\n") : "| (none) | | | |"}

## Regex script sets (${r.length})

| id | kind | writes | label |
| --- | --- | --- | --- |
${r.length ? r.map(row).join("\n") : "| (none) | | | |"}

## Notes

- Detection is content-sniff, not only extension. Prefer \`vaud label\` when unsure.
- Same-format round-trips aim for lossless where fixtures prove it (see adapter tests + samples/).
- Cross-format convert keeps what the target can express; use export honesty in the studio UI for drop notes.
- Dropped/skipped host-native bags (Character.AI, Crushon): use Default CCv3 via \`sillytavern\`.

## Samples

| Folder | Purpose |
| --- | --- |
| \`samples/sillytavern/\` | CCv2/v3 + Seraphina.png |
| \`samples/rolecall/\` | RC character + lorebook |
| \`samples/risu/\` | .charx + card json |
| \`samples/agnai/\` | native Agnai |
| \`samples/backyard/\` | .byaf archives |
| \`samples/pygmalion/\` | classic flat |
| \`samples/lumiverse/\` | ST + Lumi extensions |
| \`samples/chub/\` | ST + extensions.chub |
| \`samples/marinara/\` | native lorebook envelope + prompt preset |
| \`samples/novelai/\` | lorebook |
`;
}

const body = renderFormatMatrix(found, CANONICAL_SCHEMA_VERSION, new Date().toISOString().slice(0, 10));

if (checkOnly) {
  let existing = "";
  try {
    existing = readFileSync(outPath, "utf8");
  } catch {
    console.error(`matrix:check: missing ${outPath}`);
    process.exit(1);
  }
  // Compare without the Generated: date line so same-day drift is content-only...
  // Actually plan wants fail if regen changes file. Compare full body after regenerating date-normalized.
  const normalize = (s: string): string => s.replace(/^Generated: .+$/m, "Generated: <date>");
  if (normalize(existing) !== normalize(body)) {
    console.error("matrix:check: docs/FORMAT-SUPPORT.md is stale. Run `bun run matrix` and commit.");
    process.exit(1);
  }
  console.log("matrix:check: docs/FORMAT-SUPPORT.md is current");
  process.exit(0);
}

writeFileSync(outPath, body, "utf8");
console.log(`wrote ${outPath} (${found.length} adapters)`);
