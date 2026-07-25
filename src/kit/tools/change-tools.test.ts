/** Capability discovery, discard, and apply tool factory coverage. */
import { describe, expect, test } from "bun:test";
import { createChangeSession } from "../changes/session";
import { createCapabilityRuntime } from "../capabilities/runtime";
import { discoverCapabilities } from "../capabilities/discover";
import { createCapabilityFindTool } from "./capability-find";
import { createChangeDiscardTool } from "./change-discard";
import { createChangeQueryTool } from "./change-query";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { emptyLorebookBody } from "../../core/lore";
import { createResultStore } from "../results/store";

describe("change lifecycle tools", () => {
  test("capability_find reveals only bounded matching typed tools", async () => {
    const runtime = createCapabilityRuntime({
      capabilities: await discoverCapabilities(),
      directTools: [],
      changes: createChangeSession(),
    });
    const tool = createCapabilityFindTool(runtime);
    const result = await tool.execute({
      action: "search",
      target: { kind: "lorebook", id: "world" },
      query: "update lore entry",
    }, { bridge: null as never });
    const output = JSON.parse(result.output) as {
      matches: Array<{ id: string; tool: string }>;
    };
    expect(output.matches.length).toBeGreaterThan(0);
    expect(output.matches.length).toBeLessThanOrEqual(5);
    expect(output.matches[0]?.tool).toContain("lorebook_");
    expect(runtime.toolSnapshot().some((spec) => spec.name === output.matches[0]?.tool)).toBe(true);
  });

  test("capability_find browses collapsed areas and describes one exact operation", async () => {
    const runtime = createCapabilityRuntime({
      capabilities: await discoverCapabilities(),
      directTools: [],
      changes: createChangeSession(),
    });
    const tool = createCapabilityFindTool(runtime);
    const root = await tool.execute({
      action: "browse",
      target: { kind: "character", id: "hero" },
    }, { bridge: null as never });
    const rootOutput = JSON.parse(root.output) as {
      areas: Array<{ area: string; count: number }>;
    };
    expect(rootOutput.areas.some((item) => item.area === "identity")).toBe(true);
    expect(runtime.toolSnapshot()).toHaveLength(0);

    const detail = await tool.execute({
      action: "describe",
      target: { kind: "character", id: "hero" },
      id: "character.identity.update",
    }, { bridge: null as never });
    const detailOutput = JSON.parse(detail.output) as {
      capability: { id: string; tool: string };
    };
    expect(detailOutput.capability.id).toBe("character.identity.update");
    expect(runtime.toolSnapshot().map((spec) => spec.name))
      .toEqual([detailOutput.capability.tool]);
  });

  test("change_discard is one-shot and never needs a bridge", async () => {
    const changes = createChangeSession();
    expect((await createChangeDiscardTool(changes).execute(
      { draftId: "missing" },
      { bridge: null as never },
    )).summary).toContain("unavailable");
  });

  test("change_query lists, shows, and validates the complete accumulated draft", async () => {
    const original = {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook" as const,
      id: "world",
      body: emptyLorebookBody("World"),
    };
    const capabilities = await discoverCapabilities();
    const update = capabilities.find((item) => item.id === "lorebook.entries.update")!;
    const settings = capabilities.find((item) => item.id === "lorebook.settings.update")!;
    const changes = createChangeSession();
    changes.draft(update, {
      target: { id: "world" },
      entryId: original.body.entries[0]!.id,
      patch: { title: "Dragon" },
    }, original);
    const draft = changes.draft(settings, {
      target: { id: "world" },
      patch: { name: "Aetheria" },
    }, original);
    const bridge = {
      studioDir: "/fake",
      async deckCounts() { return []; },
      async list() { return []; },
      async read() { return original; },
      async save() { throw new Error("query must not write"); },
      async delete() { return false; },
    };
    const tool = createChangeQueryTool(changes);
    const ctx = { bridge, results: createResultStore() };

    const listed = JSON.parse((await tool.execute({ action: "list" }, ctx)).output);
    expect(listed.drafts).toHaveLength(1);
    expect(listed.drafts[0]).toMatchObject({
      id: draft.id,
      operationCount: 2,
      changeCount: 2,
    });

    const shown = JSON.parse((await tool.execute({
      action: "show",
      draftId: draft.id,
    }, ctx)).output);
    expect(shown.draft.operations.map((item: { capabilityId: string }) => item.capabilityId))
      .toEqual(["lorebook.entries.update", "lorebook.settings.update"]);
    expect(shown.draft.proposed.body.name).toBe("Aetheria");

    const valid = JSON.parse((await tool.execute({
      action: "validate",
      draftId: draft.id,
    }, ctx)).output);
    expect(valid).toMatchObject({
      draftId: draft.id,
      canonical: true,
      current: true,
      valid: true,
    });
  });
});
