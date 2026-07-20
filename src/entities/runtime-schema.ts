/**
 * Runtime canonical schemas for every on-disk entity kind. Adapters may use rich compile-time
 * interfaces internally, but JSON crosses storage and HTTP boundaries only through these parsers.
 */
import { z } from "zod";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import type { CanonicalEntity } from "../core/canonical";

const unknownRecord = z.record(z.string(), z.unknown());
const stringArray = z.array(z.string());
const nullableBoolean = z.boolean().nullable();
const nullableNumber = z.number().nullable();
const nullableString = z.string().nullable();

const originalEntrySchema = z.looseObject({
  raw: z.unknown(),
  unmapped: unknownRecord.optional(),
  sourceMedia: z.looseObject({ b64: z.string(), mime: z.string() }).optional(),
});

const wrapper = {
  schemaVersion: z.literal(CANONICAL_SCHEMA_VERSION),
  id: z.string().min(1),
  profiles: z.record(z.string(), unknownRecord).optional(),
  original: z.record(z.string(), originalEntrySchema).optional(),
};

const mediaAssetSchema = z.looseObject({
  role: z.enum(["portrait", "emotion", "outfit", "pose", "background", "other"]),
  ref: z.string(),
  name: z.string().optional(),
  label: z.string().optional(),
  primary: z.boolean().optional(),
  mime: z.string().optional(),
});

const characterBodySchema = z.looseObject({
  identity: z.looseObject({
    name: z.string(),
    nickname: z.string().optional(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    characterVersion: z.string().optional(),
    fullName: z.string().optional(),
    title: z.string().optional(),
    age: z.string().optional(),
    pronouns: z.string().optional(),
    culture: z.string().optional(),
  }),
  persona: z.looseObject({
    personality: z.string().optional(),
    scenario: z.string().optional(),
    appearance: z.string().optional(),
  }),
  prompts: z.looseObject({
    systemPrompt: z.string().optional(),
    postHistoryInstructions: z.string().optional(),
    prefill: z.string().optional(),
    additionalText: z.string().optional(),
    depthInjections: z.array(z.looseObject({
      text: z.string(),
      depth: z.number(),
      role: z.enum(["system", "user", "assistant"]).optional(),
      origin: z.enum(["depth_prompt", "rolecall_details", "worldinfo"]).optional(),
      enabled: z.boolean().optional(),
    })).optional(),
  }),
  greetings: z.looseObject({
    firstMessage: z.string().optional(),
    alternateGreetings: z.array(z.looseObject({ text: z.string(), title: z.string().optional(), id: z.string().optional() })).optional(),
    groupOnlyGreetings: z.array(z.looseObject({ text: z.string(), title: z.string().optional(), id: z.string().optional() })).optional(),
  }),
  examples: z.looseObject({ exampleMessages: z.string().optional() }),
  media: z.looseObject({
    portrait: mediaAssetSchema.optional(),
    assets: z.array(mediaAssetSchema).optional(),
    visualKind: z.string().optional(),
    faceLabel: z.string().optional(),
  }),
  attribution: z.looseObject({
    creator: z.string().optional(),
    originalCreator: z.string().optional(),
    source: stringArray.optional(),
    sourceUrl: z.string().optional(),
    license: z.string().optional(),
    creatorNotes: z.string().optional(),
    creatorNotesMultilingual: z.record(z.string(), z.string()).optional(),
    publicNote: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
  }),
  discovery: z.looseObject({
    tags: stringArray.optional(),
    genre: z.string().optional(),
    fandom: z.string().optional(),
    rating: z.enum(["all-ages", "mature", "explicit"]).optional(),
    contentWarnings: stringArray.optional(),
  }),
  worldName: z.string().optional(),
  knowledgeRefs: stringArray.optional(),
  behaviorRefs: stringArray.optional(),
});

const triggerSchema = z.looseObject({
  keyword: z.string(),
  isRegex: z.boolean(),
  flags: z.string().optional(),
  frequency: z.number().optional(),
  probability: z.number().optional(),
});

const lorebookEntrySchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  comment: nullableString.optional(),
  enabled: z.boolean(),
  constant: z.boolean(),
  triggerMode: z.enum(["simple", "advanced"]),
  triggers: z.array(triggerSchema),
  secondaryTriggers: z.array(triggerSchema),
  selectiveLogic: z.enum(["and_any", "and_all", "not_any", "not_all"]),
  caseSensitive: nullableBoolean,
  matchWholeWords: nullableBoolean,
  scanDepth: nullableNumber,
  position: z.enum(["world", "character", "before_example", "after_example", "depth", "append", "append_bottom", "prepend_top", "scene"]),
  depth: z.number(),
  role: z.enum(["system", "user", "assistant"]),
  sortOrder: z.number(),
  priority: z.number(),
  sticky: z.number(),
  cooldown: z.number(),
  delay: z.number(),
  groupName: nullableString,
  categoryId: nullableString,
  groupWeight: z.number(),
  probability: z.number(),
  useMemo: z.boolean(),
  excludeRecursion: z.boolean(),
  preventRecursion: z.boolean(),
  delayUntilRecursion: z.number(),
  characterFilter: z.looseObject({ names: stringArray, tags: stringArray, isExclude: z.boolean() }).nullable(),
  scanCharacterDescription: z.boolean(),
  scanCharacterPersonality: z.boolean(),
  scanUserPersona: z.boolean(),
  scanScenario: z.boolean(),
  ignoreBudget: z.boolean(),
  sideEffects: z.looseObject({
    effects: z.array(z.looseObject({
      type: z.enum(["setvar", "addvar", "incvar", "decvar", "delvar"]),
      variable: z.string(),
      value: z.string().optional(),
      amount: z.number().optional(),
      scope: z.enum(["local", "global"]),
    })),
    onlyOnFirstTrigger: z.boolean(),
    clearOnDeactivate: z.boolean(),
  }).nullable(),
});

