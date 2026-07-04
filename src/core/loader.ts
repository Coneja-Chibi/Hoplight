/**
 * The format loader - "folders as schema" actually happens here. This is the IMPURE edge:
 * it touches the filesystem (Bun.Glob) and dynamically imports feature modules, so it lives
 * outside the pure registry table (./registry).
 *
 * Every folder in src/formats/ with an index.ts default-exporting a FormatAdapter is discovered
 * and registered. Folders whose name starts with "_" (like _template, _shared) are skipped.
 */
import { Glob } from "bun";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { FormatAdapter } from "./adapter";
import { register } from "./registry";

/**
 * Scan src/formats/ and register every adapter found. Idempotent (re-registering overwrites).
 * @param dir override the formats directory (used by tests).
 */
export async function loadFormats(dir?: string): Promise<FormatAdapter[]> {
  const base = dir ?? join(import.meta.dir, "..", "formats");
  const glob = new Glob("*/index.ts");
  const loaded: FormatAdapter[] = [];
  for await (const rel of glob.scan({ cwd: base })) {
    const folder = rel.split(/[\\/]/)[0] ?? "";
    if (folder.startsWith("_")) continue; // templates / shared / disabled
    const mod = (await import(pathToFileURL(join(base, rel)).href)) as {
      default?: FormatAdapter;
      adapter?: FormatAdapter;
    };
    const adapter = mod.default ?? mod.adapter;
    if (adapter) {
      register(adapter);
      loaded.push(adapter);
    }
  }
  return loaded;
}
