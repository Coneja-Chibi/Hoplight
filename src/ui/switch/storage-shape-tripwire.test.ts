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
// Updated deliberately for a NEW ENTITY KIND plus one additive field: `quickreply` (SillyTavern
// QuickReply sets as pieces, so a preset can link them and the Press prints them together) joins
// the union as a new member - the count above goes 8 to 9 with its own runtime-schema.ts - and
// PresetBody gains optional `quickReplyRefs`, the exact counterpart of `behaviorRefs`. Both are
// additive and COMPATIBLE: nothing previously valid becomes invalid, and a preset saved before the
// field existed parses byte-for-byte as it did. No schema-version bump, no SCHEMA_BUMPS entry.
//
// Previously updated for a COMPATIBLE WIDENING, in-flight on the working tree: PromptRole gained
// "tool" (preset/schema.ts, its runtime schema, and the blocks capability's mirror). Additive union
// member - every preset written before parses byte-for-byte as it did, and nothing previously valid
// becomes invalid; a NARROWING would be the incompatible direction. No schema-version bump and no
// SCHEMA_BUMPS entry.
//
// Previously updated for a NEW ENTITY KIND: `htmldoc`, an HTML document kept as a piece so the
// existing rename/duplicate/delete/collection tools have something to act on. Additive and
// COMPATIBLE - no existing kind's on-disk shape moved, and nothing previously valid becomes
// invalid, because the discriminated union only gained a member. A file written before this exists
// parses byte-for-byte as it did. No schema-version bump and no SCHEMA_BUMPS entry; the count above
// went 7 to 8 because the new kind brought its own runtime-schema.ts.
//
// Previously updated for TWO COMPATIBLE changes that landed either side of this merge.
//
// From the archive-import branch: core/canonical.ts gained `primaryOriginalId`, a standalone
// function reading the same `Original` record `primaryOriginalRaw` already reads (the KEY of its
// first entry rather than the `raw` value). No interface changed and nothing about a PERSISTED
// entity's on-disk shape moved - new code reading the existing shape, not a shape change.
//
// From Mainstage: PresetBody gained an optional `behaviorRefs` string array, the exact counterpart
// of CharacterBody.behaviorRefs. Optional and additive, so a preset saved before it existed parses
// byte-for-byte as it did, and nothing writes the key unless a set is actually linked.
//
// Neither needs a schema-version bump and neither takes a SCHEMA_BUMPS entry. The hash below is
// recomputed for the merged tree: the two pinned values from either side each describe only half
// of it, so keeping either one would have been a green tripwire guarding the wrong shape.
//
// The prior entry, also compatible: the canonical envelope gained an optional `notes` array,
// declared once on the shared envelope so every entity kind carries it. Removing the last note
// deletes the key rather than leaving `[]`, so an annotated piece and a never-annotated one still
// serialize identically.
//
// And before that: PresetSamplers.promptPostProcessing gained the values SillyTavern actually
// writes, and the per-group schemas were exported for the ST codec to read expected types off them.
const PINNED_SHAPE_HASH = "92b7874f697d6669eda478111761d1d836e14e6061a4e033c49a0e20005fe300";

test("storage-shape tripwire: an on-disk shape change must be a deliberate, version-aware act", async () => {
  const h = createHash("sha256");
  const files = await shapeFiles();
  expect(files.filter((path) => path.includes("/runtime-schema.ts"))).toHaveLength(9);
  for (const f of files) h.update((await Bun.file(f).text()).replace(/\r\n/g, "\n"));
  expect(h.digest("hex")).toBe(PINNED_SHAPE_HASH);
});
