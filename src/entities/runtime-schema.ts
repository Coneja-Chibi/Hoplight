/**
 * Shared strict canonical envelope. Per-kind body decoders live beside their handwritten domain
 * interfaces; this module is the only public untrusted-JSON parse boundary.
 */
import { z } from "zod";
import {
  CANONICAL_SCHEMA_VERSION,
  type EntityNote,
  type OriginalEntry,
} from "../core/canonical";
import { defineExhaustiveShape } from "./_shared/runtime-shape";
import {
  characterBodySchema,
  characterProfileSchema,
} from "./character/runtime-schema";
import type { CanonicalCharacter } from "./character/schema";
import {
  lorebookBodySchema,
  lorebookProfileSchema,
} from "./lorebook/runtime-schema";
import type { CanonicalLorebook } from "./lorebook/schema";
import { packBodySchema, packProfileSchema } from "./pack/runtime-schema";
import type { CanonicalPack } from "./pack/schema";
import { personaBodySchema, personaProfileSchema } from "./persona/runtime-schema";
import type { CanonicalPersona } from "./persona/schema";
import { presetBodySchema, presetProfileSchema } from "./preset/runtime-schema";
import type { CanonicalPreset } from "./preset/schema";
import { htmlDocBodySchema, htmlDocProfileSchema } from "./htmldoc/runtime-schema";
import type { CanonicalHtmlDoc } from "./htmldoc/schema";
import { quickReplyBodySchema, quickReplyProfileSchema } from "./quickreply/runtime-schema";
import type { CanonicalQuickReplySet } from "./quickreply/schema";
import { regexBodySchema, regexProfileSchema } from "./regex/runtime-schema";
import type { CanonicalRegexSet } from "./regex/schema";

const unknownRecord = z.record(z.string(), z.unknown());
type SourceMedia = NonNullable<OriginalEntry["sourceMedia"]>;
const sourceMediaShape = defineExhaustiveShape<SourceMedia>()({
  b64: z.string(),
  mime: z.string(),
});
const sourceMediaSchema = z.strictObject(sourceMediaShape);
const originalEntryShape = defineExhaustiveShape<OriginalEntry>()({
  raw: z.unknown(),
  unmapped: unknownRecord.optional(),
  sourceMedia: sourceMediaSchema.optional(),
});
const originalEntrySchema = z.strictObject(originalEntryShape);
const originalSchema = z.record(z.string(), originalEntrySchema);
const noteShape = defineExhaustiveShape<EntityNote>()({
  id: z.string(),
  text: z.string(),
  at: z.string(),
  by: z.string().optional(),
});
const noteSchema = z.strictObject(noteShape);

const sharedEnvelope = {
  schemaVersion: z.literal(CANONICAL_SCHEMA_VERSION),
  id: z.string().min(1),
  original: originalSchema.optional(),
  // Declared once here, so every entity kind carries notes without a per-kind edit.
  notes: z.array(noteSchema).optional(),
};

const characterEntityShape = defineExhaustiveShape<CanonicalCharacter>()({
  ...sharedEnvelope,
  kind: z.literal("character"),
  body: characterBodySchema,
  profiles: z.record(z.string(), characterProfileSchema).optional(),
});
const characterEntitySchema = z.strictObject(characterEntityShape);
const lorebookEntityShape = defineExhaustiveShape<CanonicalLorebook>()({
  ...sharedEnvelope,
  kind: z.literal("lorebook"),
  body: lorebookBodySchema,
  profiles: z.record(z.string(), lorebookProfileSchema).optional(),
});
const lorebookEntitySchema = z.strictObject(lorebookEntityShape);
const personaEntityShape = defineExhaustiveShape<CanonicalPersona>()({
  ...sharedEnvelope,
  kind: z.literal("persona"),
  body: personaBodySchema,
  profiles: z.record(z.string(), personaProfileSchema).optional(),
});
const personaEntitySchema = z.strictObject(personaEntityShape);
const presetEntityShape = defineExhaustiveShape<CanonicalPreset>()({
  ...sharedEnvelope,
  kind: z.literal("preset"),
  body: presetBodySchema,
  profiles: z.record(z.string(), presetProfileSchema).optional(),
});
const presetEntitySchema = z.strictObject(presetEntityShape);
const regexEntityShape = defineExhaustiveShape<CanonicalRegexSet>()({
  ...sharedEnvelope,
  kind: z.literal("regex"),
  body: regexBodySchema,
  profiles: z.record(z.string(), regexProfileSchema).optional(),
});
const regexEntitySchema = z.strictObject(regexEntityShape);
const packEntityShape = defineExhaustiveShape<CanonicalPack>()({
  ...sharedEnvelope,
  kind: z.literal("pack"),
  body: packBodySchema,
  profiles: z.record(z.string(), packProfileSchema).optional(),
});
const packEntitySchema = z.strictObject(packEntityShape);
const htmlDocEntityShape = defineExhaustiveShape<CanonicalHtmlDoc>()({
  ...sharedEnvelope,
  kind: z.literal("htmldoc"),
  body: htmlDocBodySchema,
  profiles: z.record(z.string(), htmlDocProfileSchema).optional(),
});
const htmlDocEntitySchema = z.strictObject(htmlDocEntityShape);
const quickReplyEntityShape = defineExhaustiveShape<CanonicalQuickReplySet>()({
  ...sharedEnvelope,
  kind: z.literal("quickreply"),
  body: quickReplyBodySchema,
  profiles: z.record(z.string(), quickReplyProfileSchema).optional(),
});
const quickReplyEntitySchema = z.strictObject(quickReplyEntityShape);

export const canonicalEntitySchema = z.discriminatedUnion("kind", [
  characterEntitySchema,
  lorebookEntitySchema,
  personaEntitySchema,
  presetEntitySchema,
  regexEntitySchema,
  packEntitySchema,
  htmlDocEntitySchema,
  quickReplyEntitySchema,
]);

export type ParsedCanonicalEntity =
  | CanonicalCharacter
  | CanonicalLorebook
  | CanonicalPersona
  | CanonicalPreset
  | CanonicalRegexSet
  | CanonicalPack
  | CanonicalHtmlDoc
  | CanonicalQuickReplySet;

/** Parse untrusted JSON once into the known canonical union. */
export function parseCanonicalEntity(raw: unknown): ParsedCanonicalEntity {
  return canonicalEntitySchema.parse(raw);
}

/** Non-throwing detector for request boundaries that need a bounded client error. */
export function safeParseCanonicalEntity(raw: unknown):
  | { ok: true; entity: ParsedCanonicalEntity }
  | { ok: false; issues: string[] } {
  const parsed = canonicalEntitySchema.safeParse(raw);
  if (parsed.success) return { ok: true, entity: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => {
      const path = issue.path.map(String).join(".");
      return `${path || "entity"}: ${issue.message}`;
    }),
  };
}
