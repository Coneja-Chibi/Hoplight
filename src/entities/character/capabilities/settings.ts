/**
 * Semantic capability for authored character dials, bias, and sealed behavior configuration.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalCharacter } from "../schema";
import { nonEmptyPatch, previewCharacterPatch, targetSchema } from "./shared";

const risuSettings = z.strictObject({
  viewScreen: z.string().optional(),
  largePortrait: z.boolean().optional(),
  inlayViewScreen: z.boolean().optional(),
  utilityBot: z.boolean().optional(),
  lorePlus: z.boolean().optional(),
});
const prebuiltAsset = z.strictObject({
  command: z.string().optional(),
  exclude: z.array(z.string()).optional(),
  style: z.string().optional(),
});
const bias = z.strictObject({
  phrase: z.string(),
  weight: z.number(),
});
const patchSchema = nonEmptyPatch({
  talkativeness: z.number().min(0).max(1).nullable().optional(),
  risu: risuSettings.nullable().optional(),
  responseSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  bias: z.array(bias).nullable().optional(),
  virtualScript: z.string().nullable().optional(),
  backgroundHTML: z.string().nullable().optional(),
  backgroundCSS: z.string().nullable().optional(),
  defaultVariables: z.string().nullable().optional(),
  prebuiltAsset: prebuiltAsset.nullable().optional(),
  moduleToggles: z.string().nullable().optional(),
  privileged: z.boolean().nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });
const paths: Record<string, string> = {
  talkativeness: "settings.talkativeness",
  risu: "settings.risu",
  responseSchema: "settings.responseSchema",
  bias: "bias",
  virtualScript: "behavior.virtualScript",
  backgroundHTML: "behavior.backgroundHTML",
  backgroundCSS: "behavior.backgroundCSS",
  defaultVariables: "behavior.defaultVariables",
  prebuiltAsset: "behavior.prebuiltAsset",
  moduleToggles: "behavior.moduleToggles",
  privileged: "behavior.privileged",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.settings.update",
  kind: "character",
  area: "settings",
  action: "update",
  summary: "Change character dials, bias, variables, or sealed inline behavior configuration.",
  aliases: ["talkativeness", "card variables", "behavior settings", "response schema", "bias"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { target, patch }) =>
    previewCharacterPatch(entity, patch, paths, target.variantId),
};

export default capability;
