/**
 * Full fake-provider journey from bounded capability discovery to verified Studio persistence.
 */
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyLorebookBody } from "../core/lore";
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";
import { createBridge } from "./bridge";
import { discoverCapabilities } from "./capabilities/discover";
import { createCapabilityRuntime } from "./capabilities/runtime";
import { createChangeSession } from "./changes/session";
import { makeDispatch, toolSpecs } from "./loop/dispatch";
import { runTurn } from "./loop/loop-core";
import type { ChatFn, ToolSpec } from "./providers/provider";
import { discoverTools } from "./tools/discover";
import { createCapabilityFindTool } from "./tools/capability-find";
import { createChangeApplyTool } from "./tools/change-apply";
import { createChangeDiscardTool } from "./tools/change-discard";

const root = mkdtempSync(join(tmpdir(), "hoplight-kit-capability-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("a provider discovers one typed edit, previews it, applies once, and observes verified content", async () => {
  const bridge = createBridge(root);
  const baseline: ParsedCanonicalEntity = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: "world",
    body: emptyLorebookBody("World"),
  };
  await bridge.save(baseline);

  const [directTools, capabilities] = await Promise.all([
    discoverTools(),
    discoverCapabilities(),
  ]);
  const changes = createChangeSession();
  const runtime = createCapabilityRuntime({ capabilities, directTools, changes });
  const lifecycle = [
    createCapabilityFindTool(runtime),
    createChangeApplyTool(changes),
    createChangeDiscardTool(changes),
  ];
  const tools = [...runtime.registeredTools(), ...lifecycle];
  const dispatch = makeDispatch(tools, { bridge });
  const lifecycleSpecs = toolSpecs(lifecycle);
  const effects = new Map(tools.map((tool) => [tool.name, tool.effect]));
  const activities = new Map(tools.map((tool) => [tool.name, tool.activity]));
  const snapshots: string[][] = [];
  let round = 0;
  const chat: ChatFn = async (_messages, specs: ToolSpec[]) => {
    snapshots.push(specs.map((spec) => spec.name));
    round += 1;
    if (round === 1) {
      return {
        kind: "use",
        text: "",
        calls: [{
          id: "find",
          name: "capability_find",
          args: {
            action: "search",
            target: { kind: "lorebook", id: "world" },
            query: "rename lorebook",
          },
        }],
      };
    }
    if (round === 2) {
      return {
        kind: "use",
        text: "",
        calls: [{
          id: "draft",
          name: "lorebook_settings_update",
          args: {
            target: { id: "world" },
            patch: { name: "Aetheria" },
          },
        }],
      };
    }
    if (round === 3) {
      return {
        kind: "use",
        text: "",
        calls: [{
          id: "apply",
          name: "change_apply",
          args: { draftId: "draft-1" },
        }],
      };
    }
    return { kind: "say", text: "The lorebook rename was verified." };
  };

  const events = [];
  const turn = runTurn("Rename World to Aetheria.", [], {
    chat,
    dispatch,
    toolSnapshot: () => [...runtime.toolSnapshot(), ...lifecycleSpecs],
    effectFor: (call) => effects.get(call.name),
    activityFor: (call) => activities.get(call.name),
    maxSteps: 6,
  });
  let next = await turn.next();
  while (!next.done) {
    events.push(next.value);
    next = await turn.next();
  }

  expect(snapshots[0]).toContain("docs_query");
  expect(snapshots[0]).not.toContain("lorebook_settings_update");
  expect(snapshots[1]).toContain("lorebook_settings_update");
  expect(snapshots[1]?.filter((name) => name.startsWith("lorebook_"))).toEqual([
    "lorebook_settings_update",
  ]);
  expect(events).toContainEqual({
    type: "tool",
    name: "change_apply",
    summary: "apply draft-1: applied",
  });
  expect(events).toContainEqual({ type: "state", phase: "completed" });
  const saved = await bridge.read("lorebook", "world");
  expect(saved?.kind).toBe("lorebook");
  if (!saved || saved.kind !== "lorebook") throw new Error("verified lorebook was not readable");
  expect((saved.body as { name?: unknown }).name).toBe("Aetheria");
});
