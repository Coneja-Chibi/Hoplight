/** Filesystem discovery coverage for entity and format capability drop-ins. */
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverCapabilities } from "./discover";

describe("discoverCapabilities", () => {
  test("finds the lorebook semantic bundles in stable id order", async () => {
    const ids = (await discoverCapabilities())
      .filter((capability) => capability.kind === "lorebook")
      .map((capability) => capability.id);

    expect(ids).toEqual([
      "lorebook.entries.enable",
      "lorebook.entries.remove",
      "lorebook.entries.reorder",
      "lorebook.entries.update",
      "lorebook.settings.update",
    ]);
  });

  test("rejects a malformed drop-in instead of silently omitting it", async () => {
    const root = await mkdtemp(join(tmpdir(), "hoplight-capability-"));
    const folder = join(root, "lorebook", "capabilities");
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, "malformed.ts"),
      "export default { id: 'lorebook.entries.broken', kind: 'lorebook' };\n",
      "utf8",
    );
    await expect(discoverCapabilities([root])).rejects.toThrow("malformed.ts");
  });
});
