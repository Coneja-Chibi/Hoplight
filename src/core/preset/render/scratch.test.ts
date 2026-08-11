/**
 * The scratch wire shapes, checked against what each adapter actually reads.
 *
 * These assertions are transcribed from the adapters' own assembly loops rather than from the
 * platforms' documentation, because the adapter is what will read this file. tools/renderers/
 * sillytavern/render.mjs walks `prompt_order[].order[]`, skips any entry without `enabled`, and
 * looks each `identifier` up in `prompts`; tools/renderers/marinara/render.ts walks
 * `data.sections[]` and skips `enabled === false`. Every one of those is a way to produce an empty
 * prompt that renders "clean", which is the single worst answer this surface can give.
 */
import { describe, expect, it } from "bun:test";
import { scratchWireFile } from "./scratch";

describe("scratchWireFile", () => {
  it("gives SillyTavern a block its prompt_order actually names and enables", () => {
    const wire = JSON.parse(scratchWireFile("sillytavern", "Hi {{char}}")) as {
      prompts: { identifier: string; content: string }[];
      prompt_order: { order: { identifier: string; enabled: boolean }[] }[];
    };

    expect(wire.prompts).toHaveLength(1);
    expect(wire.prompts[0]!.content).toBe("Hi {{char}}");

    // The two ids must be the same string, or the adapter assembles nothing at all.
    const ordered = wire.prompt_order.flatMap((g) => g.order);
    expect(ordered).toHaveLength(1);
    expect(ordered[0]!.identifier).toBe(wire.prompts[0]!.identifier);
    // `enabled` is load-bearing: the adapter's loop is `if (!entryRef?.enabled) continue`.
    expect(ordered[0]!.enabled).toBe(true);
  });

  it("gives Marinara an enabled section under data.sections", () => {
    const wire = JSON.parse(scratchWireFile("marinara", "Hi {{char}}")) as {
      data: { sections: { content: string; enabled: boolean }[] };
    };

    expect(wire.data.sections).toHaveLength(1);
    expect(wire.data.sections[0]!.content).toBe("Hi {{char}}");
    expect(wire.data.sections[0]!.enabled).toBe(true);
  });

  it("carries the text through untouched, braces and newlines included", () => {
    const text = "{{if::{{getvar::x}}::a::b}}\n\t\"quoted\" \\ {{// note}}";
    for (const engine of ["sillytavern", "marinara"] as const) {
      expect(scratchWireFile(engine, text)).toContain(JSON.stringify(text).slice(1, -1));
    }
  });

  it("writes empty text as an empty block rather than dropping it", () => {
    // Both adapters skip a block whose content does not trim to anything, so an empty scratch
    // renders to an empty prompt. That is the honest outcome; what must NOT happen is a wire file
    // with no block in it, which would look identical and mean something else.
    const st = JSON.parse(scratchWireFile("sillytavern", "")) as { prompts: unknown[] };
    const mar = JSON.parse(scratchWireFile("marinara", "")) as { data: { sections: unknown[] } };
    expect(st.prompts).toHaveLength(1);
    expect(mar.data.sections).toHaveLength(1);
  });
});
