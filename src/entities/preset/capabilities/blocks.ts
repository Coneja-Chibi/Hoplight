/** Semantic capability for preset prompt-block lifecycle, order, state, and group membership. */
import { z } from "zod";
import type { CapabilityChange, ContentCapability } from "../../capabilities";
import { nonEmptyPatch } from "../../_shared/capability-schemas";
import type { CanonicalPreset } from "../schema";
import {
  addPresetBlock,
  movePresetBlock,
  patchPresetBlock,
  removePresetBlocks,
  setPresetBlockGroup,
  setPresetBlocksEnabled,
} from "../operations";
import { presetPreview, targetSchema } from "./shared";

const promptShape = {
  id: z.string().min(1),
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
  injectionTrigger: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  groupId: z.string().optional(),
  wrapInXml: z.boolean().optional(),
  xmlTagName: z.string().optional(),
  extras: z.record(z.string(), z.unknown()).optional(),
};
const block = z.strictObject(promptShape);
const patch = nonEmptyPatch({
  name: z.string().optional(),
  content: z.string().optional(),
  role: z.enum(["system", "user", "assistant", "tool"]).optional(),
  enabled: z.boolean().optional(),
  systemPrompt: z.boolean().optional(),
  marker: z.boolean().optional(),
  markerSlot: z.string().nullable().optional(),
  placement: z.string().optional(),
  injectionDepth: z.number().optional(),
  injectionOrder: z.number().optional(),
  forbidOverrides: z.boolean().optional(),
  injectionTrigger: z.array(z.string()).nullable().optional(),
  groupId: z.string().nullable().optional(),
  wrapInXml: z.boolean().nullable().optional(),
  xmlTagName: z.string().nullable().optional(),
});
/**
 * Where an added block goes. Optional, and "last" when it is left out, so nothing that already
 * worked changes - but a block with a place to be can now say so in the same call.
 *
 * Without this, writing an opening README meant adding it (at the end) and then moving it, and the
 * time the second half was forgotten the preset came back with its introduction at the bottom.
 */
const place = z.union([
  z.literal("first"),
  z.literal("last"),
  z.strictObject({ before: z.string().min(1) }),
  z.strictObject({ after: z.string().min(1) }),
]).describe('where to put it: "first", "last" (the default), {before: blockId}, or {after: blockId}');

const operation = z.union([
  z.strictObject({ type: z.literal("add"), block, place: place.optional() }),
  z.strictObject({ type: z.literal("update"), id: z.string().min(1), patch }),
  z.strictObject({ type: z.literal("remove"), ids: z.array(z.string().min(1)).min(1) }),
  z.strictObject({ type: z.literal("enable"), ids: z.array(z.string().min(1)).min(1), enabled: z.boolean() }),
  z.strictObject({ type: z.literal("move"), id: z.string().min(1), to: z.number().int().nonnegative() }),
  z.strictObject({ type: z.literal("set-group"), id: z.string().min(1), groupId: z.string().min(1).nullable() }),
]);
const input = z.strictObject({ target: targetSchema, operation });
type Operation = z.infer<typeof operation>;

function apply(entity: CanonicalPreset, action: Operation): CanonicalPreset["body"] {
  if (action.type === "add") return addPresetBlock(entity.body, action.block, action.place);
  if (action.type === "update") {
    const normalized = Object.fromEntries(
      Object.entries(action.patch).map(([key, value]) => [key, value === null ? undefined : value]),
    );
    return patchPresetBlock(entity.body, action.id, normalized);
  }
  if (action.type === "remove") return removePresetBlocks(entity.body, new Set(action.ids));
  if (action.type === "enable") return setPresetBlocksEnabled(entity.body, new Set(action.ids), action.enabled);
  if (action.type === "move") return movePresetBlock(entity.body, action.id, action.to);
  return setPresetBlockGroup(entity.body, action.id, action.groupId);
}

const capability: ContentCapability<z.infer<typeof input>, CanonicalPreset> = {
  id: "preset.blocks.manage",
  kind: "preset",
  area: "blocks",
  action: "manage",
  summary: "Add, edit, remove, enable, reorder, or group typed preset prompt blocks.",
  aliases: ["prompt block", "marker slot", "reorder preset", "disable prompts"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `preset/${target.id}`,
  preview: (entity, { operation: action }) => {
    const body = apply(entity, action);
    const change: CapabilityChange = {
      path: "body.prompts",
      label: `${action.type} preset block`,
      before: entity.body.prompts,
      after: body.prompts,
    };
    return presetPreview(entity, body, [change]);
  },
};

export default capability;
