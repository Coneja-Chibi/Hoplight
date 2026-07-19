/**
 * Marinara prompt-preset codec tests. The load-bearing parts are (a) the escrow-of-raw byte-identical
 * round-trip on an unedited import, proving every Marinara-only field with no canonical home survives,
 * and (b) the field-diff overlay, proving an edit rewrites only its own wire field and leaves the rest
 * of the raw envelope untouched. Fixture: the engine's own bundled export (Marinara-Engine@daf8c212,
 * packages/server/src/db/default-preset.json), reformatted to the codec's serializer output
 * (JSON.stringify(parsed, null, 2)); provenance in samples/marinara/presets/SOURCES.md.
 */
import { describe, expect, test } from "bun:test";
import type { CanonicalPreset } from "../../entities/preset/schema";
import marinaraPreset from "./preset";

const FIXTURE_PATH = new URL(
  "../../../samples/marinara/presets/marinara-universal-preset-v12.marinara.json",
  import.meta.url,
);
const fixtureText = await Bun.file(FIXTURE_PATH).text();
const input = { text: fixtureText, filename: "marinara-universal-preset-v12.marinara.json" };

/** Emit and assert the codec produced text (AdapterOutput.text is optional on the shared type). */
const emit = (entity: CanonicalPreset): string => {
  const out = marinaraPreset.fromCanonical(entity).text;
  if (out === undefined) throw new Error("test: codec emitted no text");
  return out;
};

describe("marinara preset detect", () => {
  test("claims a marinara_preset envelope", () => {
    expect(marinaraPreset.detect(input)).toBe(0.95);
  });

  test("declines non-envelopes, arrays, and other engines", () => {
    expect(marinaraPreset.detect({ text: "not json" })).toBe(0);
    expect(marinaraPreset.detect({ text: "[]" })).toBe(0);
    expect(marinaraPreset.detect({ text: JSON.stringify({ type: "marinara_persona", data: {} }) })).toBe(0);
    expect(marinaraPreset.detect({ text: JSON.stringify({ temperature: 1, prompts: [] }) })).toBe(0);
    expect(marinaraPreset.detect({ text: JSON.stringify({ type: "marinara_preset", data: { preset: {} } }) })).toBe(0);
  });
});

describe("marinara preset toCanonical", () => {
  const canon = marinaraPreset.toCanonical(input);

  test("maps preset identity and block list", () => {
    expect(canon.kind).toBe("preset");
    expect(canon.body.name).toBe("Marinara's Universal Preset");
    expect(canon.body.description).toContain("universal roleplay preset");
    expect(canon.body.prompts).toHaveLength(11);
  });

  test("maps a plain section verbatim", () => {
    const role = canon.body.prompts.find((p) => p.id === "section_1772663501549");
    expect(role).toBeDefined();
    expect(role?.name).toBe("Role");
    expect(role?.content).toBe("You are {{role}}!");
    expect(role?.role).toBe("system");
    expect(role?.enabled).toBe(true);
    expect(role?.marker).toBe(false);
    expect(role?.injectionOrder).toBe(0);
    expect(role?.placement).toBe("relative");
  });

  test("maps a marker section's slot and group", () => {
    const setting = canon.body.prompts.find((p) => p.id === "lorebook");
    expect(setting?.marker).toBe(true);
    expect(setting?.markerSlot).toBe("lorebook");
    expect(setting?.groupId).toBe("1p7GESyWoEPmvu7DaibSR");
  });

  test("maps groups", () => {
    expect(canon.body.groups).toHaveLength(1);
    expect(canon.body.groups?.[0]).toMatchObject({ id: "1p7GESyWoEPmvu7DaibSR", name: "Lore", enabled: true });
  });

  test("maps choice blocks to walkthrough choices", () => {
    expect(canon.body.choices).toHaveLength(7);
    const role = canon.body.choices?.find((c) => c.key === "role");
    expect(role?.label).toBe("Choose what you want the model to be.");
    expect(role?.type).toBe("one");
    expect(role?.options).toHaveLength(3);
    expect(role?.separator).toBe(", ");
    const language = canon.body.choices?.find((c) => c.key === "language");
    expect(language?.options).toHaveLength(14);
  });

  test("maps the parameters the canonical samplers cover", () => {
    expect(canon.body.samplers).toMatchObject({ temperature: 1, maxTokens: 8192, maxContext: 128000, topP: 1 });
    expect(canon.body.apiOptions).toMatchObject({
      squashSystemMessages: true,
      showThoughts: true,
      reasoningEffort: "maximum",
    });
  });

  test("escrows the whole raw envelope", () => {
    const raw = canon.original?.["marinara-preset"]?.raw as Record<string, unknown>;
    expect(raw?.type).toBe("marinara_preset");
    expect((raw?.data as Record<string, unknown>)?.preset).toBeDefined();
  });
});

