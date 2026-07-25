/** Capability-to-HarnessTool adapter coverage. */
import { expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { emptyLorebookBody } from "../../core/lore";
import type { KitBridge } from "../bridge";
import type { CanonicalCharacter } from "../../entities/character/schema";
import type { CanonicalPersona } from "../../entities/persona/schema";
import type { CanonicalPreset } from "../../entities/preset/schema";
import type { CanonicalRegexSet } from "../../entities/regex/schema";
import type { CanonicalPack } from "../../entities/pack/schema";
import { createChangeSession } from "../changes/session";
import { discoverCapabilities } from "./discover";
import { capabilityToHarnessTool } from "./adapter";

test("capabilityToHarnessTool reads the target and creates a typed draft preview", async () => {
  const original = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook" as const,
    id: "world",
    body: emptyLorebookBody("World"),
  };
  const bridge: KitBridge = {
    studioDir: "/fake",
    async deckCounts() { return []; },
    async list() { return []; },
    async read(kind, id) { return kind === "lorebook" && id === "world" ? original : null; },
    async save() { throw new Error("drafting must not save"); },
    async delete() { return false; },
  };
  const capability = (await discoverCapabilities())
    .find((candidate) => candidate.id === "lorebook.entries.update")!;
  const tool = capabilityToHarnessTool(capability, createChangeSession());
  const entryId = original.body.entries[0]!.id;

  expect(tool.name).toBe("lorebook_entries_update");
  expect(tool.exposure).toBe("deferred");
  expect(tool.effect).toBe("draft");
  const result = await tool.execute({
    target: { id: "world" },
    entryId,
    patch: { title: "Dragon" },
  }, { bridge });

  expect(result.summary).toBe("draft lorebook.entries.update: 1 change");
  expect(result.output).toContain('"draftId":"draft-1"');
  expect(result.output).toContain('"after":"Dragon"');
});

test("character discovery tools compose a variant-aware Kit draft without saving", async () => {
  const original: CanonicalCharacter = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id: "mira",
    body: {
      identity: { name: "Mira", tagline: "Keeper" },
      persona: {},
      prompts: {},
      greetings: {},
      examples: {},
      media: {},
      attribution: {},
      discovery: {},
    },
    original: { sillytavern: { raw: { sealed: true } } },
  };
  let saves = 0;
  const bridge: KitBridge = {
    studioDir: "/fake",
    async deckCounts() { return []; },
    async list() { return []; },
    async read(kind, id) { return kind === "character" && id === "mira" ? original : null; },
    async save() {
      saves += 1;
      return { id: "mira", kind: "character", name: "Mira" };
    },
    async delete() { return false; },
  };
  const catalog = await discoverCapabilities();
  const variants = catalog.find((item) => item.id === "character.variants.manage")!;
  const identity = catalog.find((item) => item.id === "character.identity.update")!;
  const changes = createChangeSession();
  const addVariant = capabilityToHarnessTool(variants, changes);
  const editIdentity = capabilityToHarnessTool(identity, changes);

  await addVariant.execute({
    target: { id: "mira" },
    operation: { type: "add", id: "winter", label: "Winter" },
  }, { bridge });
  const result = await editIdentity.execute({
    target: { id: "mira", variantId: "winter" },
    patch: { nickname: "Snowkeeper" },
  }, { bridge });

  const draft = changes.forTarget("character", "mira")!;
  expect(draft.operations.map((item) => item.capabilityId)).toEqual([
    "character.variants.manage",
    "character.identity.update",
  ]);
  expect((draft.proposed.body as CanonicalCharacter["body"]).variants?.[0]?.overrides)
    .toEqual({ identity: { nickname: "Snowkeeper" } });
  expect(draft.proposed.original).toEqual(original.original);
  expect(result.output).toContain('"draftId":"draft-1"');
  expect(saves).toBe(0);
});

