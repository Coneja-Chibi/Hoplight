/**
 * Emit docs/FORMAT-SUPPORT.md from the live adapter registry.
 * Run: bun run scripts/format-matrix.ts
 * Check: bun run scripts/format-matrix.ts --check  (fail if committed doc differs)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadFormats, CANONICAL_SCHEMA_VERSION } from "../src/core";

const outPath = join(import.meta.dir, "../docs/FORMAT-SUPPORT.md");
const checkOnly = process.argv.includes("--check");

const found = await loadFormats();

const row = (a: (typeof found)[number]): string =>
  `| \`${a.id}\` | ${a.kind} | .${a.outputExtensions.join(", .")} | ${a.label.replace(/\|/g, "/")} |`;

/** Display names for known kinds; an unlisted kind still renders (Title-cased) - open by design. */
const KIND_TITLES: Record<string, string> = {
  character: "Characters",
  lorebook: "Lorebooks",
  persona: "Personas",
  preset: "Presets",
  regex: "Regex script sets",
  pack: "Sprite packs",
};
const KIND_ORDER = ["character", "lorebook", "persona", "preset", "regex", "pack"];

/**
 * Every kind this matrix must SHOW = every kind the studio models (src/entities/<kind>/,
 * folders-as-schema) UNION every kind any adapter declares. A kind with zero adapters renders an
 * honest "(none yet)" section - the old hand-partition silently hid the preset kind for weeks.
 */
export function matrixKinds(entityKinds: string[], adapters: { kind: string }[]): string[] {
  const all = new Set([...entityKinds, ...adapters.map((a) => a.kind)]);
  const known = KIND_ORDER.filter((k) => all.has(k));
  const unknown = [...all].filter((k) => !KIND_ORDER.includes(k)).sort();
  return [...known, ...unknown];
}

/** Pure render of the matrix body (date uses a fixed stamp for check stability within a day). */
export function renderFormatMatrix(
  adapters: typeof found,
  schemaVersion: string,
  generatedDate: string,
  entityKinds: string[],
): string {
  const section = (kind: string): string => {
    const rows = adapters.filter((a) => a.kind === kind);
    const title = KIND_TITLES[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1) + "s";
    const body =
      rows.length > 0
        ? rows.map(row).join("\n")
        : `| (none yet) | ${kind} | | The studio edits this kind, but no import/export format exists yet. |`;
    return `## ${title} (${rows.length})\n\n| id | kind | writes | label |\n| --- | --- | --- | --- |\n${body}`;
  };
  const sections = matrixKinds(entityKinds, adapters).map(section).join("\n\n");
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

${sections}

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

const entityKinds = readdirSync(join(import.meta.dir, "../src/entities"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const body = renderFormatMatrix(found, CANONICAL_SCHEMA_VERSION, new Date().toISOString().slice(0, 10), entityKinds);

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
