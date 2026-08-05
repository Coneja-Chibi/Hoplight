/**
 * Folder-based doctor discovery. A new self-check is one default-exported file under checks/;
 * duplicate ids fail startup instead of making the diagnostic card ambiguous.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { DoctorCheck } from "./check";
import { packagedDropIns } from "../packaged-drop-ins";

const isCheckFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_");

const isCheck = (value: unknown): value is DoctorCheck => {
  const check = value as Partial<DoctorCheck> | undefined;
  return typeof check?.id === "string" && typeof check.run === "function";
};

/** Collect, refusing duplicate ids whichever path produced the list. */
function collect(candidates: readonly unknown[]): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  for (const candidate of candidates) {
    if (!isCheck(candidate)) continue;
    if (checks.some((existing) => existing.id === candidate.id)) {
      throw new Error(`doctor: duplicate check ${candidate.id}`);
    }
    checks.push(candidate);
  }
  return checks;
}

export async function discoverDoctorChecks(dir?: string): Promise<DoctorCheck[]> {
  // A compiled binary has no folder to walk; see packaged-drop-ins.ts.
  const baked = dir === undefined ? packagedDropIns("doctorChecks") : null;
  if (baked) return collect(baked);
  const root = dir ?? fileURLToPath(new URL("checks/", import.meta.url));
  const files = (await readdir(root))
    .filter(isCheckFile)
    .map((name) => join(root, name))
    .sort((a, b) => a.localeCompare(b));
  const loaded: unknown[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(file).href)) as { default?: DoctorCheck };
    loaded.push(mod.default);
  }
  return collect(loaded);
}
