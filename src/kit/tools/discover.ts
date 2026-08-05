/**
 * The tool loader: folders-as-schema for Kit's tools, the IMPURE edge that mirrors src/core/loader.ts.
 * Every `*.ts` in this folder that default-exports a HarnessTool is discovered and returned. Files
 * starting with "_" (shared helpers) and the infra files (tool.ts, discover.ts) are skipped, as are
 * tests. Under `bun run` this dynamic import reads the real folder; a compiled binary has no folder
 * to read, so it takes the baked list from packaged-drop-ins.ts instead.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { HarnessTool } from "./tool";
import { packagedDropIns } from "../packaged-drop-ins";

const INFRA = new Set(["tool.ts", "discover.ts"]);

const isToolFile = (name: string): boolean =>
  name.endsWith(".ts")
  && !name.endsWith(".test.ts")
  && !name.startsWith("_")
  && !INFRA.has(name);

/** Does this value look like a tool? The one shape check, shared by both paths. */
const isTool = (value: unknown): value is HarnessTool => {
  const tool = value as Partial<HarnessTool> | undefined;
  return typeof tool?.name === "string" && typeof tool.execute === "function";
};

/** Load every drop-in tool in this folder, sorted by name for a stable order. */
export async function discoverTools(dir?: string): Promise<HarnessTool[]> {
  // A compiled binary has no folder to walk; see packaged-drop-ins.ts. An explicit dir always wins,
  // because a caller naming a directory means that directory.
  const baked = dir === undefined ? packagedDropIns("tools") : null;
  if (baked) return baked.filter(isTool);
  const base = dir ?? fileURLToPath(new URL(".", import.meta.url));
  const files = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isToolFile)
    .sort((a, b) => a.localeCompare(b));
  const tools: HarnessTool[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(base, file)).href)) as { default?: HarnessTool };
    if (isTool(mod.default)) tools.push(mod.default);
  }
  return tools;
}
