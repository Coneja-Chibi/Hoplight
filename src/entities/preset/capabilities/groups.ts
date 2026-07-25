/** Semantic capability for preset category lifecycle and safe membership cleanup. */
import { z } from "zod";
import type { CapabilityChange, ContentCapability } from "../../capabilities";
import { nonEmptyPatch } from "../../_shared/capability-schemas";
import type { CanonicalPreset } from "../schema";
import { addPresetGroup, patchPresetGroup, removePresetGroup } from "../operations";
import { presetPreview, targetSchema } from "./shared";

const group = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  content: z.string().optional(),
  parentGroupId: z.string().optional(),
  order: z.number().optional(),
  enabled: z.boolean().optional(),
  extras: z.record(z.string(), z.unknown()).optional(),
});
const patch = nonEmptyPatch({
  name: z.string().optional(),
  content: z.string().nullable().optional(),
  parentGroupId: z.string().nullable().optional(),
  order: z.number().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
});
const operation = z.union([
  z.strictObject({ type: z.literal("add"), group }),
  z.strictObject({ type: z.literal("update"), id: z.string().min(1), patch }),
  z.strictObject({ type: z.literal("remove"), id: z.string().min(1) }),
]);
const input = z.strictObject({ target: targetSchema, operation });

const capability: ContentCapability<z.infer<typeof input>, CanonicalPreset> = {
  id: "preset.groups.manage",
  kind: "preset",
  area: "groups",
  action: "manage",
  summary: "Add, edit, or remove preset categories while cleaning block and child references.",
  aliases: ["preset category", "prompt group", "remove category"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `preset/${target.id}`,
  preview: (entity, { operation: action }) => {
    const body = action.type === "add"
      ? addPresetGroup(entity.body, action.group)
      : action.type === "remove"
        ? removePresetGroup(entity.body, action.id)
        : patchPresetGroup(entity.body, action.id, Object.fromEntries(
            Object.entries(action.patch).map(([key, value]) => [key, value === null ? undefined : value]),
          ));
    const changes: CapabilityChange[] = [{
      path: "body.groups",
      label: `${action.type} preset group`,
      before: entity.body.groups,
      after: body.groups,
    }];
    if (JSON.stringify(entity.body.prompts) !== JSON.stringify(body.prompts)) {
      changes.push({
        path: "body.prompts",
        label: "clear removed group membership",
        before: entity.body.prompts,
        after: body.prompts,
      });
    }
    return presetPreview(entity, body, changes);
  },
};

export default capability;
