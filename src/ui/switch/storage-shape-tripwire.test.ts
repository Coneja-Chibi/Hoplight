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

// sha256 of the concatenated storage-shape files, line endings normalized to LF so the pin is identical
// on Windows (CRLF working copy) and CI (LF). Update deliberately (read the header first).
const PINNED_SHAPE_HASH = "7fc3d5932bd3bb9e8795de2081d6140865e7ee789a8767657378f1854a59d2ae";

test("storage-shape tripwire: an on-disk shape change must be a deliberate, version-aware act", async () => {
  const h = createHash("sha256");
  for (const f of SHAPE_FILES) h.update((await Bun.file(f).text()).replace(/\r\n/g, "\n"));
  const got = h.digest("hex");
  expect(got).toBe(PINNED_SHAPE_HASH);
});
