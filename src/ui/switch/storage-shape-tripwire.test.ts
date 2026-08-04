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
// Updated deliberately for a COMPATIBLE change: PresetBody gained an optional `behaviorRefs`
// string array - linked regex/script set ids, the exact counterpart of CharacterBody.behaviorRefs.
//
// Why it needs no version bump: it is optional and additive, so a preset saved before this field
// existed parses byte-for-byte as it did, and a preset carrying it was not readable by an earlier
// build anyway. Nothing writes the key unless a set is actually linked, so an unlinked preset and a
// never-linked one still serialize identically - the same property the `notes` entry below relied on.
//
// What it fixes: the link existed on the wire and nowhere in canonical. Hoplight could LIFT a
// preset's bundled `extensions.regex_scripts` into a standalone set and had no way to say that a set
// belongs to a preset, so a person asking to attach one was told the Studio could not - true, and
// easily read as a limit of the format rather than a hole in our model.
//
// The prior entry, also compatible: the canonical envelope gained an optional `notes` array,
// declared once on the shared envelope so every entity kind carries it. Removing the last note
// deletes the key rather than leaving `[]`.
//
// And before that: PresetSamplers.promptPostProcessing gained the values SillyTavern actually
// writes, and the per-group schemas were exported for the ST codec to read expected types off them.
const PINNED_SHAPE_HASH = "2fb5a39fd6a30891e5be97bff9eecbce42f66bba2f369f63c2da091f50ae790f";

test("storage-shape tripwire: an on-disk shape change must be a deliberate, version-aware act", async () => {
  const h = createHash("sha256");
  const files = await shapeFiles();
  expect(files.filter((path) => path.includes("/runtime-schema.ts"))).toHaveLength(7);
  for (const f of files) h.update((await Bun.file(f).text()).replace(/\r\n/g, "\n"));
  expect(h.digest("hex")).toBe(PINNED_SHAPE_HASH);
});
