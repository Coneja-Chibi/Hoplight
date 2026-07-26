/**
 * Pins persisted schemas for rollback review. Incompatible changes require a schema-version bump and
 * a SCHEMA_BUMPS entry; compatible changes require only a deliberate hash update.
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";

async function shapeFiles(): Promise<string[]> {
  const entityDirs = (await readdir("src/entities", { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => `src/entities/${entry.name}/runtime-schema.ts`)
    .sort();
  const adjacent = [];
  for (const path of entityDirs) {
    if (await Bun.file(path).exists()) adjacent.push(path);
  }
  return [
    "src/entities/runtime-schema.ts",
    ...adjacent,
    "src/studio/settings-shape.ts",
    "src/core/canonical.ts",
  ];
}

// LF normalization keeps the pin stable across Windows and CI.
const PINNED_SHAPE_HASH = "66d5df085f45f5de6d8370210da5e5c6dd5d91a4cef45d4e88c2a6e75da9302c";

test("storage-shape tripwire: an on-disk shape change must be a deliberate, version-aware act", async () => {
  const h = createHash("sha256");
  const files = await shapeFiles();
  expect(files.filter((path) => path.includes("/runtime-schema.ts"))).toHaveLength(7);
  for (const f of files) h.update((await Bun.file(f).text()).replace(/\r\n/g, "\n"));
  expect(h.digest("hex")).toBe(PINNED_SHAPE_HASH);
});
