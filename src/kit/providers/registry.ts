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
import { packagedDropIns } from "../packaged-drop-ins";

const isSpokeFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_");

/** Load every drop-in provider in spokes/, keyed by id, sorted for a stable order. */
// A spoke earns its place with EITHER a model or its own chat. Requiring `model` would silently drop
// a provider that is not an HTTP model, and the symptom is an "unknown provider" error far from the
// file that caused it.
const isSpoke = (value: unknown): value is ProviderSpoke => {
  const spoke = value as Partial<ProviderSpoke> | undefined;
  const usable = typeof spoke?.model === "function" || typeof spoke?.chat === "function";
  return typeof spoke?.id === "string" && usable;
};

export async function loadSpokes(dir?: string): Promise<Map<string, ProviderSpoke>> {
  // A compiled binary has no folder to walk; see packaged-drop-ins.ts.
  const baked = dir === undefined ? packagedDropIns("spokes") : null;
  if (baked) return new Map(baked.filter(isSpoke).map((spoke) => [spoke.id, spoke]));
  const base = dir ?? fileURLToPath(new URL("./spokes/", import.meta.url));
  const files = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isSpokeFile)
    .sort((a, b) => a.localeCompare(b));
  const spokes = new Map<string, ProviderSpoke>();
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(base, file)).href)) as { default?: ProviderSpoke };
    if (isSpoke(mod.default)) spokes.set(mod.default.id, mod.default);
  }
  return spokes;
}

let cache: Map<string, ProviderSpoke> | null = null;

/** The spokes, loaded once per process. */
export async function spokes(): Promise<Map<string, ProviderSpoke>> {
  if (!cache) cache = await loadSpokes();
  return cache;
}
