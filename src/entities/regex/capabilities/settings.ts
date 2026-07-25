/** Semantic capability for regex-set name, description, and enabled state. */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import { nonEmptyPatch } from "../../_shared/capability-schemas";
import type { CanonicalRegexSet } from "../schema";
import { patchRegexSet } from "../operations";
import { preview, targetSchema } from "./shared";

const patchSchema = nonEmptyPatch({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });

const capability: ContentCapability<z.infer<typeof input>, CanonicalRegexSet> = {
  id: "regex.settings.update",
  kind: "regex",
  area: "settings",
  action: "update",
  summary: "Change a standalone regex set's name, description, or enabled state.",
  aliases: ["rename regex set", "disable regex set"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `regex/${target.id}`,
  preview: (entity, { patch }) => {
    const normalized = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [key, value === null ? undefined : value]),
    );
    const body = patchRegexSet(entity.body, normalized);
    return preview(entity, body, [{
      path: "body",
      label: "regex set settings",
      before: entity.body,
      after: body,
    }]);
  },
};

export default capability;
