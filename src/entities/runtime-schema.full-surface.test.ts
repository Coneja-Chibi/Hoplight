/**
 * Full-surface parse and malformed-family coverage for all canonical entity kinds.
 */
import { describe, expect, test } from "bun:test";
import {
  fullCharacter,
  fullLorebook,
  fullPack,
  fullPersona,
  fullPreset,
  fullRegex,
  fullSurfaceEntities,
} from "./runtime-schema.full-surface.fixtures";
import { safeParseCanonicalEntity } from "./runtime-schema";

type Path = readonly (string | number)[];
type MalformedCase = {
  entity: unknown;
  path: Path;
  value: unknown;
  issue?: string;
};

const replaceAt = (entity: unknown, path: Path, value: unknown): unknown => {
  const copy = structuredClone(entity) as Record<string | number, unknown>;
  let cursor = copy;
  for (const segment of path.slice(0, -1)) {
    cursor = cursor[segment] as Record<string | number, unknown>;
  }
  cursor[path.at(-1)!] = value;
  return copy;
};

const malformed: readonly MalformedCase[] = [
  { entity: fullCharacter, path: ["body", "persona", "voice", "provider"], value: 1 },
  { entity: fullCharacter, path: ["body", "persona", "imagePrompt", "rows", 0, "label"], value: 1 },
  {
    entity: fullCharacter,
    path: ["body", "persona", "structured", "attributes", "temperament"],
    value: "wrong",
    issue: "body.persona.structured",
  },
  { entity: fullCharacter, path: ["body", "media", "sprite", "parts", "hair"], value: 1 },
  { entity: fullCharacter, path: ["body", "presentation", "spoilers", "fields", "history"], value: "yes" },
  { entity: fullCharacter, path: ["body", "settings", "risu", "largePortrait"], value: "yes" },
  { entity: fullCharacter, path: ["body", "bias", 0, "weight"], value: "heavy" },
  { entity: fullCharacter, path: ["body", "behavior", "prebuiltAsset", "exclude"], value: "blur" },
  { entity: fullCharacter, path: ["body", "variants", 0, "overrides", "identity", "nickname"], value: 1 },

  { entity: fullLorebook, path: ["body", "description"], value: 1 },
  { entity: fullLorebook, path: ["body", "categories", 0, "enabled"], value: "yes" },
  { entity: fullLorebook, path: ["body", "entries", 0, "triggers", 0, "probability"], value: "often" },
  { entity: fullLorebook, path: ["body", "entries", 0, "characterFilter", "names"], value: "Mira" },
  { entity: fullLorebook, path: ["body", "entries", 0, "contextConfig", "reservedTokens"], value: "many" },
  { entity: fullLorebook, path: ["body", "entries", 0, "loreBiasGroups", 0, "phrases", 0, "sequences"], value: "archive" },
  { entity: fullLorebook, path: ["body", "entries", 0, "displayIndex"], value: "first" },
  { entity: fullLorebook, path: ["body", "entries", 0, "sideEffects", "effects", 0, "amount"], value: "one" },

  { entity: fullPersona, path: ["body", "sections", "history"], value: 1 },
  { entity: fullPersona, path: ["body", "sectionOrder"], value: "history" },
  { entity: fullPersona, path: ["body", "identity", "age"], value: 31 },
  { entity: fullPersona, path: ["body", "presentation", "colors", 0, "hex"], value: 1 },
  { entity: fullPersona, path: ["body", "knowledgeRefs"], value: "aetheria" },
  { entity: fullPersona, path: ["body", "rating"], value: "unknown" },
  { entity: fullPersona, path: ["body", "chatInjection", "depth"], value: "one" },
  { entity: fullPersona, path: ["body", "attribution", "createdAt"], value: 1 },
  { entity: fullPersona, path: ["body", "media", "portrait", "role"], value: "avatar" },

  { entity: fullPreset, path: ["body", "prompts", 0, "marker"], value: "no" },
  { entity: fullPreset, path: ["body", "groups", 0, "order"], value: "first" },
  { entity: fullPreset, path: ["body", "samplers", "topP"], value: "high" },
  { entity: fullPreset, path: ["body", "systemPrompts", "newChat"], value: 1 },
  { entity: fullPreset, path: ["body", "templates", "scenarioFormat"], value: 1 },
  { entity: fullPreset, path: ["body", "behavior", "continuePrefill"], value: "yes" },
  { entity: fullPreset, path: ["body", "apiOptions", "functionCalling"], value: "yes" },
  { entity: fullPreset, path: ["body", "media", "imageInlining"], value: "yes" },
  { entity: fullPreset, path: ["body", "generation", "seed"], value: "random" },
  { entity: fullPreset, path: ["body", "choices", 0, "options", 0, "set", "local:tone"], value: 1 },

  { entity: fullRegex, path: ["body", "rules", 0, "note"], value: 1 },
  { entity: fullRegex, path: ["body", "rules", 0, "useFlags"], value: "yes" },
  { entity: fullRegex, path: ["body", "rules", 0, "trimStrings"], value: "ignore" },
  { entity: fullRegex, path: ["body", "rules", 0, "phases"], value: "output" },
  { entity: fullRegex, path: ["body", "rules", 0, "targets", 0], value: "memory" },
  { entity: fullRegex, path: ["body", "rules", 0, "substituteFind"], value: "future" },
  { entity: fullRegex, path: ["body", "rules", 0, "minDepth"], value: "zero" },
  { entity: fullRegex, path: ["body", "rules", 0, "runOnEdit"], value: "yes" },
  { entity: fullRegex, path: ["body", "rules", 0, "characterIds"], value: "mira" },
  { entity: fullRegex, path: ["body", "rules", 0, "firstMatchOnly"], value: "no" },
  { entity: fullRegex, path: ["body", "rules", 0, "condition", "ruleId"], value: 1 },
  { entity: fullRegex, path: ["body", "rules", 0, "overlay"], value: "no" },

  { entity: fullPack, path: ["body", "brief"], value: 1 },
  { entity: fullPack, path: ["body", "pack", "enabled"], value: "yes" },
  { entity: fullPack, path: ["body", "pack", "defaultLabel"], value: 1 },
  { entity: fullPack, path: ["body", "pack", "items", 0, "mime"], value: 1 },
  { entity: fullPack, path: ["body", "groups", "mira", "items", 0, "ref"], value: 1 },
];

