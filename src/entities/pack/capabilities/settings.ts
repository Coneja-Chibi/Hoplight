/** Semantic capability for pack shelf metadata and default-pack settings. */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import { nonEmptyPatch } from "../../_shared/capability-schemas";
import type { CanonicalPack } from "../schema";
import { preview, targetSchema } from "./shared";

const patchSchema = nonEmptyPatch({
  name: z.string().min(1).optional(),
  brief: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  defaultLabel: z.string().nullable().optional(),
});
const input = z.strictObject({ target: targetSchema.omit({ groupId: true }), patch: patchSchema });

const capability: ContentCapability<z.infer<typeof input>, CanonicalPack> = {
  id: "pack.settings.update",
  kind: "pack",
  area: "settings",
  action: "update",
  summary: "Change a pack's name, shelf brief, enabled state, or default expression.",
  aliases: ["rename pack", "default face", "disable sprite pack"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `pack/${target.id}`,
  preview: (entity, { patch }) => {
    let body = entity.body;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "name" || key === "brief") {
        body = { ...body, [key]: value === null ? undefined : value };
      } else {
        body = {
          ...body,
          pack: { ...body.pack, [key]: value === null ? undefined : value },
        };
      }
    }
    return preview(entity, body, [{
      path: "body",
      label: "pack settings",
      before: entity.body,
      after: body,
    }]);
  },
};

export default capability;
