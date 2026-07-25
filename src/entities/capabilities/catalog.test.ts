/** Contract tests for the canonical content capability catalog. */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ParsedCanonicalEntity } from "../runtime-schema";
import { createCapabilityCatalog, providerToolName } from "./catalog";
import type { ContentCapability } from "./types";

const entity = {} as ParsedCanonicalEntity;

function capability(
  id: ContentCapability<{ value: string }>["id"],
  over: Partial<ContentCapability<{ value: string }>> = {},
): ContentCapability<{ value: string }> {
  return {
    id,
    kind: "lorebook",
    area: "entries",
    action: "update",
    summary: "Update one lorebook entry.",
    aliases: ["edit lore"],
    platforms: "canonical",
    exposure: "deferred",
    effect: "draft",
    input: z.object({ value: z.string() }),
    concurrencyKey: () => "lorebook/world",
    preview: () => ({ entity, changes: [], warnings: [], platformImpact: [] }),
    ...over,
  };
}

describe("createCapabilityCatalog", () => {
  test("indexes capabilities without changing their declared order", () => {
    const update = capability("lorebook.entries.update");
    const settings = capability("lorebook.settings.update", { area: "settings" });
    const catalog = createCapabilityCatalog([update, settings]);

    expect(catalog.all()).toEqual([update, settings]);
    expect(catalog.get(update.id)).toBe(update);
    expect(catalog.forKind("lorebook")).toEqual([update, settings]);
    expect(catalog.forKind("character")).toEqual([]);
  });

  test("rejects duplicate ids and ids whose kind prefix disagrees", () => {
    const update = capability("lorebook.entries.update");
    expect(() => createCapabilityCatalog([update, update])).toThrow("duplicate capability id");
    expect(() => createCapabilityCatalog([
      capability("character.entries.update"),
    ])).toThrow("must start with lorebook.");
  });

  test("rejects malformed dotted ids instead of normalizing them", () => {
    expect(() => createCapabilityCatalog([
      capability("lorebook..update" as ContentCapability<{ value: string }>["id"]),
    ])).toThrow("invalid capability id");
  });

  test("rejects incomplete runtime metadata instead of trusting TypeScript", () => {
    expect(() => createCapabilityCatalog([
      capability("lorebook.entries.update", { summary: "" }),
    ])).toThrow("non-empty summary");
    expect(() => createCapabilityCatalog([
      capability("lorebook.entries.update", {
        exposure: "sometimes" as ContentCapability<{ value: string }>["exposure"],
      }),
    ])).toThrow("invalid exposure");
  });

  test("derives provider-safe names from stable dotted ids", () => {
    expect(providerToolName("lorebook.entries.update")).toBe("lorebook_entries_update");
  });
});
