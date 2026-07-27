/**
 * Reading entities that were written by an older or foreign writer.
 *
 * Four real regex sets sat unreadable in a live studio because their `schemaVersion` was the number
 * 1 while the decoder wanted the string "1". Nothing else about them differed, every rule was
 * intact, and the app called them "corrupt entity file" with no field named - so there was no way
 * to know that one JSON type was the entire problem.
 *
 * Tolerance lives HERE, at the read-from-disk boundary, and deliberately not inside
 * parseCanonicalEntity: the converters and the capability preview parse on the WRITE path, where a
 * wrong shape is a Hoplight bug that must still fail loudly.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StudioStore } from "./store";

const regexEntity = (overrides: Record<string, unknown>): Record<string, unknown> => ({
  schemaVersion: "1",
  kind: "regex",
  id: "cleanup",
  body: { name: "Chat Cleanup", rules: [] },
  ...overrides,
});

async function studioWith(file: Record<string, unknown>): Promise<{ dir: string; store: StudioStore }> {
  const dir = await mkdtemp(join(tmpdir(), "studio-migration-"));
  await mkdir(join(dir, "regex"), { recursive: true });
  await writeFile(join(dir, "regex", "cleanup.json"), JSON.stringify(file), "utf8");
  return { dir, store: new StudioStore(dir) };
}

describe("stored entities that drifted are read, not condemned", () => {
  test("a numeric schemaVersion loads with its content intact", async () => {
    const { dir, store } = await studioWith(regexEntity({
      schemaVersion: 1,
      body: {
        name: "Chat Cleanup",
        rules: [{
          id: "r1",
          label: "Trim",
          find: "a",
          flags: "g",
          replace: "b",
          phases: ["response"],
          enabled: true,
          sortOrder: 0,
        }],
      },
    }));
    try {
      const entity = await store.read("regex", "cleanup") as { body?: { name?: string; rules?: unknown[] } };
      expect(entity.body?.name).toBe("Chat Cleanup");
      expect(entity.body?.rules).toHaveLength(1);
      expect((await store.inventory("regex")).damaged).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("the legacy escrow key is still carried across to original", async () => {
    const { dir, store } = await studioWith({
      ...regexEntity({}),
      escrow: { sillytavern: { raw: { kept: true } } },
    });
    try {
      const entity = await store.read("regex", "cleanup") as { original?: Record<string, unknown> };
      expect(entity.original?.["sillytavern"]).toEqual({ raw: { kept: true } } as never);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("what a genuinely broken file reports", () => {
  test("the failure names the field instead of only saying corrupt", async () => {
    // The message is the difference between a user filing a useful report and saying "it says it
    // is broken", which is exactly what happened.
    const { dir, store } = await studioWith(regexEntity({ body: { name: 42, rules: [] } }));
    try {
      const { damaged } = await store.inventory("regex");
      expect(damaged).toHaveLength(1);
      await expect(store.read("regex", "cleanup")).rejects.toThrow(/body\.name/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a file that is not JSON at all is still refused", async () => {
    const dir = await mkdtemp(join(tmpdir(), "studio-migration-"));
    await mkdir(join(dir, "regex"), { recursive: true });
    await writeFile(join(dir, "regex", "cleanup.json"), "{not json", "utf8");
    try {
      const { damaged } = await new StudioStore(dir).inventory("regex");
      expect(damaged[0]?.reason).toBe("unreadable-json");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
