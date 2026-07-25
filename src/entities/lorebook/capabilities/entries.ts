/**
 * Semantic capabilities for updating, ordering, enabling, and removing lorebook entries.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalLorebook } from "../schema";
import {
  removeLorebookEntries,
  reorderLorebookEntry,
  setLorebookEntriesEnabled,
  updateLorebookEntry,
} from "./operations";
import {
  canonicalPlatforms,
  change,
  lorebookBody,
  targetSchema,
  withLorebookBody,
} from "./shared";

const basicEntryPatchSchema = z.strictObject({
  title: z.string().optional(),
  content: z.string().optional(),
  comment: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  constant: z.boolean().optional(),
}).refine((patch) => Object.keys(patch).length > 0, {
  message: "at least one entry field must change",
});

const updateInput = z.strictObject({
  target: targetSchema,
  entryId: z.string().min(1),
  patch: basicEntryPatchSchema,
});

const update: ContentCapability<z.infer<typeof updateInput>, CanonicalLorebook> = {
  id: "lorebook.entries.update",
  kind: "lorebook",
  area: "entries",
  action: "update",
  summary: "Change the title, content, note, enabled state, or constant state of one lorebook entry.",
  aliases: ["edit lore entry", "change lore", "update world info"],
  platforms: canonicalPlatforms,
  exposure: "deferred",
  effect: "draft",
  input: updateInput,
  concurrencyKey: ({ target }) => `lorebook/${target.id}`,
  preview(entity, { entryId, patch }) {
    const before = lorebookBody(entity);
    const entry = before.entries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      return {
        entity,
        changes: [],
        warnings: [`No lorebook entry has id "${entryId}".`],
        platformImpact: [],
      };
    }
    const body = updateLorebookEntry(before, entryId, patch);
    const changes = Object.entries(patch)
      .map(([key, after]) =>
        change(
          `body.entries.${entryId}.${key}`,
          `${entry.title || entryId}: ${key}`,
          entry[key as keyof typeof entry],
          after,
        ))
      .filter((row) => row !== null);
    return {
      entity: withLorebookBody(entity, body),
      changes,
      warnings: [],
      platformImpact: [],
    };
  },
};

const reorderInput = z.strictObject({
  target: targetSchema,
  entryId: z.string().min(1),
  toIndex: z.number().int().min(0),
});

const reorder: ContentCapability<z.infer<typeof reorderInput>, CanonicalLorebook> = {
  id: "lorebook.entries.reorder",
  kind: "lorebook",
  area: "entries",
  action: "reorder",
  summary: "Move one lorebook entry to a specific position in the authored entry order.",
  aliases: ["move lore entry", "reorder world info"],
  platforms: canonicalPlatforms,
  exposure: "deferred",
  effect: "draft",
  input: reorderInput,
  concurrencyKey: ({ target }) => `lorebook/${target.id}`,
  preview(entity, { entryId, toIndex }) {
    const before = lorebookBody(entity);
    const fromIndex = before.entries.findIndex((entry) => entry.id === entryId);
    const body = reorderLorebookEntry(before, entryId, toIndex);
    const afterIndex = body.entries.findIndex((entry) => entry.id === entryId);
    const row = change(
      `body.entries.${entryId}.index`,
      `entry order: ${entryId}`,
      fromIndex,
      afterIndex,
    );
    return {
      entity: withLorebookBody(entity, body),
      changes: row ? [row] : [],
      warnings: fromIndex < 0 ? [`No lorebook entry has id "${entryId}".`] : [],
      platformImpact: [],
    };
  },
};

const enableInput = z.strictObject({
  target: targetSchema,
  entryIds: z.array(z.string().min(1)).min(1),
  enabled: z.boolean(),
});

const enable: ContentCapability<z.infer<typeof enableInput>, CanonicalLorebook> = {
  id: "lorebook.entries.enable",
  kind: "lorebook",
  area: "entries",
  action: "enable",
  summary: "Enable or disable one or more lorebook entries as one change.",
  aliases: ["disable lore", "enable world info", "bulk enable entries"],
  platforms: canonicalPlatforms,
  exposure: "deferred",
  effect: "draft",
  input: enableInput,
  concurrencyKey: ({ target }) => `lorebook/${target.id}`,
  preview(entity, { entryIds, enabled }) {
    const before = lorebookBody(entity);
    const selected = new Set(entryIds);
    const body = setLorebookEntriesEnabled(before, entryIds, enabled);
    const changes = before.entries
      .filter((entry) => selected.has(entry.id))
      .map((entry) =>
        change(
          `body.entries.${entry.id}.enabled`,
          `${entry.title || entry.id}: enabled`,
          entry.enabled,
          enabled,
        ))
      .filter((row) => row !== null);
    return {
      entity: withLorebookBody(entity, body),
      changes,
      warnings: [],
      platformImpact: [],
    };
  },
};

const removeInput = z.strictObject({
  target: targetSchema,
  entryIds: z.array(z.string().min(1)).min(1),
});

const remove: ContentCapability<z.infer<typeof removeInput>, CanonicalLorebook> = {
  id: "lorebook.entries.remove",
  kind: "lorebook",
  area: "entries",
  action: "remove",
  summary: "Remove one or more lorebook entries from a draft, with exact affected ids in the preview.",
  aliases: ["delete lore entries", "remove world info"],
  platforms: canonicalPlatforms,
  exposure: "deferred",
  effect: "draft",
  input: removeInput,
  concurrencyKey: ({ target }) => `lorebook/${target.id}`,
  preview(entity, { entryIds }) {
    const before = lorebookBody(entity);
    const selected = new Set(entryIds);
    const removed = before.entries.filter((entry) => selected.has(entry.id));
    const body = removeLorebookEntries(before, entryIds);
    const row = change(
      "body.entries",
      "removed entries",
      removed.map((entry) => ({ id: entry.id, title: entry.title })),
      [],
    );
    return {
      entity: withLorebookBody(entity, body),
      changes: row && removed.length > 0 ? [row] : [],
      warnings: [],
      platformImpact: [],
    };
  },
};

export default [enable, remove, reorder, update] satisfies readonly ContentCapability[];
