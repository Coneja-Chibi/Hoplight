/**
 * Importing the format-matrix module must be read-only. Tests and other tooling import its pure
 * render helpers; only the explicit CLI entry point may rewrite docs/FORMAT-SUPPORT.md.
 */
import { afterAll, expect, test } from "bun:test";
import { readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const matrixPath = join(import.meta.dir, "../docs/FORMAT-SUPPORT.md");
const original = readFileSync(matrixPath, "utf8");
const originalStat = statSync(matrixPath);

afterAll(() => {
  const current = readFileSync(matrixPath, "utf8");
  const currentStat = statSync(matrixPath);
  if (current !== original || currentStat.mtimeMs !== originalStat.mtimeMs) {
    writeFileSync(matrixPath, original, "utf8");
    utimesSync(matrixPath, originalStat.atime, originalStat.mtime);
  }
});

test("importing the generator does not rewrite the committed matrix", async () => {
  const before = statSync(matrixPath);
  await import("./format-matrix.ts?import-safety-test");
  const after = statSync(matrixPath);

  expect(readFileSync(matrixPath, "utf8")).toBe(original);
  expect(after.mtimeMs).toBe(before.mtimeMs);
});
