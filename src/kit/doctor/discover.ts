/**
 * Folder-based doctor discovery. A new self-check is one default-exported file under checks/;
 * duplicate ids fail startup instead of making the diagnostic card ambiguous.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { DoctorCheck } from "./check";

const isCheckFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_");

export async function discoverDoctorChecks(dir?: string): Promise<DoctorCheck[]> {
  const root = dir ?? fileURLToPath(new URL("checks/", import.meta.url));
  const files = (await readdir(root))
    .filter(isCheckFile)
    .map((name) => join(root, name))
    .sort((a, b) => a.localeCompare(b));
  const checks: DoctorCheck[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(file).href)) as { default?: DoctorCheck };
    const check = mod.default;
    if (!check || typeof check.id !== "string" || typeof check.run !== "function") continue;
    if (checks.some((existing) => existing.id === check.id)) {
      throw new Error(`doctor: duplicate check ${check.id}`);
    }
    checks.push(check);
  }
  return checks;
}
