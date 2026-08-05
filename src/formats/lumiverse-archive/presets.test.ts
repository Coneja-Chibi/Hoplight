/**
 * The preset slice: prompts and prompt_order join by identifier into a real preset via the existing
 * Lumiverse preset codec, the fixture's pre_history block and its depth block land as distinguishable
 * canonical placements, and a broken prompts column fails the row (unlike personas/world_books,
 * where the sole JSON column is never consumed and never gates).
 */
import { describe, expect, test } from "bun:test";
import { buildBadRowsLvbak, buildMinimalLvbak } from "../_fixtures/lumiverse-archive/build-lvbak";
import { PRESET_ID } from "../_fixtures/lumiverse-archive/rows";
import { createLinkMap } from "./links";
import { ndjsonLineCeiling } from "./ndjson";
import { importPresets, presetRowToWrapper } from "./presets";
import { createLvbakReport } from "./report";
import type { InnerJsonResult } from "./tables";
import { zipEntrySource } from "./zip-source";

const V1_CEILING = ndjsonLineCeiling(1);

describe("presetRowToWrapper", () => {
  test("joins prompts and prompt_order by identifier; an orphan prompt rides disabled at the end", () => {
    const row = { id: "p1", name: "P", description: "D", provider: "prov", engine: "eng" };
    const inner: InnerJsonResult = {
      values: {
        prompts: {
          a: { name: "A", content: "ca", enabled: true },
          b: { name: "B", content: "cb", enabled: true },
          orphan: { name: "Orphan", content: "co", enabled: true },
        },
        prompt_order: [
          { identifier: "a", enabled: true, depth: 2, position: "depth", role: "system", injectionTrigger: ["x"] },
          { identifier: "b", enabled: false, depth: 4, position: "pre_history", role: "user" },
          { identifier: "missing", enabled: true }, // no matching prompt: never becomes a block
        ],
        parameters: { customBody: { x: 1 }, samplerOverrides: { temperature: 0.5 } },
        metadata: { m: 1 },
      },
      failures: [],
    };

    const wrapper = presetRowToWrapper(row, inner);
    expect(wrapper.type).toBe("lumiverse_preset");
    const preset = wrapper.preset as Record<string, unknown>;
    expect(preset.name).toBe("P");
    expect(preset.description).toBe("D");
    expect(preset.provider).toBe("prov");
    expect(preset.engine).toBe("eng");
    expect(preset.customBody).toEqual({ x: 1 });
    expect(preset.samplerOverrides).toEqual({ temperature: 0.5 });
    expect(preset.metadata).toEqual({ m: 1 });

    const blocks = preset.blocks as Record<string, unknown>[];
    expect(blocks.map((b) => b.id)).toEqual(["a", "b", "orphan"]);
    expect(blocks[0]).toMatchObject({ position: "depth", depth: 2, enabled: true, injectionTrigger: ["x"] });
    expect(blocks[1]).toMatchObject({ position: "pre_history", enabled: false }); // its own order entry said false
    expect(blocks[2]).toMatchObject({ enabled: false }); // no order entry ever placed it
  });

  test("a block is enabled only when BOTH its order entry and its prompt are not explicitly false", () => {
    const row = { id: "p", name: "P" };
    const inner: InnerJsonResult = {
      values: {
        prompts: { a: { name: "A", content: "c", enabled: false } },
        prompt_order: [{ identifier: "a", enabled: true }],
      },
      failures: [],
    };
    const blocks = (presetRowToWrapper(row, inner).preset as Record<string, unknown>).blocks as Record<
      string,
      unknown
    >[];
    expect(blocks[0]!.enabled).toBe(false);
  });
});

describe("importPresets", () => {
  test("the fixture's pre_history and depth blocks land as distinguishable canonical placements", async () => {
    const source = zipEntrySource(buildMinimalLvbak());
    const report = createLvbakReport();
    const links = createLinkMap();
    const entities = await importPresets(source, { lineCeiling: V1_CEILING, report, links });

    expect(entities).toHaveLength(1);
    const entity = entities[0]!;
    if (entity.kind !== "preset") throw new Error("no preset in the result");
    expect(entity.body.name).toBe("Test Preset Alpha");

    const byId = new Map(entity.body.prompts.map((p) => [p.id, p]));
    const main = byId.get("blk-main")!;
    const post = byId.get("blk-post-history")!;
    // pre_history: the still-open spec question, unchanged relative default
    expect(main.placement).toBe("relative");
    // depth: the one verified mapping, in-chat at the block's own depth
    expect(post.placement).toBe("in_chat");
    expect(post.injectionDepth).toBe(4);
    expect(post.injectionTrigger).toEqual(["normal"]);

    expect(entity.body.samplers).toMatchObject({ temperature: 0.85, topP: 0.92, maxTokens: 512 });

    // description has no wrapper slot the codec's own toCanonical reads: a real, named gap, not a bug
    // in this synthesis (verified against preset.ts directly), so it never reaches the canonical body
    expect(entity.body.description).toBeUndefined();

    // the codec's own wrapper twin escrows everything this synthesis had no consumed slot for
    const wrapper = entity.original!.lumiverse!.raw as { preset: Record<string, unknown> };
    expect(wrapper.preset.description).toBe("A synthetic preset for fixture use.");
    expect(wrapper.preset.customBody).toEqual({ top_k: 40 });
    expect(wrapper.preset.provider).toBe("openai-compatible");
    expect(wrapper.preset.engine).toBe("chat-completions");
    expect(wrapper.preset.metadata).toEqual({ source: "fixture" });

    // the archive's own raw-row twin is always there too, verbatim, regardless of the wrapper
    const archived = entity.original!["lumiverse-archive"]!.raw as { prompts: string };
    expect(typeof archived.prompts).toBe("string");

    expect(report.imported.preset).toEqual([{ id: entity.id, name: "Test Preset Alpha" }]);
    const resolved = links.resolve("x", "presets", PRESET_ID, createLvbakReport());
    expect(resolved).toEqual({ id: entity.id, name: "Test Preset Alpha" });
  });

  test("a broken prompts column fails the row; prompts/prompt_order/parameters are consumed, so this gates", async () => {
    const source = zipEntrySource(buildBadRowsLvbak());
    const report = createLvbakReport();
    const links = createLinkMap();
    const entities = await importPresets(source, { lineCeiling: V1_CEILING, report, links });

    // only the valid preset survives; the broken one never dispatches at all
    expect(entities).toHaveLength(1);
    expect(entities[0]!.kind === "preset" && entities[0]!.body.name).toBe("Test Preset Alpha");

    const failure = report.failed.find((f) => f.table === "presets");
    expect(failure).toBeDefined();
    expect(failure!.rowId).toBe("lv-preset-000000000002");
    expect(failure!.reason.startsWith("prompts")).toBe(true);
  });
});
