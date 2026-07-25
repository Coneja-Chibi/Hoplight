/**
 * Semantic capability for updating portable lorebook-level settings.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalLorebook } from "../schema";
import { updateLorebookSettings } from "./operations";
import {
  canonicalPlatforms,
  change,
  lorebookBody,
  targetSchema,
  withLorebookBody,
} from "./shared";

const settingsPatchSchema = z.strictObject({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  lorebookType: z.enum(["world", "character", "scenario", "rules", "utility", "other"]).nullable().optional(),
  genre: z.string().nullable().optional(),
  fandom: z.string().nullable().optional(),
  globalCaseSensitive: z.boolean().optional(),
  globalMatchWholeWords: z.boolean().optional(),
  globalScanDepth: z.number().int().min(0).optional(),
  globalRecursion: z.boolean().optional(),
  tokenBudget: z.number().int().min(0).optional(),
  budgetMode: z.enum(["token", "entry"]).optional(),
  entryBudget: z.number().int().min(0).optional(),
});

const input = z.strictObject({
  target: targetSchema,
  patch: settingsPatchSchema.refine((patch) => Object.keys(patch).length > 0, {
    message: "at least one setting must change",
  }),
});

const capability: ContentCapability<z.infer<typeof input>, CanonicalLorebook> = {
  id: "lorebook.settings.update",
  kind: "lorebook",
  area: "settings",
  action: "update",
  summary: "Change portable lorebook settings such as its name, matching defaults, or budget.",
  aliases: ["edit lorebook", "change book settings", "rename lorebook"],
  platforms: canonicalPlatforms,
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `lorebook/${target.id}`,
  preview(entity, { patch }) {
    const before = lorebookBody(entity);
    const body = updateLorebookSettings(before, patch);
    const changes = Object.entries(patch)
      .map(([key, after]) => change(`body.${key}`, key, before[key as keyof typeof before], after))
      .filter((row) => row !== null);
    return {
      entity: withLorebookBody(entity, body),
      changes,
      warnings: [],
      platformImpact: [],
    };
  },
};

export default capability;
