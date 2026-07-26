/**
 * Lorebook creation workflow with optional initial entries and portable activation fields.
 */
import { z } from "zod";
import { emptyLoreEntry, emptyLorebookBody } from "../../core/lore";
import type { HarnessTool } from "./tool";
import { createEntityDraft } from "./_create-common";

const trigger = z.strictObject({
  keyword: z.string().min(1).describe("literal keyword or bare regex pattern"),
  isRegex: z.boolean().default(false).describe("true when keyword is a regex pattern"),
  flags: z.string().optional().describe("regex flags such as i, m, or s"),
  probability: z.number().min(0).max(100).optional()
    .describe("advanced-trigger activation chance from 0 to 100"),
});
const entry = z.strictObject({
  id: z.string().min(1).optional().describe("stable entry id; generated from list position if omitted"),
  title: z.string().default("").describe("creator-facing entry label"),
  content: z.string().describe("text injected when this entry activates"),
  enabled: z.boolean().default(true),
  constant: z.boolean().default(false).describe("inject without requiring a trigger"),
  triggers: z.array(trigger).default([]).describe("primary keyword or regex triggers"),
  secondaryTriggers: z.array(trigger).default([]),
  selectiveLogic: z.enum(["and_any", "and_all", "not_any", "not_all"]).default("and_any"),
  position: z.enum([
    "world",
    "character",
    "before_example",
    "after_example",
    "depth",
    "append",
    "append_bottom",
    "prepend_top",
    "scene",
  ]).default("world").describe("portable prompt insertion position"),
  depth: z.number().int().nonnegative().default(4),
  role: z.enum(["system", "user", "assistant"]).default("system"),
});
const input = z.strictObject({
  name: z.string().trim().min(1).max(200),
  id: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(20_000).optional(),
  lorebookType: z.enum(["world", "character", "scenario", "rules", "utility", "other"]).optional(),
  genre: z.string().max(200).optional(),
  fandom: z.string().max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  enabled: z.boolean().default(true),
  entries: z.array(entry).max(1_000).optional()
    .describe("initial entries; omit to create the editor's single blank starter entry"),
});

const lorebookCreate: HarnessTool<z.infer<typeof input>> = {
  name: "studio_lorebook_create",
  description:
    "Create a lorebook as a reviewed canonical draft, optionally with initial typed entries and triggers.",
  exposure: "deferred",
  effect: "draft",
  discovery: {
    id: "studio.lorebook.create",
    domain: "studio",
    kind: "lorebook",
    area: "lifecycle",
    action: "create",
    summary: "Create a new lorebook with optional initial entries.",
    aliases: ["new lorebook", "create lorebook", "new world info", "world book"],
    platforms: "canonical",
  },
  input,
  concurrencyKey: ({ id, name }) => `lorebook/${id ?? name}`,
  async execute(args, ctx) {
    const body = {
      ...emptyLorebookBody(args.name),
      ...(args.description ? { description: args.description } : {}),
      ...(args.lorebookType ? { lorebookType: args.lorebookType } : {}),
      ...(args.genre ? { genre: args.genre } : {}),
      ...(args.fandom ? { fandom: args.fandom } : {}),
      tags: args.tags ?? [],
      enabled: args.enabled,
      ...(args.entries ? {
        entries: args.entries.map((item, index) => ({
          ...emptyLoreEntry(item.id ?? `entry-${index + 1}`),
          ...item,
          id: item.id ?? `entry-${index + 1}`,
          triggerMode: item.triggers.some((row) => row.probability !== undefined)
            ? "advanced" as const
            : "simple" as const,
        })),
      } : {}),
    };
    return createEntityDraft({
      kind: "lorebook",
      id: args.id,
      name: args.name,
      body,
      input: args,
      changes: [{
        path: "/",
        label: "new lorebook",
        before: null,
        after: { name: args.name, entries: body.entries.length },
      }],
    }, ctx);
  },
};

export default lorebookCreate;
