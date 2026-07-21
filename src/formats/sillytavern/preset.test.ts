/**
 * ST completion-preset codec tests: the Round-Trip Law (parse -> serialize -> parse deep-equal),
 * the spec's enabled/prompt_order law, the 5-vs-12 marker regression, divider groups, and the
 * bundled-regex extraction seam. Fixture: samples/sillytavern/presets/spec-walk.preset.json.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import presetAdapter from "./preset";
import type { CanonicalPreset } from "../../entities/preset/schema";

const FIXTURE = readFileSync(
  join(import.meta.dir, "../../../samples/sillytavern/presets/spec-walk.preset.json"),
  "utf8",
);
const input = { text: FIXTURE, filename: "spec-walk.preset.json" };
const parse = (): CanonicalPreset => presetAdapter.toCanonical(input);

describe("detect", () => {
  test("claims the fixture and plain preset shapes", () => {
    expect(presetAdapter.detect(input)).toBe(0.9);
    expect(presetAdapter.detect({ text: JSON.stringify({ temperature: 1, top_p: 0.9 }) })).toBe(0.9);
    expect(presetAdapter.detect({ text: JSON.stringify({ prompts: [], prompt_order: [] }) })).toBe(0.9);
  });

  test("refuses templates, envelopes, wrappers, and textgen grids", () => {
    expect(presetAdapter.detect({ text: JSON.stringify({ name: "I", system_prompt: "x", input_sequence: "a", output_sequence: "b" }) })).toBe(0);
    expect(presetAdapter.detect({ text: JSON.stringify({ name: "C", story_string: "{{system}}" }) })).toBe(0);
    expect(presetAdapter.detect({ text: JSON.stringify({ type: "lumiverse_preset", data: {} }) })).toBe(0);
    expect(presetAdapter.detect({ text: JSON.stringify({ type: "marinara_preset", data: { preset: {}, sections: [] } }) })).toBe(0);
    expect(presetAdapter.detect({ text: JSON.stringify({ exportedAt: "t", type: "preset", version: "1.0", data: { temperature: 1 } }) })).toBe(0);
    expect(presetAdapter.detect({ text: JSON.stringify({ temp: 0.7, top_p: 0.9, top_k: 40 }) })).toBe(0);
  });
});

describe("parse", () => {
  test("name comes from the filename; settings groups map sparsely", () => {
    const e = parse();
    expect(e.body.name).toBe("spec-walk.preset");
    expect(e.body.samplers?.temperature).toBe(0.9);
    expect(e.body.samplers?.maxContext).toBe(32000);
    expect(e.body.apiOptions?.reasoningEffort).toBe("high");
    expect(e.body.generation?.completions).toBe(1);
    expect(e.body.media?.imageInlining).toBe(false);
    expect(e.body.templates?.worldInfoFormat).toBe("[World: {0}]");
  });

  test("the enabled law: global order wins, orphans append disabled, duplicates skip", () => {
    const e = parse();
    const ids = e.body.prompts.map((p) => p.id);
    // divider row is NOT a prompt; orphan appended last
    expect(ids).toEqual([
      "main",
      "5c1f0a52-19f6-4b58-b6ed-116e6ad565c9",
      "chatHistory",
      "worldInfoBefore",
      "0af1b2c3-d4e5-4f60-8172-93a4b5c6d7e8",
    ]);
    const byId = new Map(e.body.prompts.map((p) => [p.id, p]));
    expect(byId.get("main")!.enabled).toBe(true);
    expect(byId.get("5c1f0a52-19f6-4b58-b6ed-116e6ad565c9")!.enabled).toBe(false); // order says off
    expect(byId.get("5c1f0a52-19f6-4b58-b6ed-116e6ad565c9")!.content).toBe("Write vivid prose. No purple filler."); // first duplicate wins
    expect(byId.get("0af1b2c3-d4e5-4f60-8172-93a4b5c6d7e8")!.enabled).toBe(false); // orphan forced off
    const warnings = e.original?.sillytavern?.unmapped?.["parseWarnings"] as string[];
    expect(warnings.join(" ")).toContain("duplicate prompt identifier");
  });

  test("the 5-vs-12 marker law: main is content, chatHistory is a marker with a slot", () => {
    const e = parse();
    const byId = new Map(e.body.prompts.map((p) => [p.id, p]));
    expect(byId.get("main")!.marker).toBe(false);
    expect(byId.get("main")!.isDefault).toBe(true);
    expect(byId.get("chatHistory")!.marker).toBe(true);
    expect(byId.get("chatHistory")!.markerSlot).toBe("chatHistory");
    // a marker with customized injection metadata keeps it (depth 7)
    expect(byId.get("worldInfoBefore")!.injectionDepth).toBe(7);
  });

  test("legacy dividers become groups; member prompts carry groupId", () => {
    const e = parse();
    expect(e.body.groups).toHaveLength(1);
    const g = e.body.groups![0]!;
    expect(g.id).toBe("━━━ Style ━━━"); // the ORIGINAL divider identifier, replayed on emit
    expect(g.name).toBe("Style");
    const prose = e.body.prompts.find((p) => p.name === "Prose rules")!;
    expect(prose.groupId).toBe(g.id);
    expect(e.body.prompts.find((p) => p.id === "main")!.groupId).toBeUndefined();
  });
});

describe("the Round-Trip Law (semantic level)", () => {
  test("parse -> serialize -> parse is deep-equal in body", () => {
    const first = parse();
    const emitted = presetAdapter.fromCanonical(first);
    const second = presetAdapter.toCanonical({ text: emitted.text!, filename: "spec-walk.preset.json" });
    expect(second.body).toEqual(first.body);
  });

  test("unknown top-level keys survive the emit untouched", () => {
    const emitted = JSON.parse(presetAdapter.fromCanonical(parse()).text!) as Record<string, unknown>;
    expect(emitted.custom_unknown_knob).toEqual({ keep: "me" });
    expect(emitted.another_unknown).toBe(7);
  });

  test("marker regression: main's content is never sparse-dropped; enabled never rides on rows", () => {
    const emitted = JSON.parse(presetAdapter.fromCanonical(parse()).text!) as {
      prompts: Record<string, unknown>[];
      prompt_order: { character_id: unknown; order: { identifier: string; enabled: boolean }[] }[];
    };
    const main = emitted.prompts.find((p) => p.identifier === "main")!;
    expect(main.content).toBe("You are {{char}}. Stay in character.");
    for (const p of emitted.prompts) expect("enabled" in p).toBe(false);
    // sparse shape for the all-default marker, full shape for the customized one
    const ch = emitted.prompts.find((p) => p.identifier === "chatHistory")!;
    expect(Object.keys(ch).sort()).toEqual(["identifier", "marker", "name", "system_prompt"]);
    const wib = emitted.prompts.find((p) => p.identifier === "worldInfoBefore")!;
    expect(wib.injection_depth).toBe(7);
  });

  test("per-character prompt_order survives verbatim; the global entry is rebuilt with enabled", () => {
    const emitted = JSON.parse(presetAdapter.fromCanonical(parse()).text!) as {
      prompt_order: { character_id: unknown; order: { identifier: string; enabled: boolean }[] }[];
    };
    const perChar = emitted.prompt_order.find((o) => o.character_id === 424242)!;
    expect(perChar.order).toEqual([
      { identifier: "main", enabled: false },
      { identifier: "chatHistory", enabled: true },
    ]);
    const global = emitted.prompt_order.find((o) => o.character_id === 100001)!;
    const dividerRef = global.order.find((o) => o.identifier === "━━━ Style ━━━");
    expect(dividerRef).toEqual({ identifier: "━━━ Style ━━━", enabled: true });
    expect(global.order.find((o) => o.identifier === "5c1f0a52-19f6-4b58-b6ed-116e6ad565c9")!.enabled).toBe(false);
    expect(global.order.at(-1)).toEqual({ identifier: "0af1b2c3-d4e5-4f60-8172-93a4b5c6d7e8", enabled: false });
  });
});

describe("bundled regex", () => {
  test("extractRegex surfaces extensions.regex_scripts as a canonical set", () => {
    const set = presetAdapter.extractRegex!(parse());
    expect(set).not.toBeNull();
    expect(set!.kind).toBe("regex");
    expect(set!.body.rules).toHaveLength(1);
    expect(set!.body.name).toBe("spec-walk.preset regex");
  });

  test("no extensions block means no set (tolerant)", () => {
    const bare = presetAdapter.toCanonical({ text: JSON.stringify({ temperature: 1, top_p: 1 }), filename: "b.json" });
    expect(presetAdapter.extractRegex!(bare)).toBeNull();
  });
});

describe("nemo-wiki dialect", () => {
  test("wiki categories and subcategories nest; sibling subs do not matryoshka", () => {
    const raw = {
      prompts: [
        { identifier: "cat-1", name: "===Pacing===", content: "" },
        { identifier: "sub-1", name: "<Fast>", content: "" },
        { identifier: "p1", name: "Sprint", content: "go", role: "system", system_prompt: false },
        { identifier: "sub-2", name: "<Slow>", content: "" },
        { identifier: "p2", name: "Linger", content: "stay", role: "system", system_prompt: false },
      ],
      prompt_order: [],
    };
    const e = presetAdapter.toCanonical({ text: JSON.stringify(raw), filename: "wiki.json" });
    expect(e.body.groups?.map((g) => [g.name, g.parentGroupId ?? null])).toEqual([
      ["Pacing", null],
      ["Fast", "cat-1"],
      ["Slow", "cat-1"],
    ]);
    expect(e.body.prompts.find((p) => p.id === "p2")!.groupId).toBe("sub-2");
    // and the wiki dialect round-trips
    const again = presetAdapter.toCanonical({ text: presetAdapter.fromCanonical(e).text!, filename: "wiki.json" });
    expect(again.body).toEqual(e.body);
  });
});
