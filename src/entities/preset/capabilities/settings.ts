/** Semantic capability for preset identity, enabled state, and sampler settings. */
import { z } from "zod";
import type { CapabilityChange, ContentCapability } from "../../capabilities";
import { nonEmptyPatch } from "../../_shared/capability-schemas";
import type { CanonicalPreset, PresetSamplers } from "../schema";
import { patchPresetBody, setPresetSampler } from "../operations";
import { presetPreview, targetSchema } from "./shared";

const patchSchema = nonEmptyPatch({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  temperature: z.number().nullable().optional(),
  topP: z.number().nullable().optional(),
  topK: z.number().nullable().optional(),
  topA: z.number().nullable().optional(),
  minP: z.number().nullable().optional(),
  frequencyPenalty: z.number().nullable().optional(),
  presencePenalty: z.number().nullable().optional(),
  repetitionPenalty: z.number().nullable().optional(),
  maxContext: z.number().nullable().optional(),
  maxTokens: z.number().nullable().optional(),
  promptPostProcessing: z.enum(["none", "merge", "semi", "strict", "single"]).nullable().optional(),
  contextMode: z.enum(["tokens", "messages"]).nullable().optional(),
  maxMessages: z.number().nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });
const rootKeys = new Set(["name", "description", "enabled"]);

const capability: ContentCapability<z.infer<typeof input>, CanonicalPreset> = {
  id: "preset.settings.update",
  kind: "preset",
  area: "settings",
  action: "update",
  summary: "Change preset name, description, enabled state, or authored sampler values.",
  aliases: ["preset temperature", "context size", "max tokens", "preset samplers"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `preset/${target.id}`,
  preview: (entity, { patch }) => {
    let body = entity.body;
    const changes: CapabilityChange[] = [];
    for (const [key, value] of Object.entries(patch)) {
      const before = rootKeys.has(key)
        ? body[key as keyof typeof body]
        : body.samplers?.[key as keyof PresetSamplers];
      if (rootKeys.has(key)) {
        const nextPatch = { [key]: value === null ? undefined : value } as Partial<typeof body>;
        body = patchPresetBody(body, nextPatch);
      } else {
        body = setPresetSampler(
          body,
          key as keyof PresetSamplers,
          (value === null ? undefined : value) as number | string | undefined,
        );
      }
      const after = rootKeys.has(key)
        ? body[key as keyof typeof body]
        : body.samplers?.[key as keyof PresetSamplers];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push({
          path: rootKeys.has(key) ? `body.${key}` : `body.samplers.${key}`,
          label: key,
          before,
          after,
        });
      }
    }
    return presetPreview(entity, body, changes);
  },
};

export default capability;
