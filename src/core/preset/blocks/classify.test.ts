/**
 * The classifier, and mostly the things it refuses to say.
 *
 * A classifier is easy to test on the cases it gets right and those tests prove very little. What
 * decides whether this one is safe to wire into coherence checking is where it abstains, so that is
 * most of what is pinned here.
 */
import { describe, expect, test } from "bun:test";
import { classifyBlock, classifyBlocks, coverage, fromPrompts } from "./classify";
import { findPattern } from "./patterns";

const block = (over: Partial<Parameters<typeof classifyBlock>[0]>) =>
  ({ identifier: "b", ...over });

describe("what it will say", () => {
  test("a marker is the engine's slot, whatever else is true of it", () => {
    const result = classifyBlock(block({ marker: true, content: "", name: "chatHistory" }));
    expect(result.pattern).toBe("engine-slot");
    expect(result.evidence).toBe("marker-flag");
  });

  test("a run of blank assignments is the initializer", () => {
    const content = "{{setvar::a::}}{{setvar::b::}}{{setvar::c::}}{{trim}}";
    expect(classifyBlock(block({ content })).pattern).toBe("variable-init");
  });

  test("writing values is a state writer", () => {
    const content = "{{setvar::pov::second person}}{{trim}}";
    const result = classifyBlock(block({ content }));
    expect(result.pattern).toBe("option-additive");
    expect(result.evidence).toBe("writes-state");
  });

  test("a drawn name over nothing is a divider, even when it holds a comment", () => {
    const result = classifyBlock(block({ name: "═══ OPTIONS ═══", content: "{{// a note}}" }));
    expect(result.pattern).toBe("divider");
  });

  test("every pattern it can emit exists in the catalog", () => {
    const emitted = ["engine-slot", "variable-init", "option-additive", "divider"];
    for (const id of emitted) expect(findPattern(id), `${id} is not a catalog pattern`).toBeDefined();
  });
});

describe("what it refuses to say", () => {
  test("prose is unknown, not guessed at a pattern that fits", () => {
    // Tracker, anti-slop, reasoning scaffold and the rest differ by what they SAY. Naming one from
    // structure would be a guess wearing a verdict's clothes.
    const result = classifyBlock(block({
      content: "Track time, location and who is present. Emit the readout each reply.",
      name: "Tracker",
    }));
    expect(result.pattern).toBeNull();
    expect(result.evidence).toBeNull();
  });

  test("a manifest of reads is never called the assembler", () => {
    // Measured: in every surveyed preset that assembles, the top two readers are within a factor of
    // two, and in one the biggest reader is a settings mirror. `assembler` carries the strongest
    // ordering rules in the catalog, so a wrong one reports a violation in a preset that works.
    const content = Array.from({ length: 40 }, (_, i) => `{{getvar::v${i}}}`).join("\n");
    expect(classifyBlock(block({ content })).pattern).toBeNull();
    expect(classifyBlocks([block({ content })])[0]!.pattern).toBeNull();
  });

  test("a state writer is never called exclusive, because that rule is the stronger one", () => {
    // option-exclusive adds "before the assembler"; option-additive does not. Guessing the weaker
    // rule can lose a finding and cannot manufacture one, and the assembler's own rule recovers it.
    const content = "{{setvar::pov::first person}}{{trim}}";
    expect(classifyBlock(block({ content })).pattern).not.toBe("option-exclusive");
    expect(findPattern("option-additive")?.ordering?.before).toBeUndefined();
    expect(findPattern("option-exclusive")?.ordering?.before).toContain("assembler");
  });

  test("empty with an ordinary name says nothing, because presets carry hundreds of those", () => {
    expect(classifyBlock(block({ name: "Notes", content: "   " })).pattern).toBeNull();
  });

  test("it reads no annotation vocabulary at all", () => {
    // Structure alone agreed with author-declared exclusivity 187 times out of 188, so reading the
    // annotation bought under one percent in exchange for depending on one community's private
    // vocabulary. A block whose ONLY content is an annotation stays a divider-or-unknown call.
    const annotated = classifyBlock(block({
      name: "Second person",
      content: "{{// @exclusive-with-category pov}}{{setvar::pov::second}}{{trim}}",
    }));
    expect(annotated.pattern).toBe("option-additive");
    expect(annotated.evidence).toBe("writes-state");
  });
});

describe("reporting", () => {
  test("coverage is stated, because a check over a third of a preset is a different claim", () => {
    const results = classifyBlocks([
      block({ identifier: "m", marker: true }),
      block({ identifier: "p", content: "just prose" }),
      block({ identifier: "w", content: "{{setvar::x::1}}" }),
    ]);
    expect(coverage(results)).toEqual({ known: 2, total: 3 });
  });

  test("canonical prompts convert without losing the marker flag", () => {
    const blocks = fromPrompts([
      { id: "chatHistory", name: "Chat History", content: "", marker: true, enabled: true },
    ] as never);
    expect(blocks[0]!.marker).toBe(true);
    expect(classifyBlocks(blocks)[0]!.pattern).toBe("engine-slot");
  });

  test("classification never reorders or drops a block", () => {
    const input = ["a", "b", "c"].map((id) => block({ identifier: id, content: "prose" }));
    expect(classifyBlocks(input).map((r) => r.identifier)).toEqual(["a", "b", "c"]);
  });
});
