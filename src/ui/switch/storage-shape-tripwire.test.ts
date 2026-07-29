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
//
// Updated deliberately for a COMPATIBLE change: the canonical envelope gained an optional `notes`
// array, declared once on the shared envelope so every entity kind carries it. Purely additive - a
// stored file without notes parses exactly as it did before, and a file with them was not readable
// by any earlier build to begin with - so this needs no schema-version bump and no SCHEMA_BUMPS
// entry. Removing the last note deletes the key rather than leaving `[]`, so an annotated piece and
// a never-annotated one still serialize identically.
//
// The prior entry, also compatible: PresetSamplers.promptPostProcessing gained the values
// SillyTavern actually writes, and the per-group schemas were exported for the ST codec to read
// expected types off them.
const PINNED_SHAPE_HASH = "c5805529913cd14d74fc39f108777d688bb3cca4d24407e1c26ff8867b86ffdd";

test("storage-shape tripwire: an on-disk shape change must be a deliberate, version-aware act", async () => {
  const h = createHash("sha256");
  const files = await shapeFiles();
  expect(files.filter((path) => path.includes("/runtime-schema.ts"))).toHaveLength(7);
  for (const f of files) h.update((await Bun.file(f).text()).replace(/\r\n/g, "\n"));
  expect(h.digest("hex")).toBe(PINNED_SHAPE_HASH);
});
