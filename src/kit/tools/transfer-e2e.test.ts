/**
 * The journey this whole surface exists for: a RoleCall preset asked to become a SillyTavern preset,
 * end to end through the real adapter registry. The unit tests beside this one cover the rejection
 * branches with a fake bridge; this one proves the tool actually wires the conversion graph, the
 * serialize report, and the macro check together on the happy path.
 *
 * It lives in its own file on purpose. Loading every format adapter is real work, and folding that
 * cost into a broad test file was already shown to disturb timing-sensitive neighbours.
 */
import { expect, test } from "bun:test";
import { emptyPresetBody } from "../../entities/preset";
import { emptyLoreEntry, emptyLorebookBody } from "../../core/lore";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import type { KitBridge, KitEntity } from "../bridge";
import transfer from "./transfer";

/** A RoleCall-sourced preset carrying one macro SillyTavern has no name for. */
const PRESET = parseCanonicalEntity({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "preset",
  id: "mythic",
  body: {
    ...emptyPresetBody("Mythic prose"),
    prompts: [
      {
        id: "main",
        name: "Main",
        content: "You are {{char}}. Credit: {{charCreator}}.",
        role: "system",
        enabled: true,
        systemPrompt: false,
        marker: false,
        placement: "relative",
        injectionDepth: 4,
        injectionOrder: 100,
        forbidOverrides: false,
      },
    ],
  },
}) as unknown as KitEntity;

const bridge: KitBridge = {
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list() { return []; },
  async read(kind: string, id: string) {
    return kind === "preset" && id === "mythic" ? PRESET : null;
  },
  async save() { throw new Error("transfer must not write to the studio"); },
  async delete() { throw new Error("transfer must not delete"); },
};

test("a RoleCall preset converts to a SillyTavern preset and reports the macro that dies", async () => {
  const result = await transfer.execute(
    { kind: "preset", id: "mythic", to: "sillytavern-preset" },
    { bridge },
  );

  const observed = JSON.parse(result.output) as {
    to: string;
    loss: { counts: { warnings: number; dropped: number | null } };
    macros: {
      checked: boolean;
      target: string;
      findings: { token: string; status: string; where: string }[];
      limits: string[];
    };
    payload: { content?: string; spilled?: boolean };
    note: string;
  };

  expect(observed.to).toBe("sillytavern-preset");
  expect(observed.loss).toBeDefined();

  // The macro check ran against SillyTavern's own catalog and found the RoleCall-only token.
  expect(observed.macros.checked).toBe(true);
  expect(observed.macros.target).toBe("sillytavern");
  expect(observed.macros.findings.map((f) => f.token)).toEqual(["{{charCreator}}"]);
  expect(observed.macros.findings[0]?.status).toBe("dies");
  expect(observed.macros.findings[0]?.where).toBe("prompts[Main].content");

  // {{char}} survives, so it must NOT be reported, and the caveat still travels with the result.
  expect(observed.macros.findings.some((f) => f.token === "{{char}}")).toBe(false);
  expect(observed.macros.limits.join(" ")).toContain("{{random::a::b}}");

  // The converted payload came back, and the summary counts the dead macro.
  expect(typeof observed.payload.content).toBe("string");
  expect(result.summary).toContain("1 dead macros");
  expect(observed.note).toContain("Nothing was written");
});

/**
 * The same journey for a preset that really came from RoleCall, escrow and all. The fixture above
 * has no escrow, so its dialect is unknown and the translator correctly declines to guess - meaning
 * it never exercised translation at all. This one does, and it is the shape that shipped broken:
 * escrow is keyed `rolecall` by the codec, and while the lookup expected `rolecall-preset` the
 * dialect resolved to null and every RoleCall preset crossed over untranslated.
 */
const RC_PRESET = parseCanonicalEntity({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "preset",
  id: "stateful",
  body: {
    ...emptyPresetBody("Stateful"),
    choices: [{
      id: "lang",
      key: "lang",
      label: "Language",
      type: "one",
      default: "English",
      options: [{ id: "en", label: "English" }, { id: "fr", label: "French" }],
    }],
    prompts: [
      {
        id: "main",
        name: "Main",
        content:
          "{{setvar::mood::calm}}{{setvar::mood::tense}}"
          + "{{if {{getvarkey::plan::{{getvar::i}}}} }}{{getvarkey::plan::3}}{{/if}}"
          + "{{choice::lang}}{{message_history}}",
        role: "system",
        enabled: true,
        systemPrompt: false,
        marker: false,
        placement: "relative",
        injectionDepth: 4,
        injectionOrder: 100,
        forbidOverrides: false,
      },
    ],
  },
  original: {
    rolecall: {
      raw: {
        macro_engine_yaml: [
          "hooks:",
          "  - id: catch-plan",
          "    trigger: '(?<=\\[PLAN:[^\\]]*)([^,\\]]+)'",
          "    flags: gi",
          "    placement: [user_input, ai_output]",
          "    actions:",
          "      - { type: push, key: plan }",
        ].join("\n"),
      },
    },
  },
}) as unknown as KitEntity;

