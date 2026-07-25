/** Semantic lifecycle for named multi-character pack groups. */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalPack } from "../schema";
import { addPackGroup, removePackGroup, renamePackGroup } from "../operations";
import { preview, targetSchema } from "./shared";

const pack = z.strictObject({
  enabled: z.boolean().optional(),
  defaultLabel: z.string().optional(),
  items: z.array(z.strictObject({
    id: z.string().min(1),
    label: z.string().min(1),
    ref: z.string().min(1),
    mime: z.string().optional(),
  })),
});
const operation = z.union([
  z.strictObject({ type: z.literal("add"), id: z.string().min(1), pack }),
  z.strictObject({ type: z.literal("rename"), id: z.string().min(1), newId: z.string().min(1) }),
  z.strictObject({ type: z.literal("remove"), id: z.string().min(1) }),
]);
const input = z.strictObject({
  target: targetSchema.omit({ groupId: true }),
  operation,
});

const capability: ContentCapability<z.infer<typeof input>, CanonicalPack> = {
  id: "pack.groups.manage",
  kind: "pack",
  area: "groups",
  action: "manage",
  summary: "Add, rename, or remove a named multi-character media-pack group.",
  aliases: ["pack group", "character sprite group", "rename media group"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `pack/${target.id}`,
  preview: (entity, { operation }) => {
    const body = operation.type === "add"
      ? addPackGroup(entity.body, operation.id, operation.pack)
      : operation.type === "rename"
        ? renamePackGroup(entity.body, operation.id, operation.newId)
        : removePackGroup(entity.body, operation.id);
    return preview(entity, body, [{
      path: "body.groups",
      label: `${operation.type} pack group`,
      before: entity.body.groups,
      after: body.groups,
    }]);
  },
};

export default capability;
