/**
 * The block_lookup tool.
 *
 * The risk it exists to reduce is a model writing a block that expands perfectly and is
 * architecturally wrong, so the tests are about whether the facts that prevent that actually reach a
 * caller: the emits field, the ordering rules, and the hazards.
 */
import { describe, expect, test } from "bun:test";
import tool from "./block-lookup";
import type { ToolContext } from "./tool";

const ctx = {} as ToolContext;
const run = (args: Record<string, unknown>) => tool.execute(tool.input.parse(args), ctx);

describe("block_lookup", () => {
  test("is read-only and directly visible", () => {
    expect(tool.effect).toBe("read");
    expect(tool.exposure).toBe("direct");
  });

  test("list carries emits, which is the fact a model gets wrong first", async () => {
    // Most blocks in a variable-driven preset render nothing. A model that does not know that writes
    // a tracker which prints inline instead of writing variables for an assembler.
    const out = JSON.parse((await run({ action: "list" })).output) as { id: string; emits: string }[];
    expect(out.length).toBeGreaterThan(20);
    expect(out.find((p) => p.id === "variable-init")!.emits).toBe("nothing");
    expect(out.find((p) => p.id === "assembler")!.emits).toBe("text");
  });

  test("explain carries the ordering rule and the hazards, not just a description", async () => {
    const out = JSON.parse((await run({ action: "explain", pattern: "assembler" })).output) as {
      ordering?: { requires?: string[] };
      hazards?: unknown[];
      seenIn: string;
    };
    expect(out.ordering?.requires).toContain("variable-init");
    expect(out.hazards?.length).toBeGreaterThan(0);
    // Prevalence separates a near-universal convention from one author's idea.
    expect(out.seenIn).toContain("of 13");
  });

  test("an unknown pattern lists the real ones instead of failing blankly", async () => {
    const result = await run({ action: "explain", pattern: "not-a-pattern" });
    expect(result.output).toContain("Known patterns");
    expect(result.output).toContain("assembler");
  });

  test("skeleton hands over the edit note, so a placeholder is not shipped as finished", async () => {
    const out = JSON.parse((await run({ action: "skeleton", pattern: "tracker" })).output) as {
      content: string;
      changeFirst: string;
    };
    expect(out.content).toContain("{{getvar::");
    expect(out.changeFirst.length).toBeGreaterThan(20);
  });

  test("a pattern with no skeleton SAYS SO rather than returning nothing", async () => {
    // Compliance shaping is catalogued and deliberately ships no starting block. An empty result
    // would read as a bug and invite a retry.
    const result = await run({ action: "skeleton", pattern: "compliance-shaping" });
    expect(result.output).toContain("no starting block");
  });

  test("check finds a module ordered after the assembler that reads it", async () => {
    // The defect the survey found in the wild, which renders as a complete preset.
    const result = await run({
      action: "check",
      blocks: [
        { identifier: "init", pattern: "variable-init" },
        { identifier: "render", pattern: "assembler" },
        { identifier: "pov", pattern: "option-exclusive" },
      ],
    });
    expect(result.summary).toContain("finding");
    expect(result.output).toContain("out-of-order");
  });

  test("check on a correct arrangement says what it did NOT check", async () => {
    const result = await run({
      action: "check",
      blocks: [
        { identifier: "init", pattern: "variable-init" },
        { identifier: "pov", pattern: "option-exclusive" },
        { identifier: "render", pattern: "assembler" },
      ],
    });
    expect(result.summary).toContain("no ordering problems");
    // Coherence is not resolution; conflating them would let this read as a full pass.
    expect(result.output).toContain("preset_verify");
  });

  test("check with no blocks asks for them rather than reporting clean", async () => {
    const result = await run({ action: "check" });
    expect(result.summary).toContain("no blocks");
    expect(result.summary).not.toContain("no ordering problems");
  });
});

describe("check classifies what it was not told", () => {
  test("an unlabelled preset is checkable, and the coverage is stated", async () => {
    // The case this exists for: a preset somebody imported, where nobody hand-labelled anything.
    const result = await tool.execute({
      action: "check",
      blocks: [
        { identifier: "hp_init", enabled: true, content: "{{setvar::a::}}{{setvar::b::}}{{setvar::c::}}" },
        { identifier: "pov", enabled: true, content: "{{setvar::pov::second}}{{trim}}" },
        { identifier: "chatHistory", enabled: true, marker: true, content: "" },
        { identifier: "prose", enabled: true, content: "Write vividly." },
      ],
    }, ctx);
    expect(result.output).toContain("Checked 3 of 4 blocks");
    expect(result.output).toContain("3 classified from structure");
    expect(result.output).toContain("1 could not be identified");
  });

  test("a caller's own label wins over the classifier", async () => {
    // They may know something structure cannot show; the classifier only fills gaps.
    const result = await tool.execute({
      action: "check",
      blocks: [
        { identifier: "writer", enabled: true, pattern: "option-exclusive", content: "{{setvar::x::1}}" },
        { identifier: "init", enabled: true, content: "{{setvar::a::}}{{setvar::b::}}{{setvar::c::}}" },
      ],
    }, ctx);
    // option-exclusive must follow variable-init; here it precedes it, so the label was honoured.
    expect(result.summary).toContain("finding");
  });
});
