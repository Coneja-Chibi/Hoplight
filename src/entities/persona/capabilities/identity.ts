/**
 * Semantic capability for a persona's shelf identity and injected first-person text.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalPersona } from "../schema";
import { nonEmptyPatch, previewPersonaPatch, targetSchema } from "./shared";

const patchSchema = nonEmptyPatch({
  name: z.string().min(1).optional(),
  brief: z.string().nullable().optional(),
  content: z.string().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });
const paths: Record<string, string> = {
  name: "name",
  brief: "brief",
  content: "content",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalPersona> = {
  id: "persona.identity.update",
  kind: "persona",
  area: "identity",
  action: "update",
  summary: "Change a persona's name, shelf-only brief, or injected first-person identity text.",
  aliases: ["rename persona", "persona brief", "user identity text"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `persona/${target.id}`,
  preview: (entity, { patch }) => previewPersonaPatch(entity, patch, paths),
};

export default capability;
