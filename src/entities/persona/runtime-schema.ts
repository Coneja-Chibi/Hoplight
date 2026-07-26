/** Strict runtime decoders for canonical persona bodies. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { mediaAssetSchema, swatchSchema } from "../character/runtime-schema";
import type {
  PersonaAttribution,
  PersonaBody,
  PersonaChatInjection,
  PersonaIdentity,
  PersonaPresentation,
  PersonaPronounSet,
  PersonaSections,
} from "./schema";

const stringArray = z.array(z.string());
type PersonaMedia = NonNullable<PersonaBody["media"]>;

const sectionsShape = defineExhaustiveShape<PersonaSections>()({
  appearance: z.string().optional(),
  body: z.string().optional(),
  personality: z.string().optional(),
  quirks: z.string().optional(),
  history: z.string().optional(),
});
const sectionsSchema = z.strictObject(sectionsShape);

const pronounShape = defineExhaustiveShape<PersonaPronounSet>()({
  subjective: z.string(),
  objective: z.string(),
  possessive: z.string(),
});
const pronounSchema = z.strictObject(pronounShape);

const identityShape = defineExhaustiveShape<PersonaIdentity>()({
  tagline: z.string().optional(),
  age: z.string().optional(),
  height: z.string().optional(),
  pronouns: z.string().optional(),
  pronounSet: pronounSchema.optional(),
});
const identitySchema = z.strictObject(identityShape);

const presentationShape = defineExhaustiveShape<PersonaPresentation>()({
  signatureColor: z.string().optional(),
  colors: z.array(swatchSchema).optional(),
  imageUrl: z.string().optional(),
});
const presentationSchema = z.strictObject(presentationShape);

const injectionShape = defineExhaustiveShape<PersonaChatInjection>()({
  position: z.string(),
  depth: z.number().optional(),
  role: z.enum(["system", "user", "assistant"]).optional(),
  wrapper: z.string().optional(),
});
const injectionSchema = z.strictObject(injectionShape);

const attributionShape = defineExhaustiveShape<PersonaAttribution>()({
  creator: z.string().optional(),
  version: z.string().optional(),
  createdAt: z.string().optional(),
  source: z.string().optional(),
});
const attributionSchema = z.strictObject(attributionShape);

const mediaShape = defineExhaustiveShape<PersonaMedia>()({
  portrait: mediaAssetSchema.optional(),
});
const mediaSchema = z.strictObject(mediaShape);

const bodyShape = defineExhaustiveShape<PersonaBody>()({
  name: z.string(),
  brief: z.string().optional(),
  content: z.string(),
  sections: sectionsSchema.optional(),
  sectionOrder: stringArray.optional(),
  traits: stringArray.optional(),
  identity: identitySchema.optional(),
  presentation: presentationSchema.optional(),
  knowledgeRefs: stringArray.optional(),
  rating: z.enum(["all-ages", "mature", "explicit"]).optional(),
  chatInjection: injectionSchema.optional(),
  attribution: attributionSchema.optional(),
  media: mediaSchema.optional(),
});

export const personaBodySchema = z.strictObject(bodyShape);
export const personaProfileSchema = personaBodySchema.partial();
