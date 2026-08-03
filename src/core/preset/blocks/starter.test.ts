/**
 * The starter body.
 *
 * The risk worth pinning is the claim, not the code. A "blank starter" that quietly omits every
 * setting is a file somebody loads and then runs on whatever the app had last, and that failure looks
 * exactly like success. So the gap is asserted here, where it stays visible until it is closed.
 */
import { describe, expect, test } from "bun:test";
import { starterBody, starterNotes } from "./starter";
import { starterBlocks } from "./skeletons";

describe("starterBody", () => {
  test("carries every skeleton, enabled, in dependency order", () => {
    // Blocks shipped disabled would render an empty prompt and read as a broken export.
    const body = starterBody("Blank");
    expect(body.prompts).toHaveLength(starterBlocks().length);
    expect(body.prompts.every((p) => p.enabled)).toBe(true);
    expect(body.prompts[0]!.id).toBe("hp_init");
  });

  test("the engine slot keeps its marker flag and stays empty", () => {
    const slot = starterBody("Blank").prompts.find((p) => p.id === "chatHistory")!;
    expect(slot.content).toBe("");
  });

  test("KNOWN GAP: it carries no sampler or behaviour settings yet", () => {
    // Documented rather than hidden. When real defaults are sourced from an install's own shipped
    // preset, this test flips to asserting they are present, and until then nobody can describe a
    // starter as a complete preset without this failing.
    const body = starterBody("Blank") as unknown as Record<string, unknown>;
    for (const group of ["samplers", "behavior", "apiOptions", "templates"]) {
      expect(body[group], `${group} is populated; update this test and the module header`).toBeUndefined();
    }
  });

  test("every block ships an edit note, so nothing is a mystery to fill in", () => {
    const notes = starterNotes();
    expect(notes).toHaveLength(starterBlocks().length);
    expect(notes.every((n) => n.edit.length > 20)).toBe(true);
  });
});
