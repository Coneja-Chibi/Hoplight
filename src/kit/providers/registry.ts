/**
 * The provider registry: the impure loader for spokes/, mirroring core/loader.ts and tools/discover.ts.
 * Every `*.ts` in spokes/ that default-exports a ProviderSpoke is discovered and keyed by id. Files
 * starting with "_" (the template) and tests are skipped. This is the only place a provider is wired
 * in; adding one is dropping a file in spokes/.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ProviderSpoke } from "./spoke";

const isSpokeFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_");

/** Load every drop-in provider in spokes/, keyed by id, sorted for a stable order. */
export async function loadSpokes(dir?: string): Promise<Map<string, ProviderSpoke>> {
  const base = dir ?? fileURLToPath(new URL("./spokes/", import.meta.url));
  const files = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isSpokeFile)
    .sort((a, b) => a.localeCompare(b));
  const spokes = new Map<string, ProviderSpoke>();
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(base, file)).href)) as { default?: ProviderSpoke };
    const spoke = mod.default;
    // A spoke earns its place with EITHER a model or its own chat. Requiring `model` would silently
    // drop a provider that is not an HTTP model, and the symptom is an "unknown provider" error far
    // from the file that caused it.
    const usable = typeof spoke?.model === "function" || typeof spoke?.chat === "function";
    if (spoke && typeof spoke.id === "string" && usable) {
      spokes.set(spoke.id, spoke);
    }
  }
  return spokes;
}

let cache: Map<string, ProviderSpoke> | null = null;

/** The spokes, loaded once per process. */
export async function spokes(): Promise<Map<string, ProviderSpoke>> {
  if (!cache) cache = await loadSpokes();
  return cache;
}
