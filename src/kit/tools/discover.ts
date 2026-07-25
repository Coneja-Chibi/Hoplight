/**
 * The tool loader: folders-as-schema for Kit's tools, the IMPURE edge that mirrors src/core/loader.ts.
 * Every `*.ts` in this folder that default-exports a HarnessTool is discovered and returned. Files
 * starting with "_" (shared helpers) and the infra files (tool.ts, discover.ts) are skipped, as are
 * tests. Under `bun run` this dynamic import reads the real folder; if Kit is ever compiled to a
 * single binary, this is the one spot that swaps to a baked static list.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { HarnessTool } from "./tool";

const INFRA = new Set(["tool.ts", "discover.ts"]);

const isToolFile = (name: string): boolean =>
  name.endsWith(".ts")
  && !name.endsWith(".test.ts")
  && !name.startsWith("_")
  && !INFRA.has(name);

/** Load every drop-in tool in this folder, sorted by name for a stable order. */
export async function discoverTools(dir?: string): Promise<HarnessTool[]> {
  const base = dir ?? fileURLToPath(new URL(".", import.meta.url));
  const files = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isToolFile)
    .sort((a, b) => a.localeCompare(b));
  const tools: HarnessTool[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(base, file)).href)) as { default?: HarnessTool };
    const tool = mod.default;
    if (tool && typeof tool.name === "string" && typeof tool.execute === "function") {
      tools.push(tool);
    }
  }
  return tools;
}