const lorebookBodySchema = z.looseObject({
  name: z.string(),
  description: nullableString.optional(),
  tags: stringArray,
  globalCaseSensitive: z.boolean(),
  globalMatchWholeWords: z.boolean(),
  globalScanDepth: z.number(),
  globalRecursion: z.boolean(),
  tokenBudget: z.number(),
  budgetMode: z.enum(["token", "entry"]),
  entryBudget: z.number(),
  entries: z.array(lorebookEntrySchema),
  categories: z.array(z.looseObject({
    id: z.string(),
    name: z.string(),
    sortOrder: z.number(),
    enabled: z.boolean().optional(),
  })).optional(),
});

const personaBodySchema = z.looseObject({
  name: z.string(),
  brief: z.string().optional(),
  content: z.string(),
  sectionOrder: stringArray.optional(),
  traits: stringArray.optional(),
  knowledgeRefs: stringArray.optional(),
  rating: z.enum(["all-ages", "mature", "explicit"]).optional(),
});

const regexRuleSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  find: z.string(),
  flags: z.string(),
  replace: z.string(),
  phases: stringArray,
  enabled: z.boolean(),
  sortOrder: z.number(),
});

const regexBodySchema = z.looseObject({
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  rules: z.array(regexRuleSchema),
});

const presetPromptSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  role: z.enum(["system", "user", "assistant"]),
  enabled: z.boolean(),
  systemPrompt: z.boolean(),
  marker: z.boolean(),
  placement: z.string(),
  injectionDepth: z.number(),
  injectionOrder: z.number(),
  forbidOverrides: z.boolean(),
});

const presetBodySchema = z.looseObject({
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  prompts: z.array(presetPromptSchema),
});

const spritePackSchema = z.looseObject({
  enabled: z.boolean().optional(),
  defaultLabel: z.string().optional(),
  items: z.array(z.looseObject({
    id: z.string(),
    label: z.string(),
    ref: z.string(),
    mime: z.string().optional(),
  })),
});

const packBodySchema = z.looseObject({
  name: z.string(),
  brief: z.string().optional(),
  pack: spritePackSchema,
  groups: z.record(z.string(), spritePackSchema).optional(),
});

export const canonicalEntitySchema = z.discriminatedUnion("kind", [
  z.looseObject({ ...wrapper, kind: z.literal("character"), body: characterBodySchema }),
  z.looseObject({ ...wrapper, kind: z.literal("lorebook"), body: lorebookBodySchema }),
  z.looseObject({ ...wrapper, kind: z.literal("persona"), body: personaBodySchema }),
  z.looseObject({ ...wrapper, kind: z.literal("preset"), body: presetBodySchema }),
  z.looseObject({ ...wrapper, kind: z.literal("regex"), body: regexBodySchema }),
  z.looseObject({ ...wrapper, kind: z.literal("pack"), body: packBodySchema }),
]);

export type ParsedCanonicalEntity = CanonicalEntity<string, unknown>;

/** Parse untrusted JSON once into the known canonical union. */
export function parseCanonicalEntity(raw: unknown): ParsedCanonicalEntity {
  return canonicalEntitySchema.parse(raw) as ParsedCanonicalEntity;
}

/** Non-throwing detector for request boundaries that need a 400 response. */
export function safeParseCanonicalEntity(raw: unknown):
  | { ok: true; entity: ParsedCanonicalEntity }
  | { ok: false; issues: string[] } {
  const parsed = canonicalEntitySchema.safeParse(raw);
  if (parsed.success) return { ok: true, entity: parsed.data as ParsedCanonicalEntity };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "entity"}: ${issue.message}`),
  };
}
