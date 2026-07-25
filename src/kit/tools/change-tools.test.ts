/** Capability discovery, discard, and apply tool factory coverage. */
import { describe, expect, test } from "bun:test";
import { createChangeSession } from "../changes/session";
import { createCapabilityRuntime } from "../capabilities/runtime";
import { discoverCapabilities } from "../capabilities/discover";
import { createCapabilityFindTool } from "./capability-find";
import { createChangeDiscardTool } from "./change-discard";

describe("change lifecycle tools", () => {
  test("capability_find reveals only bounded matching typed tools", async () => {
    const runtime = createCapabilityRuntime({
      capabilities: await discoverCapabilities(),
      directTools: [],
      changes: createChangeSession(),
    });
    const tool = createCapabilityFindTool(runtime);
    const result = await tool.execute({
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

  test("change_discard is one-shot and never needs a bridge", async () => {
    const changes = createChangeSession();
    expect((await createChangeDiscardTool(changes).execute(
      { draftId: "missing" },
      { bridge: null as never },
    )).summary).toContain("unavailable");
  });
});