test("a real RoleCall preset resolves its dialect, translates, and reports its structure", async () => {
  const rcBridge: KitBridge = {
    ...bridge,
    async read(kind: string, id: string) {
      return kind === "preset" && id === "stateful" ? RC_PRESET : null;
    },
  };

  const result = await transfer.execute(
    { kind: "preset", id: "stateful", to: "sillytavern-preset" },
    { bridge: rcBridge },
  );
  const observed = JSON.parse(result.output) as {
    dialect?: { from: string; to: string };
    translated: { kind: string; from: string }[];
    structure: {
      stateLayer: string;
      hookCount: number;
      pushHooks: { variable: string; trigger: string }[];
      arrays: { name: string; literalIndices: number[]; dynamicAccesses: number }[];
      domains: { variable: string; values: string[] }[];
      markerCandidates: { token: string; markerSlot: string }[];
      choices: { reference: string; label: string | null; options: unknown[] }[];
      limits: string[];
    };
    promotions?: { token: string; markerSlot: string }[];
    payload: { content?: string };
  };

  // The crossing was recognised at all - this is what returned undefined before.
  expect(observed.dialect).toEqual({ from: "rolecall", to: "sillytavern" });

  // The indexed reads lowered, including the one used AS a condition inside a preserved block.
  expect(observed.payload.content).toContain("{{getvar::plan_3}}");
  expect(observed.payload.content).toContain("{{if {{getvar::plan_{{getvar::i}}}} }}");

  // Structure: computed facts about the source, not the stripped-down copy being emitted.
  expect(observed.structure.stateLayer).toBe("read");
  expect(observed.structure.hookCount).toBe(1);
  expect(observed.structure.pushHooks[0]?.variable).toBe("plan");
  expect(observed.structure.pushHooks[0]?.trigger).toBe("(?<=\\[PLAN:[^\\]]*)([^,\\]]+)");
  expect(observed.structure.arrays[0]).toMatchObject({ name: "plan", literalIndices: [3], dynamicAccesses: 1 });
  expect(observed.structure.domains).toEqual([{ variable: "mood", values: ["calm", "tense"] }]);

  // The choice group behind a dead {{choice::lang}} arrives with the options a seed would use.
  expect(observed.structure.choices[0]?.reference).toBe("lang");
  expect(observed.structure.choices[0]?.label).toBe("Language");
  expect(observed.structure.choices[0]?.options).toHaveLength(2);

  // {{message_history}} is no longer merely a CANDIDATE for promotion: the block carrying it is
  // split so the macro becomes a real chatHistory marker block, with the surrounding text kept on
  // either side. It therefore never reaches the translator's removal path at all.
  expect(observed.promotions).toEqual([
    expect.objectContaining({ token: "{{message_history}}", markerSlot: "chatHistory" }),
  ]);
  expect(observed.structure.markerCandidates).toEqual([]);
  expect(observed.structure.limits.length).toBeGreaterThan(0);
});

/**
 * Macro checking is NOT a preset feature, and this test used to assert the opposite - that a
 * lorebook reports no macro section at all. That was the bug: entry content carries macros exactly
 * like a prompt block does, and every non-preset kind crossed engines with no dialect check.
 */
test("a lorebook's entry content is macro-checked like any other authored text", async () => {
  const body = emptyLorebookBody("World Bible") as unknown as { entries: unknown[] };
  body.entries = [{
    ...emptyLoreEntry("e1"),
    id: "e1",
    title: "Hawthorne",
    content: "Written by {{charCreator}}, who knows {{char}}.",
  }];
  const book = parseCanonicalEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: "world",
    body,
  }) as unknown as KitEntity;
  const loreBridge: KitBridge = {
    ...bridge,
    async read(kind: string, id: string) {
      return kind === "lorebook" && id === "world" ? book : null;
    },
  };

  const result = await transfer.execute(
    { kind: "lorebook", id: "world", to: "sillytavern-lorebook" },
    { bridge: loreBridge },
  );
  const observed = JSON.parse(result.output) as {
    macros?: { checked: boolean; target: string; findings: { token: string; where: string }[] };
  };
  expect(observed.macros?.checked).toBe(true);
  expect(observed.macros?.target).toBe("sillytavern");
  // {{charCreator}} has no SillyTavern equivalent and is now reported; {{char}} survives and is not.
  expect(observed.macros?.findings.map((f) => f.token)).toEqual(["{{charCreator}}"]);
  expect(observed.macros?.findings[0]?.where).toBe("entries[Hawthorne].content");
  expect(result.summary).toContain("1 dead macros");
});
