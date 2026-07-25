/** Runtime registry coverage for deferred capability visibility and complete dispatchability. */
import { expect, test } from "bun:test";
import { z } from "zod";
import type { ContentCapability } from "../../entities/capabilities";
import { createChangeSession } from "../changes/session";
import type { HarnessTool } from "../tools/tool";
import { createCapabilityRuntime } from "./runtime";

const direct: HarnessTool = {
  name: "studio_read",
  description: "Read one piece.",
  exposure: "direct",
  effect: "read",
  input: z.object({}),
  concurrencyKey: () => "studio/read",
  execute: async () => ({ summary: "read", output: "read" }),
};

const capability = (
  id: ContentCapability["id"],
  action: string,
  exposure: ContentCapability["exposure"] = "deferred",
): ContentCapability => ({
  id,
  kind: "lorebook",
  area: "entries",
  action,
  summary: `${action} a lorebook entry.`,
  aliases: [`${action} lore`],
  platforms: "canonical",
  exposure,
  effect: "draft",
  input: z.object({ target: z.object({ id: z.string() }) }),
  concurrencyKey: ({ target }) => `lorebook/${target.id}`,
  preview: (entity) => ({
    entity,
    changes: [],
    warnings: [],
    platformImpact: [],
  }),
});

test("deferred capabilities stay dispatchable but absent until a successful find", () => {
  const runtime = createCapabilityRuntime({
    capabilities: [
      capability("lorebook.entries.reorder", "reorder"),
      capability("lorebook.entries.update", "update"),
      capability("lorebook.entries.remove", "remove"),
    ],
    directTools: [direct],
    changes: createChangeSession(),
  });

  expect(runtime.registeredTools().map((tool) => tool.name)).toEqual([
    "studio_read",
    "lorebook_entries_reorder",
    "lorebook_entries_update",
    "lorebook_entries_remove",
  ]);
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual(["studio_read"]);

  const hits = runtime.find({ kind: "lorebook", query: "reorder lore" });
  expect(hits.map((hit) => hit.capability.id)).toEqual([
    "lorebook.entries.reorder",
  ]);
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual([
    "studio_read",
    "lorebook_entries_reorder",
  ]);
});

test("hidden capabilities remain registered without entering a model snapshot", () => {
  const runtime = createCapabilityRuntime({
    capabilities: [capability("lorebook.entries.update", "update", "hidden")],
    directTools: [direct],
    changes: createChangeSession(),
  });

  runtime.find({ kind: "lorebook", query: "update" });
  expect(runtime.registeredTools()).toHaveLength(2);
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual(["studio_read"]);
});
