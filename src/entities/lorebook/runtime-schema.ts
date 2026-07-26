/** Strict runtime decoders for canonical lorebook bodies and every authored nested control. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import type {
  CharacterFilter,
  EntryContextConfig,
  EntrySideEffect,
  EntrySideEffects,
  LoreBiasGroup,
  LoreBiasPhrase,
  LorebookBody,
  LorebookCategory,
  LorebookEntry,
  Trigger,
} from "./schema";

const stringArray = z.array(z.string());
const unknownRecord = z.record(z.string(), z.unknown());

const triggerShape = defineExhaustiveShape<Trigger>()({
  keyword: z.string(),
  isRegex: z.boolean(),
  flags: z.string().optional(),
  frequency: z.number().optional(),
  probability: z.number().optional(),
});
const triggerSchema = z.strictObject(triggerShape);

const filterShape = defineExhaustiveShape<CharacterFilter>()({
  names: stringArray,
  tags: stringArray,
  isExclude: z.boolean(),
});
const characterFilterSchema = z.strictObject(filterShape);

const sideEffectShape = defineExhaustiveShape<EntrySideEffect>()({
  type: z.enum(["setvar", "addvar", "incvar", "decvar", "delvar"]),
  variable: z.string(),
  value: z.string().optional(),
  amount: z.number().optional(),
  scope: z.enum(["local", "global"]),
});
const sideEffectSchema = z.strictObject(sideEffectShape);

const sideEffectsShape = defineExhaustiveShape<EntrySideEffects>()({
  effects: z.array(sideEffectSchema),
  onlyOnFirstTrigger: z.boolean(),
  clearOnDeactivate: z.boolean(),
});
const sideEffectsSchema = z.strictObject(sideEffectsShape);

const contextShape = defineExhaustiveShape<EntryContextConfig>()({
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  tokenBudget: z.number().optional(),
  reservedTokens: z.number().optional(),
  trimDirection: z.string().optional(),
  insertionType: z.string().optional(),
  maximumTrimType: z.string().optional(),
  insertionPosition: z.number().optional(),
});
const contextSchema = z.strictObject(contextShape);

const biasPhraseShape = defineExhaustiveShape<LoreBiasPhrase>()({
  sequence: z.string().optional(),
  sequences: stringArray.optional(),
  type: z.number().optional(),
});
const biasPhraseSchema = z.strictObject(biasPhraseShape);

const biasGroupShape = defineExhaustiveShape<LoreBiasGroup>()({
  enabled: z.boolean(),
  bias: z.number(),
  phrases: z.array(biasPhraseSchema),
  whenInactive: z.boolean().optional(),
  generateOnce: z.boolean().optional(),
  ensureSequenceFinish: z.boolean().optional(),
});
const biasGroupSchema = z.strictObject(biasGroupShape);

const entryShape = defineExhaustiveShape<LorebookEntry>()({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  comment: z.string().nullable().optional(),
  enabled: z.boolean(),
  constant: z.boolean(),
  triggerMode: z.enum(["simple", "advanced"]),
  triggers: z.array(triggerSchema),
  secondaryTriggers: z.array(triggerSchema),
  selectiveLogic: z.enum(["and_any", "and_all", "not_any", "not_all"]),
  caseSensitive: z.boolean().nullable(),
  matchWholeWords: z.boolean().nullable(),
  scanDepth: z.number().nullable(),
  position: z.enum([
    "world",
    "character",
    "before_example",
    "after_example",
    "depth",
    "append",
    "append_bottom",
    "prepend_top",
    "scene",
  ]),
  depth: z.number(),
  role: z.enum(["system", "user", "assistant"]),
  sortOrder: z.number(),
  priority: z.number(),
  sticky: z.number(),
  cooldown: z.number(),
  delay: z.number(),
  groupName: z.string().nullable(),
  categoryId: z.string().nullable(),
  groupWeight: z.number(),
  probability: z.number(),
  useMemo: z.boolean(),
  excludeRecursion: z.boolean(),
  preventRecursion: z.boolean(),
  delayUntilRecursion: z.number(),
  characterFilter: characterFilterSchema.nullable(),
  scanCharacterDescription: z.boolean(),
  scanCharacterPersonality: z.boolean(),
  scanUserPersona: z.boolean(),
  scanScenario: z.boolean(),
  scanCharacterDepthPrompt: z.boolean().optional(),
  scanCreatorNotes: z.boolean().optional(),
  ignoreBudget: z.boolean(),
  vectorized: z.boolean().optional(),
  groupOverride: z.boolean().optional(),
  useGroupScoring: z.boolean().optional(),
  automationId: z.string().nullable().optional(),
  keyRelative: z.boolean().optional(),
  nonStoryActivatable: z.boolean().optional(),
  contextConfig: contextSchema.optional(),
  loreBiasGroups: z.array(biasGroupSchema).optional(),
  displayIndex: z.number().nullable().optional(),
  sideEffects: sideEffectsSchema.nullable(),
  metadata: unknownRecord.optional(),
});

export const lorebookEntrySchema = z.strictObject(entryShape);

const categoryShape = defineExhaustiveShape<LorebookCategory>()({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  enabled: z.boolean().optional(),
});
const categorySchema = z.strictObject(categoryShape);

const bodyShape = defineExhaustiveShape<LorebookBody>()({
  name: z.string(),
  description: z.string().nullable().optional(),
  lorebookType: z.enum(["world", "character", "scenario", "rules", "utility", "other"]).nullable().optional(),
  genre: z.string().nullable().optional(),
  fandom: z.string().nullable().optional(),
  tags: stringArray,
  enabled: z.boolean().optional(),
  globalCaseSensitive: z.boolean(),
  globalMatchWholeWords: z.boolean(),
  globalScanDepth: z.number(),
  globalRecursion: z.boolean(),
  tokenBudget: z.number(),
  budgetMode: z.enum(["token", "entry"]),
  entryBudget: z.number(),
  entries: z.array(lorebookEntrySchema),
  categories: z.array(categorySchema).optional(),
});

export const lorebookBodySchema = z.strictObject(bodyShape);
export const lorebookProfileSchema = lorebookBodySchema.partial();
