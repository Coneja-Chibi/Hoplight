/**
 * What the rail stages, as pure data.
 *
 * These are the awkward cases: an edit that changes nothing must not look like a change, and a
 * retyped block must keep every field the rail does not show. Both are invisible by eye in a
 * terminal and both have a wrong answer that looks almost right.
 */
import { describe, expect, test } from "bun:test";
import { applyRailEdits } from "./rail-apply";

describe("rail edits carry a retyped name, body and preset title", () => {
  /**
   * The rail could reorder and toggle and nothing else, so renaming a block or fixing a typo in one
   * meant leaving for another surface. These ride the same staged draft as every other rail edit and
   * meet the same Gate; nothing here writes.
   */
  const body = {
    name: "Old Title",
    prompts: [
      { id: "a", name: "First", content: "one", enabled: true, role: "system", marker: false, systemPrompt: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false },
      { id: "b", name: "Second", content: "two", enabled: true, role: "system", marker: false, systemPrompt: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false },
    ],
  } as never;

  const rowsFor = (extra: Record<string, unknown> = {}) => [
    { index: 0, id: "a", name: "First", enabled: true, marker: false, size: 3, ...extra },
    { index: 1, id: "b", name: "Second", enabled: true, marker: false, size: 3 },
  ] as never;

  test("a retyped block name lands on that block only", () => {
    const out = applyRailEdits(body, rowsFor({ editedName: "Opening" }));
    expect(out.body.prompts[0]?.name).toBe("Opening");
    expect(out.body.prompts[1]?.name).toBe("Second");
  });

  test("retyped content lands without disturbing the rest of the prompt", () => {
    const out = applyRailEdits(body, rowsFor({ editedContent: "rewritten" }));
    expect(out.body.prompts[0]?.content).toBe("rewritten");
    // The fields the rail never shows must survive: rebuilding a prompt from a row would drop them.
    expect(out.body.prompts[0]?.injectionOrder).toBe(100);
    expect(out.body.prompts[0]?.placement).toBe("relative");
  });

  test("the preset's own title is renamed through meta", () => {
    const out = applyRailEdits(body, rowsFor(), { name: "New Title" });
    expect(out.body.name).toBe("New Title");
  });

  test("an edit identical to what is stored changes nothing", () => {
    // Otherwise every open would look dirty and the pending count would lie.
    const out = applyRailEdits(body, rowsFor({ editedName: "First", editedContent: "one" }), { name: "Old Title" });
    expect(out.body.prompts[0]).toEqual(applyRailEdits(body, rowsFor()).body.prompts[0]);
    expect(out.body.name).toBe("Old Title");
  });
});
