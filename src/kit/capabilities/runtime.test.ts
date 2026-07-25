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

const workflow: HarnessTool = {
  name: "publish_inspect",
  description: "Inspect export readiness.",
  exposure: "deferred",
  effect: "read",
  discovery: {
    id: "transfer.publish.inspect",
    domain: "transfer",
    area: "publish",
    action: "inspect",
    summary: "Inspect export readiness without writing.",
    aliases: ["export readiness"],
    platforms: "canonical",
  },
  input: z.object({}),
  concurrencyKey: () => "publish/inspect",
  execute: async () => ({ summary: "inspect", output: "ready" }),
};

const studioWorkflow: HarnessTool = {
  ...workflow,
  name: "studio_create_plan",
  discovery: {
    ...workflow.discovery!,
    id: "studio.lifecycle.create",
    domain: "studio",
    area: "lifecycle",
    action: "create",
    summary: "Plan a new canonical piece.",
    aliases: ["new piece"],
  },
};

const diagnosticWorkflow: HarnessTool = {
  ...workflow,
  name: "diagnostics_health_inspect",
  discovery: {
    ...workflow.discovery!,
    id: "diagnostics.health.inspect",
    domain: "diagnostics",
    area: "health",
    action: "inspect",
    summary: "Inspect deterministic content health.",
    aliases: ["health check"],
  },
};

const capability = (
  id: ContentCapability["id"],
  action: string,
  exposure: ContentCapability["exposure"] = "deferred",
  area = "entries",
): ContentCapability => ({
  id,
  kind: "lorebook",
  area,
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
  expect(hits.map((hit) => hit.descriptor.id)).toEqual([
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

  expect(runtime.find({ kind: "lorebook", query: "update" })).toEqual([]);
  expect(runtime.registeredTools()).toHaveLength(2);
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual(["studio_read"]);
});

test("later discovery replaces stale deferred tools and a new turn clears them", () => {
  const runtime = createCapabilityRuntime({
    capabilities: [
      capability("lorebook.entries.reorder", "reorder"),
      capability("lorebook.entries.update", "update"),
    ],
    directTools: [direct],
    changes: createChangeSession(),
  });

  runtime.find({ kind: "lorebook", query: "reorder" });
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toContain("lorebook_entries_reorder");

  runtime.find({ kind: "lorebook", query: "update" });
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual([
    "studio_read",
    "lorebook_entries_update",
  ]);

  runtime.beginTurn();
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual(["studio_read"]);
});

test("browse stays metadata-only while describe reveals exactly one selected capability", () => {
  const runtime = createCapabilityRuntime({
    capabilities: [
      capability("lorebook.entries.update", "update"),
      capability("lorebook.entries.remove", "remove"),
      capability("lorebook.settings.update", "rename", "deferred", "settings"),
      capability("lorebook.entries.reorder", "secret", "hidden"),
    ],
    directTools: [direct],
    changes: createChangeSession(),
  });

  expect(runtime.browse({ kind: "lorebook" }).areas).toEqual([
    { area: "entries", count: 2 },
    { area: "settings", count: 1 },
  ]);
  expect(runtime.browse({ kind: "lorebook", area: "entries" }).capabilities.map((item) => item.id))
    .toEqual(["lorebook.entries.remove", "lorebook.entries.update"]);
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual(["studio_read"]);

  const selected = runtime.describe({
    kind: "lorebook",
    id: "lorebook.entries.update",
  });
  expect(selected?.id).toBe("lorebook.entries.update");
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual([
    "studio_read",
    "lorebook_entries_update",
  ]);
  expect(runtime.describe({
    kind: "lorebook",
    id: "lorebook.entries.reorder",
  })).toBeNull();
});

test("one progressive catalog reveals deferred non-content workflows", () => {
  const runtime = createCapabilityRuntime({
    capabilities: [capability("lorebook.entries.update", "update")],
    directTools: [direct, workflow, studioWorkflow, diagnosticWorkflow],
    changes: createChangeSession(),
  });

  expect(runtime.registeredTools().map((tool) => tool.name)).toContain("publish_inspect");
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual(["studio_read"]);

  const hits = runtime.find({ domain: "transfer", query: "export readiness" });
  expect(hits.map((hit) => hit.descriptor.id)).toEqual(["transfer.publish.inspect"]);
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual([
    "studio_read",
    "publish_inspect",
  ]);

  runtime.beginTurn();
  expect(runtime.browse({}).domains).toEqual([
    { domain: "content", count: 1 },
    { domain: "diagnostics", count: 1 },
    { domain: "studio", count: 1 },
    { domain: "transfer", count: 1 },
  ]);
  expect(runtime.toolSnapshot().map((tool) => tool.name)).toEqual(["studio_read"]);
});

test("deferred apply workflows fail closed until their safety contract exists", () => {
  expect(() => createCapabilityRuntime({
    capabilities: [],
    directTools: [{
      ...workflow,
      name: "publish_apply",
      effect: "apply",
      discovery: {
        ...workflow.discovery!,
        id: "transfer.publish.apply",
        action: "apply",
      },
    }],
    changes: createChangeSession(),
  })).toThrow("explicit safety contract");
});

test("direct tools cannot collide with adapted content provider names", () => {
  expect(() => createCapabilityRuntime({
    capabilities: [capability("lorebook.entries.update", "update")],
    directTools: [{ ...direct, name: "lorebook_entries_update" }],
    changes: createChangeSession(),
  })).toThrow('duplicate tool name "lorebook_entries_update"');
});