describe("full canonical runtime surfaces", () => {
  test("parse every populated kind without stripping declared open data", () => {
    for (const entity of fullSurfaceEntities) {
      const parsed = safeParseCanonicalEntity(entity);
      expect(parsed.ok, entity.kind).toBe(true);
      if (parsed.ok) expect(parsed.entity).toEqual(entity);
    }
  });

  test("reject malformed values across every nested field family", () => {
    for (const row of malformed) {
      const parsed = safeParseCanonicalEntity(replaceAt(row.entity, row.path, row.value));
      const label = row.path.join(".");
      expect(parsed.ok, label).toBe(false);
      if (!parsed.ok) expect(parsed.issues.join(" "), label).toContain(row.issue ?? label);
    }
  });

  test("validate profiles with their matching body schema", () => {
    const rows = [
      { entity: fullCharacter, valid: { worldName: "variant" }, invalid: { settings: "wrong" }, issue: "settings" },
      { entity: fullLorebook, valid: { description: "variant" }, invalid: { entries: "wrong" }, issue: "entries" },
      { entity: fullPersona, valid: { brief: "variant" }, invalid: { identity: "wrong" }, issue: "identity" },
      { entity: fullPreset, valid: { description: "variant" }, invalid: { samplers: "wrong" }, issue: "samplers" },
      { entity: fullRegex, valid: { description: "variant" }, invalid: { rules: "wrong" }, issue: "rules" },
      { entity: fullPack, valid: { brief: "variant" }, invalid: { pack: "wrong" }, issue: "pack" },
    ] as const;

    for (const row of rows) {
      expect(safeParseCanonicalEntity({
        ...row.entity,
        profiles: { target: row.valid },
      }).ok, `${row.entity.kind} valid profile`).toBe(true);

      const invalid = safeParseCanonicalEntity({
        ...row.entity,
        profiles: { target: row.invalid },
      });
      expect(invalid.ok, `${row.entity.kind} invalid profile`).toBe(false);
      if (!invalid.ok) expect(invalid.issues.join(" ")).toContain(row.issue);
    }
  });
});
