/**
 * Semantic capability for replacing or removing authored persona prompt placement.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalPersona } from "../schema";
import { previewPersonaPatch, targetSchema } from "./shared";

const injection = z.strictObject({
  position: z.string().min(1),
  depth: z.number().int().nonnegative().optional(),
  role: z.enum(["system", "user", "assistant"]).optional(),
  wrapper: z.string().optional(),
});
const input = z.strictObject({
  target: targetSchema,
  injection: injection.nullable(),
});

const capability: ContentCapability<z.infer<typeof input>, CanonicalPersona> = {
  id: "persona.injection.update",
  kind: "persona",
  area: "injection",
  action: "update",
  summary: "Replace or remove where and how the persona text enters the prompt.",
  aliases: ["persona depth", "prompt placement", "injection role", "persona wrapper"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `persona/${target.id}`,
  preview: (entity, args) =>
    previewPersonaPatch(entity, { injection: args.injection }, { injection: "chatInjection" }),
};

export default capability;
