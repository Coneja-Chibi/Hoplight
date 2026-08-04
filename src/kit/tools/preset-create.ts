/**
 * Prompt-preset creation workflow with optional initial typed prompt blocks.
 */
import { z } from "zod";
import { starterBody } from "../../core/preset/blocks/starter";
import type { HarnessTool } from "./tool";
import { createEntityDraft } from "./_create-common";

const block = z.strictObject({
  id: z.string().min(1).describe("stable prompt identifier used by ordering and marker references"),
  name: z.string().describe("creator-facing block label"),
  content: z.string().describe("prompt text; empty is appropriate only for structural markers"),
  role: z.enum(["system", "user", "assistant"]).default("system"),
  enabled: z.boolean().default(true),
  systemPrompt: z.boolean().default(false),
  marker: z.boolean().default(false).describe("true for structural slots such as chat history"),
  markerSlot: z.string().optional().describe("slot id required by a marker when applicable"),
  placement: z.string().default("relative")
    .describe("relative, in_chat, append, append_preset, prepend_preset, or platform extension"),
  injectionDepth: z.number().int().nonnegative().default(4),
  injectionOrder: z.number().default(100),
  forbidOverrides: z.boolean().default(false),
});
const input = z.strictObject({
  name: z.string().trim().min(1).max(200),
  id: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(20_000).optional(),
  enabled: z.boolean().default(true),
  prompts: z.array(block).max(500).optional().describe("initial ordered prompt blocks"),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  minP: z.number().optional(),
  maxContext: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  imageInlining: z.boolean().optional().describe("allow supported image inputs in assembled requests"),
  inlineImageQuality: z.string().optional().describe("provider-facing inline image quality label"),
  videoInlining: z.boolean().optional().describe("allow supported video inputs"),
});

const presetCreate: HarnessTool<z.infer<typeof input>> = {
  name: "studio_preset_create",
  description:
    "Create a prompt preset draft. Carries real sampler, template and behaviour defaults so the file "
    + "never inherits whatever settings were open last; with no blocks given it starts from the "
    + "skeleton set, so the first render works.",
  exposure: "deferred",
  effect: "draft",
  discovery: {
    id: "studio.preset.create",
    domain: "studio",
    kind: "preset",
    area: "lifecycle",
    action: "create",
    summary: "Create a new prompt preset with optional initial blocks and sampler settings.",
    aliases: ["new preset", "create preset", "prompt recipe", "completion preset"],
    platforms: "canonical",
  },
  input,
  concurrencyKey: ({ id, name }) => `preset/${id ?? name}`,
  async execute(args, ctx) {
    const samplers = {
      ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
      ...(args.topP !== undefined ? { topP: args.topP } : {}),
      ...(args.topK !== undefined ? { topK: args.topK } : {}),
      ...(args.minP !== undefined ? { minP: args.minP } : {}),
      ...(args.maxContext !== undefined ? { maxContext: args.maxContext } : {}),
      ...(args.maxTokens !== undefined ? { maxTokens: args.maxTokens } : {}),
    };
    const media = {
      ...(args.imageInlining !== undefined ? { imageInlining: args.imageInlining } : {}),
      ...(args.inlineImageQuality ? { inlineImageQuality: args.inlineImageQuality } : {}),
      ...(args.videoInlining !== undefined ? { videoInlining: args.videoInlining } : {}),
    };
    // Built ON the starter, not on an empty body. A preset with no sampler, template or behaviour
    // group loads and then runs on whatever settings the application had open last, which reads as
    // success and is not. Anything the caller stated explicitly still wins over the shipped default.
    const base = starterBody(args.name);
    const body = {
      ...base,
      ...(args.description ? { description: args.description } : {}),
      enabled: args.enabled,
      // No blocks asked for means the skeletons, so the first render works instead of being empty.
      prompts: args.prompts ?? base.prompts,
      samplers: { ...base.samplers, ...samplers },
      media: { ...base.media, ...media },
    };
    return createEntityDraft({
      kind: "preset",
      id: args.id,
      name: args.name,
      body,
      input: args,
      changes: [{
        path: "/",
        label: "new preset",
        before: null,
        after: { name: args.name, prompts: body.prompts.length },
      }],
    }, ctx);
  },
};

export default presetCreate;
