/**
 * Every app a person can open has a section in the UI reference.
 *
 * WHY THIS GATE EXISTS. Two apps shipped with no documentation at all and every docs gate stayed
 * green, because they check that GENERATED pages are CURRENT - components.md regenerates, the field
 * tables regenerate, the semantic index is approved - and not that a new surface has a page at all.
 * Regenerating a catalog is not documenting anything. Nothing asked "is this room written down".
 *
 * It reads the same folders the shell does (folders-as-schema, one per app under src/ui/apps), so a
 * drop-in cannot arrive undocumented and unnoticed.
 *
 * MATCHED ON THE MANIFEST TITLE, not on the folder id, because that is what a section is named after
 * and what a reader searches for. "The Library" and "HTML View" appear in their headings verbatim.
 *
 * `comingSoon` apps are exempt, and only those. The Company is a dimmed "installs later" tile with
 * no surface behind it - there is nothing to describe yet, and a page promising a room nobody can
 * open would be worse than silence. The moment it becomes mountable the exemption lapses on its own,
 * because the flag is what grants it.
 *
 * Run: bun run scripts/hooks/apps-documented.ts [--check]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const APPS_DIR = join("src", "ui", "apps");
const UI_DOC = join("docs", "reference", "ui.md");

interface AppRow {
  readonly id: string;
  readonly title: string;
  readonly comingSoon: boolean;
}

/** Read what a manifest declares, without evaluating the module. */
function readApps(): AppRow[] {
  const rows: AppRow[] = [];
  for (const entry of readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let src = "";
    try {
      src = readFileSync(join(APPS_DIR, entry.name, "index.tsx"), "utf8");
    } catch {
      continue; // a folder with no entry point is not an app the shell can mount
    }
    const title = /\btitle:\s*"([^"]+)"/.exec(src)?.[1];
    if (!title) {
      console.error(`apps-documented: ${entry.name}/index.tsx declares no title`);
      process.exit(1);
    }
    rows.push({ id: entry.name, title, comingSoon: /\bcomingSoon:\s*true/.test(src) });
  }
  return rows;
}

const doc = readFileSync(UI_DOC, "utf8");
const headings = doc.split("\n").filter((line) => line.startsWith("## "));

const apps = readApps();
const undocumented = apps
  .filter((app) => !app.comingSoon)
  .filter((app) => !headings.some((h) => h.includes(app.title)));

if (undocumented.length > 0) {
  console.error(`apps-documented: ${undocumented.length} app(s) have no section in ${UI_DOC}:`);
  for (const app of undocumented) {
    console.error(`  ${app.id} ("${app.title}") - add a "## ..." section naming it`);
  }
  console.error("");
  console.error("A section describes what the room is FOR and what it refuses to do. Regenerating");
  console.error("components.md is not documentation; this gate exists because that was mistaken for it.");
  process.exit(1);
}

const skipped = apps.filter((a) => a.comingSoon).map((a) => a.id);
console.log(
  `apps-documented: ${apps.length - skipped.length} app(s) documented`
  + (skipped.length > 0 ? `, ${skipped.length} not yet mountable (${skipped.join(", ")})` : ""),
);
