/**
 * Copying prompt blocks between presets.
 *
 * The assertions worth having are the ones about IDENTITY and ORDER. A copy that silently renames
 * nothing collides two blocks onto one id, and a copy that inserts each block at the same anchor
 * lands a run of them backwards - both produce a preset that looks plausible and is wrong, which is
 * the expensive kind of wrong for something somebody asked to be copied exactly.
 */
import { describe, expect, test } from "bun:test";
import { createPresetCopyBlocksTool } from "./preset-copy-blocks";
import { createChangeSession } from "../changes/session";
import type { KitBridge } from "../bridge";
import type { PresetPrompt } from "../../entities/preset/schema";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";

const block = (id: string, name: string, content: string): PresetPrompt => ({
  id, name, content,
  role: "system", enabled: true, systemPrompt: false, marker: false,
  placement: "relative", injectionDepth: 0, injectionOrder: 0, forbidOverrides: false,
});

const preset = (id: string, prompts: PresetPrompt[]) => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "preset" as const,
  id,
  // prompts IS the order; PresetBody has no separate order array.
  body: { name: id, prompts },
});

const SOURCE = preset("astrolabe", [
  block("readme", "README", "THE ORIGINAL TEXT"),
  block("rules", "Rules", "rule text"),
  block("voice", "Voice", "voice text"),
]);
const TARGET = preset("clean", [block("intro", "Intro", "intro text")]);

const bridgeWith = (pieces: Record<string, unknown>): KitBridge =>
  ({ read: (_kind: string, id: string) => Promise.resolve(pieces[id] ?? null) }) as unknown as KitBridge;

async function copy(
  args: Record<string, unknown>,
  pieces: Record<string, unknown> = { astrolabe: SOURCE, clean: TARGET },
) {
  const changes = createChangeSession();
  const tool = createPresetCopyBlocksTool(changes);
  const result = await tool.execute(
    args as Parameters<typeof tool.execute>[0],
    { bridge: bridgeWith(pieces) } as unknown as Parameters<typeof tool.execute>[1],
  );
  return { result, changes };
}

describe("preset_copy_blocks", () => {
  test("THE CONTENT ARRIVES EXACTLY, which is the whole reason this is a tool", async () => {
    /**
     * The model could always read a preset and call blocks.add with the text typed back out. That
     * is what this exists to avoid: a 3.8k block retyped through a model is expensive, lossy, and
     * silently different from what was copied.
     */
    const { result, changes } = await copy({
      fromPreset: "astrolabe", toPreset: "clean", blockIds: ["readme"],
    });
    const draft = changes.get(JSON.parse(result.output).draftId as string);
    const landed = (draft?.proposed.body as { prompts: PresetPrompt[] }).prompts
      .find((p) => p.name === "README");
    expect(landed?.content).toBe("THE ORIGINAL TEXT");
  });

  test("A RANGE LANDS IN THE ORDER IT WAS ASKED FOR", async () => {
    // Inserting each block at the same anchor reverses the run. The tool walks the anchor forward
    // after each one, so "readme, rules, voice" arrives as readme, rules, voice.
    const { result, changes } = await copy({
      fromPreset: "astrolabe", toPreset: "clean", blockIds: ["readme", "rules", "voice"],
    });
    const draft = changes.get(JSON.parse(result.output).draftId as string);
    const names = (draft?.proposed.body as { prompts: PresetPrompt[] }).prompts.map((p) => p.name);
    expect(names).toEqual(["Intro", "README", "Rules", "Voice"]);
  });

  test("COPYING INTO THE SAME PRESET RENAMES, so two blocks never share an id", async () => {
    /**
     * The ordinary case that produces a collision, not an exotic one. Two blocks on one id means
     * every later operation that addresses a block by id - move, patch, remove, group - hits
     * whichever comes first, and the other is unreachable.
     */
    const { result, changes } = await copy({
      fromPreset: "astrolabe", toPreset: "astrolabe", blockIds: ["readme"],
    });
    const draft = changes.get(JSON.parse(result.output).draftId as string);
    const ids = (draft?.proposed.body as { prompts: PresetPrompt[] }).prompts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("readme");
    // And it says so, because a rename somebody did not ask for is worth one sentence.
    expect(draft?.operations[0]?.warnings.join(" ")).toContain("renamed");
  });

  test("placement is honoured", async () => {
    const { result, changes } = await copy({
      fromPreset: "astrolabe", toPreset: "clean", blockIds: ["readme"], place: "first",
    });
    const draft = changes.get(JSON.parse(result.output).draftId as string);
    const names = (draft?.proposed.body as { prompts: PresetPrompt[] }).prompts.map((p) => p.name);
    expect(names[0]).toBe("README");
  });

  test("A BLOCK THAT IS NOT THERE REFUSES THE WHOLE COPY", async () => {
    /**
     * Copying three of the four blocks somebody asked for, and reporting success, is only ever
     * discovered later by the person who trusted the report.
     */
    const { result, changes } = await copy({
      fromPreset: "astrolabe", toPreset: "clean", blockIds: ["readme", "ghost"],
    });
    expect(result.output).toContain("ghost");
    expect(result.output).toContain("Nothing was copied");
    expect(result.outcome).toBeUndefined();
    expect(changes.list()).toHaveLength(0);
  });

  test("a missing preset is reported, not thrown", async () => {
    const { result } = await copy(
      { fromPreset: "nowhere", toPreset: "clean", blockIds: ["readme"] },
      { clean: TARGET },
    );
    expect(result.summary).toContain("not found");
  });

  test("IT STAGES, IT DOES NOT WRITE", async () => {
    // The draft meets the ordinary Gate. A copy that applied itself would be the one write in the
    // studio that skipped review, and it would be the one that moves the most text.
    const { result } = await copy({
      fromPreset: "astrolabe", toPreset: "clean", blockIds: ["readme"],
    });
    expect(result.outcome).toBe("draft");
    expect(result.review).toBeDefined();
  });
});