test("persona tools preserve the brief/content boundary through a composed Kit draft", async () => {
  const original: CanonicalPersona = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "persona",
    id: "ada",
    body: {
      name: "Ada",
      brief: "Shelf blurb",
      content: "I build machines.",
      identity: { tagline: "Builder" },
    },
    original: { rolecall: { raw: { sealed: true } } },
  };
  const bridge: KitBridge = {
    studioDir: "/fake",
    async deckCounts() { return []; },
    async list() { return []; },
    async read(kind, id) { return kind === "persona" && id === "ada" ? original : null; },
    async save() { throw new Error("drafting must not save"); },
    async delete() { return false; },
  };
  const catalog = await discoverCapabilities();
  const changes = createChangeSession();
  const identity = capabilityToHarnessTool(
    catalog.find((item) => item.id === "persona.identity.update")!,
    changes,
  );
  const profile = capabilityToHarnessTool(
    catalog.find((item) => item.id === "persona.profile.update")!,
    changes,
  );

  await identity.execute({
    target: { id: "ada" },
    patch: { brief: "New shelf blurb", content: "I build visible systems." },
  }, { bridge });
  await profile.execute({
    target: { id: "ada" },
    patch: { pronouns: "she/her", traits: ["methodical"] },
  }, { bridge });

  const draft = changes.forTarget("persona", "ada")!;
  const body = draft.proposed.body as CanonicalPersona["body"];
  expect(body.brief).toBe("New shelf blurb");
  expect(body.content).toBe("I build visible systems.");
  expect(body.identity).toEqual({ tagline: "Builder", pronouns: "she/her" });
  expect(draft.proposed.original).toEqual(original.original);
});

test("preset tools compose sampler and block edits over one immutable baseline", async () => {
  const original: CanonicalPreset = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "preset",
    id: "careful",
    body: {
      name: "Careful",
      prompts: [{
        id: "main", name: "Main", content: "Be precise.", role: "system",
        enabled: true, systemPrompt: true, marker: false, placement: "relative",
        injectionDepth: 4, injectionOrder: 100, forbidOverrides: false,
      }],
    },
    original: { "st-preset": { raw: { sealed: true } } },
  };
  const bridge: KitBridge = {
    studioDir: "/fake",
    async deckCounts() { return []; },
    async list() { return []; },
    async read(kind, id) { return kind === "preset" && id === "careful" ? original : null; },
    async save() { throw new Error("drafting must not save"); },
    async delete() { return false; },
  };
  const catalog = await discoverCapabilities();
  const changes = createChangeSession();
  for (const [id, args] of [
    ["preset.settings.update", { target: { id: "careful" }, patch: { temperature: 0.5 } }],
    ["preset.blocks.manage", {
      target: { id: "careful" },
      operation: { type: "update", id: "main", patch: { content: "Be exact." } },
    }],
  ] as const) {
    await capabilityToHarnessTool(catalog.find((item) => item.id === id)!, changes)
      .execute(args, { bridge });
  }
  const draft = changes.forTarget("preset", "careful")!;
  const body = draft.proposed.body as CanonicalPreset["body"];
  expect(body.samplers?.temperature).toBe(0.5);
  expect(body.prompts[0]?.content).toBe("Be exact.");
  expect(draft.proposed.original).toEqual(original.original);
});

test("regex and pack capabilities each complete a typed Kit draft journey", async () => {
  const regex: CanonicalRegexSet = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "regex",
    id: "cleanup",
    body: {
      name: "Cleanup",
      rules: [{
        id: "one", label: "One", find: "x", flags: "g", replace: "y",
        phases: ["output"], enabled: true, sortOrder: 10,
      }],
    },
  };
  const pack: CanonicalPack = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "pack",
    id: "faces",
    body: { name: "Faces", pack: { items: [] } },
  };
  const bridge: KitBridge = {
    studioDir: "/fake",
    async deckCounts() { return []; },
    async list() { return []; },
    async read(kind, id) {
      if (kind === "regex" && id === "cleanup") return regex;
      if (kind === "pack" && id === "faces") return pack;
      return null;
    },
    async save() { throw new Error("drafting must not save"); },
    async delete() { return false; },
  };
  const catalog = await discoverCapabilities();
  const regexChanges = createChangeSession();
  const packChanges = createChangeSession();
  await capabilityToHarnessTool(
    catalog.find((item) => item.id === "regex.rules.manage")!,
    regexChanges,
  ).execute({
    target: { id: "cleanup" },
    operation: { type: "update", id: "one", patch: { replace: "z" } },
  }, { bridge });
  await capabilityToHarnessTool(
    catalog.find((item) => item.id === "pack.items.manage")!,
    packChanges,
  ).execute({
    target: { id: "faces" },
    operation: { type: "add", item: { id: "happy", label: "happy", ref: "asset://happy" } },
  }, { bridge });

  expect((regexChanges.forTarget("regex", "cleanup")!.proposed.body as CanonicalRegexSet["body"])
    .rules[0]?.replace).toBe("z");
  expect((packChanges.forTarget("pack", "faces")!.proposed.body as CanonicalPack["body"])
    .pack.items[0]?.id).toBe("happy");
});
