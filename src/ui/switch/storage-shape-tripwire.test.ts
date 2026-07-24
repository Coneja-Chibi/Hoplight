/**
 * Storage-shape tripwire (Fable S2). A rollback across a release that changed how a studio piece or the
 * settings are written to disk can make an older app silently skip newer pieces. The classifier that
 * warns/refuses those rollbacks reads SCHEMA_BUMPS (switch-decision.ts), which a human must keep current.
 * This test makes that impossible to forget: it hashes the files that define the on-disk shape, and fails
 * the moment any of them changes. When it fails, ask "did this change how data is STORED?":
 *   - No (added an optional field, edited a comment): just update PINNED_SHAPE_HASH below.
 *   - Yes (renamed/removed a persisted field, changed a container): ALSO bump CANONICAL_SCHEMA_VERSION and
 *     add the shipping version to SCHEMA_BUMPS in src/ui/_shared/switch-decision.ts, so the rollback into
 *     the old shape is warned + gated, then update the hash.
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";

const SHAPE_FILES = [
  "src/entities/runtime-schema.ts",
  "src/studio/settings-shape.ts",
  "src/core/canonical.ts",
];

// sha256 of the concatenated storage-shape files. Update deliberately (read the header first).
const PINNED_SHAPE_HASH = "8b0e7f276cf2a4ed3fd3a7cb8a87325eeab31371aa6eb1787915eefa5171d3d4";

test("storage-shape tripwire: an on-disk shape change must be a deliberate, version-aware act", async () => {
  const h = createHash("sha256");
  for (const f of SHAPE_FILES) h.update(await Bun.file(f).text());
  const got = h.digest("hex");
  expect(got).toBe(PINNED_SHAPE_HASH);
});
