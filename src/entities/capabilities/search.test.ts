/** Relevance and bounding tests for capability discovery. */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ParsedCanonicalEntity } from "../runtime-schema";
import { createCapabilityCatalog } from "./catalog";
import { searchCapabilities } from "./search";
import type { ContentCapability } from "./types";

const entity = {} as ParsedCanonicalEntity;

const cap = (
  id: ContentCapability<Record<string, never>>["id"],
  area: string,
  action: string,
  summary: string,
  aliases: readonly string[] = [],
  platforms: readonly string[] | "canonical" = "canonical",
): ContentCapability<Record<string, never>> => ({
  id,
  kind: id.startsWith("character.") ? "character" : "lorebook",
  area,
  action,
  summary,
  aliases,
  platforms,
  exposure: "deferred",
  effect: "draft",
  input: z.object({}),
  concurrencyKey: () => id,
  preview: () => ({ entity, changes: [], warnings: [], platformImpact: [] }),
});

const catalog = createCapabilityCatalog([
  cap("lorebook.entries.update", "entries", "update", "Change one lore entry.", ["edit lore"]),
  cap("lorebook.entries.reorder", "entries", "reorder", "Move lore entries."),
  cap("lorebook.settings.update", "settings", "update", "Change book settings."),
  cap("character.greetings.manage", "greetings", "manage", "Manage alternate greetings."),
  cap("character.platform.update", "platform", "update", "Change native fields.", [], ["sillytavern"]),
  cap("character.identity.update", "identity", "update", "Change character identity."),
]);

describe("searchCapabilities", () => {
  test("ranks an exact action and alias match ahead of incidental words", () => {
    const hits = searchCapabilities(catalog, { query: "edit lore", kind: "lorebook" });
    expect(hits[0]?.capability.id).toBe("lorebook.entries.update");
    expect(hits.every((hit) => hit.capability.kind === "lorebook")).toBe(true);
  });

  test("filters by platform and returns deterministic scores", () => {
    const first = searchCapabilities(catalog, {
      query: "native fields",
      kind: "character",
      platform: "sillytavern",
    });
    const second = searchCapabilities(catalog, {
      query: "native fields",
      kind: "character",
      platform: "sillytavern",
    });
    expect(first).toEqual(second);
    expect(first.map((hit) => hit.capability.id)).toEqual(["character.platform.update"]);
  });

  test("does not let the already-known target kind drown out operation intent", () => {
    expect(searchCapabilities(catalog, {
      query: "change lorebook settings",
      kind: "lorebook",
    }).map((hit) => hit.capability.id)).toEqual(["lorebook.settings.update"]);
  });

  test("caps broad results at five and accepts a smaller explicit limit", () => {
    expect(searchCapabilities(catalog, { query: "e" })).toHaveLength(5);
    expect(searchCapabilities(catalog, { query: "e", limit: 2 })).toHaveLength(2);
  });
});
