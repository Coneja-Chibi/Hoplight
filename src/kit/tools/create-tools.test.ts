/** Creation workflow coverage for every canonical kind and media-field schema guidance. */
import { expect, test } from "bun:test";
import { createChangeSession } from "../changes/session";
import { discoverCapabilities } from "../capabilities/discover";
import { createCapabilityRuntime } from "../capabilities/runtime";
import { toolSpecs } from "../loop/dispatch";
import type { KitBridge } from "../bridge";
import characterCreate from "./character-create";
import lorebookCreate from "./lorebook-create";
import packCreate from "./pack-create";
import personaCreate from "./persona-create";
import presetCreate from "./preset-create";
import regexCreate from "./regex-create";
import type { HarnessTool } from "./tool";
import { createCapabilityFindTool } from "./capability-find";

const bridge: KitBridge = {
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list() { return []; },
  async read() { return null; },
  async save() { throw new Error("create preview must not write"); },
  async delete() { return false; },
};

const cases = [
  [characterCreate, { name: "Eros" }, "character"],
  [lorebookCreate, { name: "Olympus" }, "lorebook"],
  [personaCreate, { name: "Chi", content: "I build worlds." }, "persona"],
  [presetCreate, { name: "Mythic prose" }, "preset"],
  [regexCreate, { name: "Cleanup" }, "regex"],
  [packCreate, {
    name: "Eros expressions",
    items: [{
      id: "neutral",
      label: "neutral",
      ref: "data:image/png;base64,AA",
      mime: "image/png",
    }],
  }, "pack"],
] as const;

test("every canonical kind has a discoverable preview-only create workflow", async () => {
  for (const [tool, rawArgs, kind] of cases) {
    expect(tool.exposure).toBe("deferred");
    expect(tool.effect).toBe("draft");
    expect(tool.discovery).toMatchObject({
      id: `studio.${kind}.create`,
      domain: "studio",
      kind,
      area: "lifecycle",
      action: "create",
    });
    const generic = tool as HarnessTool<unknown>;
    const args = generic.input.parse(rawArgs);
    const result = await generic.execute(args, {
      bridge,
      changes: createChangeSession(),
    });
    expect(result.outcome).toBe("draft");
    expect(result.review?.target.kind).toBe(kind);
  }
});

test("creation schemas explain media refs and MIME fields to the model", () => {
  const schemas = JSON.stringify(toolSpecs([characterCreate, personaCreate, packCreate]));
  expect(schemas).toContain("data URI");
  expect(schemas).toContain("MIME");
  expect(schemas).toContain("image/png");
  expect(schemas).toContain("portrait");
  expect(schemas).toContain("expression");
});

test("studio lifecycle browse exposes creation for all six kinds", async () => {
  const createTools = cases.map(([tool]) => tool as HarnessTool);
  const runtime = createCapabilityRuntime({
    capabilities: await discoverCapabilities(),
    directTools: createTools,
    changes: createChangeSession(),
  });
  const found = await createCapabilityFindTool(runtime).execute({
    action: "browse",
    domain: "studio",
    area: "lifecycle",
  }, { bridge });
  const output = JSON.parse(found.output) as {
    capabilities: Array<{ id: string }>;
  };
  expect(output.capabilities.map((item) => item.id)).toEqual([
    "studio.character.create",
    "studio.lorebook.create",
    "studio.pack.create",
    "studio.persona.create",
    "studio.preset.create",
    "studio.regex.create",
  ]);
});
