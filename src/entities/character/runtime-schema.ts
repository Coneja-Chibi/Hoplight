/** Strict runtime decoders for canonical character bodies, variants, and authored nested controls. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { characterRegexScriptSchema } from "../regex/runtime-schema";
import type {
  Attribution,
  Background,
  CharacterBehavior,
  CharacterBody,
  CharacterSettings,
  CharacterVariant,
  DeepPartial,
  DepthInjection,
  Discovery,
  Examples,
  Greeting,
  Greetings,
  Identity,
  ImagePrompt,
  Media,
  MediaAsset,
  Persona,
  Presentation,
  Prompts,
  Sprite,
  Swatch,
  TriggerScript,
  Voice,
} from "./schema";

const stringArray = z.array(z.string());
const unknownRecord = z.record(z.string(), z.unknown());
type ImagePromptRow = NonNullable<ImagePrompt["rows"]>[number];
type StructuredPersona = NonNullable<Persona["structured"]>;
type StructuredTextPersona = Extract<StructuredPersona, { kind: "text" }>;
type StructuredAttributePersona = Exclude<StructuredPersona, StructuredTextPersona>;
type PresentationSpoilers = NonNullable<Presentation["spoilers"]>;
type RisuSettings = NonNullable<CharacterSettings["risu"]>;
type PrebuiltAsset = NonNullable<CharacterBehavior["prebuiltAsset"]>;
type CharacterBias = NonNullable<CharacterBody["bias"]>[number];
type CharacterOverrides = DeepPartial<Omit<CharacterBody, "variants">>;
type PersonaOverrides = NonNullable<CharacterOverrides["persona"]>;
type MediaOverrides = NonNullable<CharacterOverrides["media"]>;

const identityShape = defineExhaustiveShape<Identity>()({
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
});
const identitySchema = z.strictObject(identityShape);

const voiceShape = defineExhaustiveShape<Voice>()({
  provider: z.string(),
  voiceId: z.string().optional(),
  rate: z.number().optional(),
  pitch: z.number().optional(),
  disabled: z.boolean().optional(),
  extras: unknownRecord.optional(),
});
const voiceSchema = z.strictObject(voiceShape);

const imagePromptRowShape = defineExhaustiveShape<ImagePromptRow>()({
  label: z.string(),
  value: z.string(),
});
const imagePromptRowSchema = z.strictObject(imagePromptRowShape);
const imagePromptShape = defineExhaustiveShape<ImagePrompt>()({
  prompt: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  negative: z.string().optional(),
  template: z.string().optional(),
  instructions: z.string().optional(),
  emotionInstructions: z.string().optional(),
  rows: z.array(imagePromptRowSchema).optional(),
});
const imagePromptSchema = z.strictObject(imagePromptShape);

const structuredTextShape = defineExhaustiveShape<StructuredTextPersona>()({
  kind: z.literal("text"),
});
const structuredAttributeShape = defineExhaustiveShape<StructuredAttributePersona>()({
  kind: z.enum(["attributes", "wpp", "sbf", "boostyle"]),
  attributes: z.record(z.string(), stringArray),
});
const structuredPersonaSchema = z.union([
  z.strictObject(structuredTextShape),
  z.strictObject(structuredAttributeShape),
]);

const personaShape = defineExhaustiveShape<Persona>()({
  personality: z.string().optional(),
  scenario: z.string().optional(),
  appearance: z.string().optional(),
  voice: voiceSchema.optional(),
  imagePrompt: imagePromptSchema.optional(),
  structured: structuredPersonaSchema.optional(),
});
const personaSchema = z.strictObject(personaShape);

const injectionShape = defineExhaustiveShape<DepthInjection>()({
  text: z.string(),
  depth: z.number(),
  role: z.enum(["system", "user", "assistant"]).optional(),
  origin: z.enum(["depth_prompt", "rolecall_details", "worldinfo"]).optional(),
  enabled: z.boolean().optional(),
});
const depthInjectionSchema = z.strictObject(injectionShape);

const promptsShape = defineExhaustiveShape<Prompts>()({
  systemPrompt: z.string().optional(),
  postHistoryInstructions: z.string().optional(),
  depthInjections: z.array(depthInjectionSchema).optional(),
  prefill: z.string().optional(),
  additionalText: z.string().optional(),
});
const promptsSchema = z.strictObject(promptsShape);

const greetingShape = defineExhaustiveShape<Greeting>()({
  text: z.string(),
  title: z.string().optional(),
  id: z.string().optional(),
});
const greetingSchema = z.strictObject(greetingShape);

const greetingsShape = defineExhaustiveShape<Greetings>()({
  firstMessage: z.string().optional(),
  alternateGreetings: z.array(greetingSchema).optional(),
  groupOnlyGreetings: z.array(greetingSchema).optional(),
});
const greetingsSchema = z.strictObject(greetingsShape);

const examplesShape = defineExhaustiveShape<Examples>()({
  exampleMessages: z.string().optional(),
});
const examplesSchema = z.strictObject(examplesShape);

const attributionShape = defineExhaustiveShape<Attribution>()({
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
});
const attributionSchema = z.strictObject(attributionShape);

const discoveryShape = defineExhaustiveShape<Discovery>()({
  tags: stringArray.optional(),
  genre: z.string().optional(),
  fandom: z.string().optional(),
  rating: z.enum(["all-ages", "mature", "explicit"]).optional(),
  contentWarnings: stringArray.optional(),
});
const discoverySchema = z.strictObject(discoveryShape);

const mediaAssetShape = defineExhaustiveShape<MediaAsset>()({
  role: z.enum(["portrait", "emotion", "outfit", "pose", "background", "other"]),
  name: z.string().optional(),
  label: z.string().optional(),
  primary: z.boolean().optional(),
  ref: z.string(),
  mime: z.string().optional(),
});
export const mediaAssetSchema = z.strictObject(mediaAssetShape);

const spriteShape = defineExhaustiveShape<Sprite>()({
  parts: z.record(z.string(), z.string()),
  gender: z.string().optional(),
  eyeColor: z.string().optional(),
  bodyColor: z.string().optional(),
  hairColor: z.string().optional(),
});
const spriteSchema = z.strictObject(spriteShape);

const mediaShape = defineExhaustiveShape<Media>()({
  portrait: mediaAssetSchema.optional(),
  assets: z.array(mediaAssetSchema).optional(),
  sprite: spriteSchema.optional(),
  visualKind: z.string().optional(),
  faceLabel: z.string().optional(),
});
const mediaSchema = z.strictObject(mediaShape);

const swatchShape = defineExhaustiveShape<Swatch>()({
  label: z.string().optional(),
  name: z.string().optional(),
  hex: z.string(),
});
export const swatchSchema = z.strictObject(swatchShape);

const backgroundShape = defineExhaustiveShape<Background>()({
  ref: z.string(),
  overlayOpacity: z.number().optional(),
  videoPlaybackRate: z.number().optional(),
});
const backgroundSchema = z.strictObject(backgroundShape);

const spoilersShape = defineExhaustiveShape<PresentationSpoilers>()({
  mode: z.string().optional(),
  order: stringArray.optional(),
  fields: z.record(z.string(), z.boolean()).optional(),
});
const spoilersSchema = z.strictObject(spoilersShape);
const presentationShape = defineExhaustiveShape<Presentation>()({
  signatureColor: z.string().optional(),
  gradientColors: stringArray.optional(),
  palette: z.array(swatchSchema).optional(),
  background: backgroundSchema.optional(),
  fieldOrder: stringArray.optional(),
  spoilers: spoilersSchema.optional(),
  mediaLinks: stringArray.optional(),
});
const presentationSchema = z.strictObject(presentationShape);

const risuSettingsShape = defineExhaustiveShape<RisuSettings>()({
  viewScreen: z.string().optional(),
  largePortrait: z.boolean().optional(),
  inlayViewScreen: z.boolean().optional(),
  utilityBot: z.boolean().optional(),
  lorePlus: z.boolean().optional(),
});
const risuSettingsSchema = z.strictObject(risuSettingsShape);
const settingsShape = defineExhaustiveShape<CharacterSettings>()({
  talkativeness: z.number().optional(),
  risu: risuSettingsSchema.optional(),
  responseSchema: unknownRecord.optional(),
});
const settingsSchema = z.strictObject(settingsShape);

const triggerScriptShape = defineExhaustiveShape<TriggerScript>()({
  label: z.string().optional(),
  event: z.string(),
  conditions: z.array(z.unknown()),
  effects: z.array(z.unknown()),
});
const triggerScriptSchema = z.strictObject(triggerScriptShape);

const prebuiltAssetShape = defineExhaustiveShape<PrebuiltAsset>()({
  command: z.string().optional(),
  exclude: stringArray.optional(),
  style: z.string().optional(),
});
const prebuiltAssetSchema = z.strictObject(prebuiltAssetShape);
const behaviorShape = defineExhaustiveShape<CharacterBehavior>()({
  regexScripts: z.array(characterRegexScriptSchema).optional(),
  triggerScripts: z.array(triggerScriptSchema).optional(),
  virtualScript: z.string().optional(),
  backgroundHTML: z.string().optional(),
  backgroundCSS: z.string().optional(),
  defaultVariables: z.string().optional(),
  prebuiltAsset: prebuiltAssetSchema.optional(),
  moduleToggles: z.string().optional(),
  privileged: z.boolean().optional(),
});
const behaviorSchema = z.strictObject(behaviorShape);

const biasShape = defineExhaustiveShape<CharacterBias>()({
  phrase: z.string(),
  weight: z.number(),
});
const biasSchema = z.strictObject(biasShape);

const baseShape = defineExhaustiveShape<Omit<CharacterBody, "variants">>()({
  identity: identitySchema,
  persona: personaSchema,
  prompts: promptsSchema,
  greetings: greetingsSchema,
  examples: examplesSchema,
  media: mediaSchema,
  attribution: attributionSchema,
  discovery: discoverySchema,
  presentation: presentationSchema.optional(),
  settings: settingsSchema.optional(),
  bias: z.array(biasSchema).optional(),
  worldName: z.string().optional(),
  knowledgeRefs: stringArray.optional(),
  behavior: behaviorSchema.optional(),
  behaviorRefs: stringArray.optional(),
});

const personaOverrideShape = defineExhaustiveShape<PersonaOverrides>()({
  personality: z.string().optional(),
  scenario: z.string().optional(),
  appearance: z.string().optional(),
  voice: voiceSchema.optional(),
  imagePrompt: imagePromptSchema.optional(),
  structured: structuredPersonaSchema.optional(),
});
const personaOverrideSchema = z.strictObject(personaOverrideShape);
const mediaOverrideShape = defineExhaustiveShape<MediaOverrides>()({
  portrait: mediaAssetSchema.optional(),
  assets: z.array(mediaAssetSchema).optional(),
  sprite: spriteSchema.optional(),
  visualKind: z.string().optional(),
  faceLabel: z.string().optional(),
});
const mediaOverrideSchema = z.strictObject(mediaOverrideShape);
const overrideShape = defineExhaustiveShape<CharacterOverrides>()({
  identity: identitySchema.partial().optional(),
  persona: personaOverrideSchema.optional(),
  prompts: promptsSchema.partial().optional(),
  greetings: greetingsSchema.partial().optional(),
  examples: examplesSchema.partial().optional(),
  media: mediaOverrideSchema.optional(),
  attribution: attributionSchema.partial().optional(),
  discovery: discoverySchema.partial().optional(),
  presentation: presentationSchema.optional(),
  settings: settingsSchema.optional(),
  bias: z.array(biasSchema).optional(),
  worldName: z.string().optional(),
  knowledgeRefs: stringArray.optional(),
  behavior: behaviorSchema.optional(),
  behaviorRefs: stringArray.optional(),
});
const overrideSchema = z.strictObject(overrideShape);

const variantShape = defineExhaustiveShape<CharacterVariant>()({
  id: z.string(),
  label: z.string().optional(),
  mirrorBase: z.boolean().optional(),
  overrides: overrideSchema,
});
const variantSchema = z.strictObject(variantShape);

const bodyShape = defineExhaustiveShape<CharacterBody>()({
  ...baseShape,
  variants: z.array(variantSchema).optional(),
});

export const characterBodySchema = z.strictObject(bodyShape);
export const characterProfileSchema = characterBodySchema.partial();
