/** Strict runtime decoders for canonical preset bodies and authored walkthrough choices. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import type {
  PresetApiOptions,
  PresetBehavior,
  PresetBody,
  PresetChoice,
  PresetChoiceOption,
  PresetGeneration,
  PresetGroup,
  PresetMedia,
  PresetPrompt,
  PresetSamplers,
  PresetSystemPrompts,
  PresetTemplates,
} from "./schema";

const stringArray = z.array(z.string());
const unknownRecord = z.record(z.string(), z.unknown());

const promptShape = defineExhaustiveShape<PresetPrompt>()({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  role: z.enum(["system", "user", "assistant", "tool"]),
  enabled: z.boolean(),
  systemPrompt: z.boolean(),
  marker: z.boolean(),
  markerSlot: z.string().optional(),
  placement: z.string(),
  injectionDepth: z.number(),
  injectionOrder: z.number(),
  forbidOverrides: z.boolean(),
  injectionTrigger: stringArray.optional(),
  isDefault: z.boolean().optional(),
  groupId: z.string().optional(),
  wrapInXml: z.boolean().optional(),
  xmlTagName: z.string().optional(),
  extras: unknownRecord.optional(),
});
const promptSchema = z.strictObject(promptShape);

const groupShape = defineExhaustiveShape<PresetGroup>()({
  id: z.string(),
  name: z.string(),
  content: z.string().optional(),
  parentGroupId: z.string().optional(),
  order: z.number().optional(),
  enabled: z.boolean().optional(),
  extras: unknownRecord.optional(),
});
const groupSchema = z.strictObject(groupShape);

const samplerShape = defineExhaustiveShape<PresetSamplers>()({
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  topA: z.number().optional(),
  minP: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  presencePenalty: z.number().optional(),
  repetitionPenalty: z.number().optional(),
  maxContext: z.number().optional(),
  maxTokens: z.number().optional(),
  promptPostProcessing: z.enum(["none", "merge", "merge_tools", "semi", "semi_tools", "strict", "strict_tools", "single", "claude"]).optional(),
  contextMode: z.enum(["tokens", "messages"]).optional(),
  maxMessages: z.number().optional(),
});
export const samplerSchema = z.strictObject(samplerShape);

const systemPromptShape = defineExhaustiveShape<PresetSystemPrompts>()({
  impersonation: z.string().optional(),
  newChat: z.string().optional(),
  newGroupChat: z.string().optional(),
  newExampleChat: z.string().optional(),
  continueNudge: z.string().optional(),
  groupNudge: z.string().optional(),
  assistantPrefill: z.string().optional(),
  assistantImpersonation: z.string().optional(),
});
export const systemPromptSchema = z.strictObject(systemPromptShape);

const templateShape = defineExhaustiveShape<PresetTemplates>()({
  worldInfoFormat: z.string().optional(),
  scenarioFormat: z.string().optional(),
  personalityFormat: z.string().optional(),
});
export const templateSchema = z.strictObject(templateShape);

const behaviorShape = defineExhaustiveShape<PresetBehavior>()({
  wrapInQuotes: z.boolean().optional(),
  namesBehavior: z.number().optional(),
  sendIfEmpty: z.string().optional(),
  continuePrefill: z.boolean().optional(),
  continuePostfix: z.string().optional(),
});
export const behaviorSchema = z.strictObject(behaviorShape);

const apiShape = defineExhaustiveShape<PresetApiOptions>()({
  streamResponses: z.boolean().optional(),
  claudeUseSystemPrompt: z.boolean().optional(),
  useMakerSuiteSystemPrompt: z.boolean().optional(),
  squashSystemMessages: z.boolean().optional(),
  functionCalling: z.boolean().optional(),
  showThoughts: z.boolean().optional(),
  reasoningEffort: z.string().optional(),
  enableWebSearch: z.boolean().optional(),
  requestImages: z.boolean().optional(),
});
export const apiSchema = z.strictObject(apiShape);

const mediaShape = defineExhaustiveShape<PresetMedia>()({
  imageInlining: z.boolean().optional(),
  inlineImageQuality: z.string().optional(),
  videoInlining: z.boolean().optional(),
});
export const mediaSchema = z.strictObject(mediaShape);

const generationShape = defineExhaustiveShape<PresetGeneration>()({
  seed: z.number().optional(),
  completions: z.number().optional(),
  maxContextUnlocked: z.boolean().optional(),
  biasPreset: z.string().optional(),
});
export const generationSchema = z.strictObject(generationShape);

const optionShape = defineExhaustiveShape<PresetChoiceOption>()({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  value: z.string().optional(),
  enablesPrompts: stringArray.optional(),
  set: z.record(z.string(), z.string()).optional(),
});
const optionSchema = z.strictObject(optionShape);

const choiceShape = defineExhaustiveShape<PresetChoice>()({
  id: z.string(),
  key: z.string().optional(),
  label: z.string(),
  readme: z.string().optional(),
  type: z.enum(["one", "many", "toggle", "input"]),
  options: z.array(optionSchema),
  default: z.union([z.string(), stringArray, z.boolean()]).optional(),
  min: z.number().optional(),
  placeholder: z.string().optional(),
  suggestions: stringArray.optional(),
  separator: z.string().optional(),
  randomPick: z.boolean().optional(),
  sortOrder: z.number().optional(),
  extras: unknownRecord.optional(),
});
const choiceSchema = z.strictObject(choiceShape);

const bodyShape = defineExhaustiveShape<PresetBody>()({
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  prompts: z.array(promptSchema),
  groups: z.array(groupSchema).optional(),
  samplers: samplerSchema.optional(),
  systemPrompts: systemPromptSchema.optional(),
  templates: templateSchema.optional(),
  behavior: behaviorSchema.optional(),
  apiOptions: apiSchema.optional(),
  media: mediaSchema.optional(),
  generation: generationSchema.optional(),
  choices: z.array(choiceSchema).optional(),
  // Linked regex/script sets. Optional and additive: a preset saved before this field existed still
  // parses, which is what keeps the schema change from being a migration.
  behaviorRefs: z.array(z.string().min(1)).optional(),
  // Linked quick-reply sets, the same additive shape for the same reason.
  quickReplyRefs: z.array(z.string().min(1)).optional(),
});

export const presetBodySchema = z.strictObject(bodyShape);
export const presetProfileSchema = presetBodySchema.partial();
