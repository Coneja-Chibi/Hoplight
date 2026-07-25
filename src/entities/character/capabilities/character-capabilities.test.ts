/**
 * Character semantic bundle coverage: typed previews, precise paths, removal, and escrow safety.
 */
import { expect, test } from "bun:test";
import type { CanonicalCharacter } from "../schema";
import identity from "./identity";
import prompts from "./prompts";
import greetings from "./greetings";
import metadata from "./metadata";
import presentation from "./presentation";
import media from "./media";
import links from "./links";
import variants from "./variants";
import settings from "./settings";
import behaviorScripts from "./behavior-scripts";
import { readCharacterPath, writeCharacterPath } from "./operations";

const character = (): CanonicalCharacter => ({
  schemaVersion: "1",
  kind: "character",
  id: "mira",
  body: {
    identity: { name: "Mira", tagline: "Keeper" },
    persona: { personality: "Patient", scenario: "At the archive" },
    prompts: { systemPrompt: "Stay in character." },
    greetings: {
      firstMessage: "Welcome.",
      alternateGreetings: [{ text: "Back again?", title: "Return" }],
    },
    examples: { exampleMessages: "Mira: Hush." },
    media: {},
    attribution: { creator: "Chi" },
    discovery: { tags: ["archivist"] },
  },
  original: {
    sillytavern: {
      raw: { untouched: true },
      unmapped: { foreign: { value: 7 } },
    },
  },
});

test("identity preview updates portable identity and preserves original escrow", () => {
  const before = character();
  const parsed = identity.input.parse({
    target: { id: "mira" },
    patch: { name: "Mira Vale", pronouns: "she/her", tagline: null },
  });
  const preview = identity.preview(before, parsed);
  expect(preview.entity.body.identity).toMatchObject({
    name: "Mira Vale",
    pronouns: "she/her",
  });
  expect(preview.entity.body.identity.tagline).toBeUndefined();
  expect(preview.changes.map((change) => change.path)).toEqual([
    "body.identity.name",
    "body.identity.tagline",
    "body.identity.pronouns",
  ]);
  expect(preview.entity.original).toEqual(before.original);
});

test("prompt preview updates semantic slots without disturbing sibling content", () => {
  const before = character();
  const parsed = prompts.input.parse({
    target: { id: "mira" },
    patch: {
      personality: "Dryly funny",
      systemPrompt: null,
      postHistoryInstructions: "End on a question.",
    },
  });
  const preview = prompts.preview(before, parsed);
  expect(preview.entity.body.persona.personality).toBe("Dryly funny");
  expect(preview.entity.body.prompts.systemPrompt).toBeUndefined();
  expect(preview.entity.body.prompts.postHistoryInstructions).toBe("End on a question.");
  expect(preview.entity.body.greetings).toEqual(before.body.greetings);
});

test("greeting and metadata previews replace authored arrays as one explicit change", () => {
  const before = character();
  const greetingPreview = greetings.preview(before, greetings.input.parse({
    target: { id: "mira" },
    patch: {
      alternateGreetings: [
        { text: "The archive remembers you.", title: "Remembered" },
        { text: "State your business." },
      ],
    },
  }));
  expect(greetingPreview.entity.body.greetings.alternateGreetings).toHaveLength(2);

  const metadataPreview = metadata.preview(before, metadata.input.parse({
    target: { id: "mira" },
    patch: { tags: ["archive", "mystery"], rating: "mature", creator: "Coneja" },
  }));
  expect(metadataPreview.entity.body.discovery.tags).toEqual(["archive", "mystery"]);
  expect(metadataPreview.entity.body.discovery.rating).toBe("mature");
  expect(metadataPreview.entity.body.attribution.creator).toBe("Coneja");
});

test("shared character path operation matches editor empty-value semantics", () => {
  const body = character().body as unknown as Record<string, unknown>;
  const updated = writeCharacterPath(body, "identity.tagline", "");
  expect(readCharacterPath(updated, "identity.tagline")).toBeUndefined();
  expect(readCharacterPath(body, "identity.tagline")).toBe("Keeper");
  expect(updated).not.toBe(body);
});

