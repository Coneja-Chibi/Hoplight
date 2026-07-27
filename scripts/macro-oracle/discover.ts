/**
 * Folders-as-schema for the macro oracle: every `*.ts` under ./engines that default-exports a
 * MacroOracleEngine is discovered, the same way src/formats and src/kit/tools are loaded. Adding an
 * engine means adding one file, never editing a central list.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { MacroOracleEngine } from "./types";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/** Where captured fixtures live; read by both the extractor and the parity gate. */
export const FIXTURE_DIR = join(HERE, "_fixtures");

const isEngineFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_");

/** Load every drop-in extractor, sorted by id for a stable capture order. */
export async function discoverOracleEngines(dir?: string): Promise<MacroOracleEngine[]> {
  const base = dir ?? join(HERE, "engines");
  const files = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isEngineFile)
    .sort((a, b) => a.localeCompare(b));

  const engines: MacroOracleEngine[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(base, file)).href)) as {
      default?: MacroOracleEngine;
    };
    const engine = mod.default;
    if (engine && typeof engine.id === "string" && typeof engine.extract === "function") {
      engines.push(engine);
    }
  }
  return engines;
}
