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
import { buildStPreset } from "../../../formats/_shared/st-preset-emit";

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

  test("it carries every settings group, so it never inherits the last preset's", () => {
    // This was the KNOWN GAP assertion, flipped once real values were transcribed from a shipped
    // install. A body missing these loads and then runs on whatever the app had open last.
    const body = starterBody("Blank") as unknown as Record<string, unknown>;
    for (const group of ["samplers", "systemPrompts", "templates", "behavior", "apiOptions", "media", "generation"]) {
      expect(body[group], `${group} is missing; a starter without it is not a complete preset`).toBeDefined();
    }
    expect(body.name).toBe("Blank");
  });

  test("it carries no connection settings, so opening one cannot retarget a provider", () => {
    // The deliberate omission. Every field naming a model, source, proxy or URL belongs to the
    // machine rather than the preset, and a starter that shipped one would move somebody's endpoint.
    const flat = JSON.stringify(starterBody("Blank"));
    for (const forbidden of ["proxy", "reverse_proxy", "custom_url", "chat_completion_source", "_model"]) {
      expect(flat).not.toContain(forbidden);
    }
  });

  test("the settings survive the writer, which is where the claim is actually tested", () => {
    // A canonical body carrying groups nothing emits would still leave a two-field file on disk.
    // 33 settings plus prompts and prompt_order; before the settings landed this was 2 in total.
    const wire = buildStPreset(starterBody("Blank"), undefined, "none") as Record<string, unknown>;
    expect(Object.keys(wire).length).toBeGreaterThan(30);
    expect(wire.temperature).toBe(1);
    expect(wire.scenario_format).toBe("{{scenario}}");
    expect(Array.isArray(wire.prompts)).toBe(true);
    for (const forbidden of ["chat_completion_source", "openai_model", "reverse_proxy", "proxy_password", "custom_url"]) {
      expect(wire[forbidden], `${forbidden} reached the wire`).toBeUndefined();
    }
  });

  test("every block ships an edit note, so nothing is a mystery to fill in", () => {
    const notes = starterNotes();
    expect(notes).toHaveLength(starterBlocks().length);
    expect(notes.every((n) => n.edit.length > 20)).toBe(true);
  });
});