describe("marinara preset round-trip", () => {
  test("unedited re-emit is byte-identical to the source", () => {
    const canon = marinaraPreset.toCanonical(input);
    expect(marinaraPreset.fromCanonical(canon).text).toBe(fixtureText);
  });

  test("a content edit rewrites only that field and leaves the rest of the raw untouched", () => {
    const canon = structuredClone(marinaraPreset.toCanonical(input)) as CanonicalPreset;
    const role = canon.body.prompts.find((p) => p.id === "section_1772663501549");
    if (!role) throw new Error("test: Role section missing");
    role.content = "You are {{role}}, rewritten.";

    const out = JSON.parse(emit(canon)) as {
      data: { preset: Record<string, unknown>; sections: Record<string, unknown>[] };
    };
    const original = JSON.parse(fixtureText) as typeof out;

    const editedSection = out.data.sections.find((s) => s.identifier === "section_1772663501549");
    expect(editedSection?.content).toBe("You are {{role}}, rewritten.");
    expect(editedSection?.enabled).toBe("true"); // still the wire's string form, untouched

    // Every other section is byte-identical to the source.
    const untouched = out.data.sections.find((s) => s.identifier === "section_1772743996991");
    const untouchedOrig = original.data.sections.find((s) => s.identifier === "section_1772743996991");
    expect(untouched).toEqual(untouchedOrig);

    // Marinara-only escrow (no canonical home) survives verbatim.
    expect(out.data.preset.conversationPrompt).toBe(original.data.preset.conversationPrompt);
    expect(out.data.preset.defaultChoices).toBe(original.data.preset.defaultChoices);
    expect(out.data.preset.variableGroups).toBe(original.data.preset.variableGroups);
  });

  test("a sampler edit rewrites parameters but preserves the escrowed param fields", () => {
    const canon = structuredClone(marinaraPreset.toCanonical(input)) as CanonicalPreset;
    canon.body.samplers = { ...canon.body.samplers, temperature: 0.7 };

    const out = JSON.parse(emit(canon)) as {
      data: { preset: { parameters: string } };
    };
    const params = JSON.parse(out.data.preset.parameters) as Record<string, unknown>;
    expect(params.temperature).toBe(0.7);
    expect(params.verbosity).toBe("high"); // canonical never modeled this; it rode escrow
    expect(params.maxTokens).toBe(8192);
  });

  test("a boolean edit re-encodes to the wire's string form", () => {
    const canon = structuredClone(marinaraPreset.toCanonical(input)) as CanonicalPreset;
    const role = canon.body.prompts.find((p) => p.id === "section_1772663501549");
    if (!role) throw new Error("test: Role section missing");
    role.enabled = false;

    const out = JSON.parse(emit(canon)) as { data: { sections: Record<string, unknown>[] } };
    const edited = out.data.sections.find((s) => s.identifier === "section_1772663501549");
    expect(edited?.enabled).toBe("false");
  });
});

describe("marinara preset from-scratch emit (no escrowed twin)", () => {
  test("builds a valid envelope that re-imports", () => {
    const canon = marinaraPreset.toCanonical(input);
    const scratch: CanonicalPreset = { ...canon, original: undefined };
    const emitted = marinaraPreset.fromCanonical(scratch);

    const reimported = marinaraPreset.toCanonical({ text: emitted.text });
    expect(reimported.body.name).toBe("Marinara's Universal Preset");
    expect(reimported.body.prompts).toHaveLength(11);
    expect(reimported.body.choices).toHaveLength(7);
    expect(marinaraPreset.detect({ text: emitted.text })).toBe(0.95);
  });
});
