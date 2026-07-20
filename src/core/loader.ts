/**
 * The format loader - "folders as schema" actually happens here. This is the IMPURE edge:
 * it touches the filesystem and dynamically imports feature modules, so it lives
 * outside the pure registry table (./registry).
 *
 * Every folder in src/formats/ with an index.ts default-exporting a FormatAdapter (or an array of
 * them - a format family that ships more than one codec, e.g. character + lorebook) is discovered
 * and registered. Folders whose name starts with "_" (like _template, _shared) are skipped.
 */
import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FormatAdapter } from "./adapter";
import { register } from "./registry";

/**
 * Scan src/formats/ and register every adapter found. Idempotent (re-registering overwrites).
 * @param dir override the formats directory (used by tests).
 */
export async function loadFormats(dir?: string): Promise<FormatAdapter[]> {
  const base = dir ?? fileURLToPath(new URL("../formats/", import.meta.url));
  const loaded: FormatAdapter[] = [];
  const folders = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  for (const folder of folders) {
    if (folder.startsWith("_")) continue; // templates / shared / disabled
    const candidates = ["index.ts", "index.js", "index.mjs"].map((name) => join(base, folder, name));
    let entryPath: string | undefined;
    for (const candidate of candidates) {
      try {
        await access(candidate);
        entryPath = candidate;
        break;
      } catch {
        // a drop-in folder without an entry module is not a format
      }
    }
    if (!entryPath) continue;
    const mod = (await import(pathToFileURL(entryPath).href)) as {
      default?: FormatAdapter | FormatAdapter[];
    };
    const exported = mod.default;
    for (const adapter of Array.isArray(exported) ? exported : exported ? [exported] : []) {
      register(adapter);
      loaded.push(adapter);
    }
  }
  return loaded;
}