test("presentation, media, and link bundles cover the remaining non-behavior editor surfaces", () => {
  const before = character();
  const presented = presentation.preview(before, presentation.input.parse({
    target: { id: "mira" },
    patch: {
      signatureColor: "#8855aa",
      fieldOrder: ["description", "personality", "scenario"],
      mediaLinks: ["https://example.com/mira"],
    },
  }));
  expect(presented.entity.body.presentation?.signatureColor).toBe("#8855aa");
  expect(presented.entity.body.presentation?.fieldOrder).toEqual([
    "description",
    "personality",
    "scenario",
  ]);

  const withMedia = media.preview(before, media.input.parse({
    target: { id: "mira" },
    patch: {
      portrait: { role: "portrait", ref: "asset://mira", primary: true },
      visualKind: "avatar",
    },
  }));
  expect(withMedia.entity.body.media.portrait?.ref).toBe("asset://mira");

  const linked = links.preview(before, links.input.parse({
    target: { id: "mira" },
    patch: {
      worldName: "Aetheria",
      knowledgeRefs: ["aetheria-lore"],
      behaviorRefs: ["mira-regex"],
    },
  }));
  expect(linked.entity.body.knowledgeRefs).toEqual(["aetheria-lore"]);
  expect(linked.entity.body.behaviorRefs).toEqual(["mira-regex"]);
});

test("variant management and semantic field edits share the canonical character authority", () => {
  const before = character();
  const added = variants.preview(before, variants.input.parse({
    target: { id: "mira" },
    operation: { type: "add", id: "winter", label: "Winter", mode: "mirror" },
  }));
  expect(added.entity.body.variants).toEqual([
    { id: "winter", label: "Winter", overrides: {}, mirrorBase: true },
  ]);

  const changed = identity.preview(added.entity, identity.input.parse({
    target: { id: "mira", variantId: "winter" },
    patch: { tagline: "", nickname: "Snowkeeper" },
  }));
  expect(changed.entity.body.identity.tagline).toBe("Keeper");
  expect(changed.entity.body.variants?.[0]?.overrides).toEqual({
    identity: { tagline: "", nickname: "Snowkeeper" },
  });
  expect(changed.changes.map((change) => change.path)).toEqual([
    "body.variants[id=winter].overrides.identity.nickname",
    "body.variants[id=winter].overrides.identity.tagline",
  ]);

  const inherited = variants.preview(changed.entity, variants.input.parse({
    target: { id: "mira" },
    operation: { type: "inherit-field", id: "winter", path: "identity.tagline" },
  }));
  expect(inherited.entity.body.variants?.[0]?.overrides).toEqual({
    identity: { nickname: "Snowkeeper" },
  });
  expect(inherited.entity.original).toEqual(before.original);
});

test("settings and sealed behavior tools edit authored data without executing or rebuilding siblings", () => {
  const before = character();
  before.body.behavior = {
    defaultVariables: "mood=quiet",
    regexScripts: [
      { label: "Aside", find: "\\((.*?)\\)", replace: "$1", phase: "editdisplay" },
    ],
    triggerScripts: [
      {
        label: "Arrival",
        event: "start",
        conditions: [{ type: "var", var: "met", value: "0", dialectKey: 7 }],
        effects: [{ type: "setvar", var: "met", value: "1", dialectKey: 9 }],
      },
    ],
  };

  const tuned = settings.preview(before, settings.input.parse({
    target: { id: "mira" },
    patch: {
      talkativeness: 0.6,
      defaultVariables: "mood=bright",
      privileged: false,
      bias: [{ phrase: "archive", weight: 1.5 }],
    },
  }));
  expect(tuned.entity.body.settings?.talkativeness).toBe(0.6);
  expect(tuned.entity.body.behavior?.defaultVariables).toBe("mood=bright");
  expect(tuned.entity.body.behavior?.triggerScripts).toEqual(before.body.behavior.triggerScripts);

  const edited = behaviorScripts.preview(tuned.entity, behaviorScripts.input.parse({
    target: { id: "mira" },
    operation: {
      type: "update",
      scriptKind: "trigger",
      index: 0,
      patch: { label: "First arrival" },
    },
  }));
  expect(edited.entity.body.behavior?.triggerScripts?.[0]).toEqual({
    label: "First arrival",
    event: "start",
    conditions: [{ type: "var", var: "met", value: "0", dialectKey: 7 }],
    effects: [{ type: "setvar", var: "met", value: "1", dialectKey: 9 }],
  });
  expect(edited.entity.original).toEqual(before.original);
});
