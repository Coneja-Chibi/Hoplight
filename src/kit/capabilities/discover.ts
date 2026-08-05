/**
 * Impure filesystem edge that discovers entity and format capability drop-ins.
 */
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createCapabilityCatalog,
  type ContentCapability,
} from "../../entities/capabilities";
import { allCapabilities } from "../../generated/capabilities";
import { isPackagedBuild } from "../packaged-drop-ins";

const INFRA = new Set([
  "catalog.ts",
  "descriptor.ts",
  "exposure.ts",
  "index.ts",
  "navigation.ts",
  "operations.ts",
  "search.ts",
  "shared.ts",
  "types.ts",
]);

const isCapabilityFile = (name: string): boolean =>
  name.endsWith(".ts")
  && !name.endsWith(".test.ts")
  && !name.startsWith("_")
  && !INFRA.has(name);

async function capabilityFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (basename(dir) === "capabilities" && isCapabilityFile(entry.name)) {
        found.push(path);
      }
    }
  };
  await visit(root);
  return found;
}

const isCapability = (value: unknown): value is ContentCapability => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ContentCapability>;
  return typeof candidate.id === "string"
    && typeof candidate.kind === "string"
    && typeof candidate.preview === "function"
    && typeof candidate.concurrencyKey === "function"
    && typeof candidate.input?.safeParse === "function";
};

/** Load all drop-in capabilities from entity and format roots, sorted and duplicate-checked. */
export async function discoverCapabilities(
  roots?: readonly string[],
): Promise<ContentCapability[]> {
  // A compiled binary has no folder to walk; see packaged-drop-ins.ts. The baked list comes from the
  // SAME generator the browser bundle reads, so there is one answer to "what capabilities exist".
  if (roots === undefined && isPackagedBuild()) {
    return [...createCapabilityCatalog([...allCapabilities]).all()]
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  const walkRoots = roots ?? [
    fileURLToPath(new URL("../../entities", import.meta.url)),
    fileURLToPath(new URL("../../formats", import.meta.url)),
  ];
  const files = (await Promise.all(walkRoots.map(capabilityFiles)))
    .flat()
    .sort((a, b) => a.localeCompare(b));
  const capabilities: ContentCapability[] = [];

  for (const file of files) {
    const mod = (await import(pathToFileURL(file).href)) as {
      default?: ContentCapability | readonly ContentCapability[];
    };
    const exported = Array.isArray(mod.default) ? mod.default : [mod.default];
    for (const capability of exported) {
      if (!isCapability(capability)) {
        throw new Error(`invalid capability export in ${file}`);
      }
      capabilities.push(capability);
    }
  }

  return [...createCapabilityCatalog(capabilities).all()]
    .sort((a, b) => a.id.localeCompare(b.id));
}
