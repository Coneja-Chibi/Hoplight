import { test, expect } from "bun:test";
import codec from "./lorebook";

/**
 * A wire-faithful RoleCall v1.0 lorebook export, matching the exact nested shape emitted by
 * VAUDEVILLE packages/lorebook serializeToRoleCallV1 (settings/metadata/entries[+categories+tree],
 * each entry grouped into triggers/matching/injection/priority/timing/grouping/advanced/scanSources).
 * Exercises advanced per-trigger probability, secondary triggers, sideEffects, entry metadata, and
 * the raw-only carriers (tree, per-entry unsupportedFields) that must survive via original.
 */
function makeRcExport() {
  return {
    schemaVersion: "1.0.0",
    exportDate: "2026-01-01T00:00:00.000Z",
    lorebook: {
      name: "Aetheria",
      description: "the floating world",
      settings: {
        lorebookType: "world",
        globalCaseSensitive: false,
        globalMatchWholeWords: true,
        globalScanDepth: 4,
        globalRecursion: true,
        tokenBudget: 2048,
        budgetMode: "token",
        entryBudget: 0,
      },
      metadata: { genre: "fantasy", fandom: null, tags: ["skyships", "oc"] },
      entries: [
        {
          id: "e1",
          title: "The Skyports",
          content: "Floating docks ring every island.",
          comment: "internal authoring note",
          enabled: true,
          constant: false,
          triggers: {
            mode: "advanced",
            primary: [{ keyword: "skyport", isRegex: false, probability: 80 }],
            secondary: [{ keyword: "dock", isRegex: false, probability: 50 }],
            selectiveLogic: "and_any",
          },
          matching: { caseSensitive: null, matchWholeWords: null, scanDepth: 5 },
          injection: { position: "before_example", depth: 4, role: "system" },
          priority: { sortOrder: 0, priority: 100 },
          timing: { sticky: 3, cooldown: 2, delay: 1 },
          grouping: { groupName: "places", categoryId: "cat1", groupWeight: 100 },
          probability: 80,
          advanced: {
            useMemo: false,
            excludeRecursion: true,
            preventRecursion: false,
            delayUntilRecursion: 0,
            ignoreBudget: false,
          },
          characterFilter: { isExclude: false, names: ["Aria"], tags: [] },
          scanSources: {
            characterDescription: true,
            characterPersonality: false,
            userPersona: false,
            scenario: true,
          },
          sideEffects: {
            effects: [{ type: "setvar", variable: "visited", value: "true", scope: "local" }],
            onlyOnFirstTrigger: true,
            clearOnDeactivate: false,
          },
          metadata: { entry_type: "location", structured_data: { region: "north" } },
          // ST fields RC preserves but does not model natively: raw-only, must ride original untouched.
          unsupportedFields: { vectorized: true, automationId: "auto-9", matchCreatorNotes: false },
        },
        {
          id: "e2",
          title: "Common Tongue",
          content: "Everyone speaks it.",
          comment: null,
          enabled: true,
          constant: true,
          triggers: {
            mode: "simple",
            primary: [{ keyword: "language", isRegex: false }],
            secondary: [],
            selectiveLogic: "and_any",
          },
          matching: { caseSensitive: null, matchWholeWords: null, scanDepth: null },
          injection: { position: "character", depth: 4, role: "system" },
          priority: { sortOrder: 1, priority: 100 },
          timing: { sticky: 0, cooldown: 0, delay: 0 },
          grouping: { groupName: null, categoryId: null, groupWeight: 100 },
          probability: 100,
          advanced: {
            useMemo: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: 0,
            ignoreBudget: false,
          },
          characterFilter: null,
          scanSources: {
            characterDescription: false,
            characterPersonality: false,
            userPersona: false,
            scenario: false,
          },
        },
      ],
      categories: [{ id: "cat1", name: "Places", sortOrder: 0, enabled: true }],
      tree: {
        tree_data: { root: ["cat1"] },
        build_mode: "auto",
        granularity: "coarse",
        version: 1,
        built_at: "2026-01-01T00:00:00.000Z",
      },
    },
  };
}

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

test("detect: a RoleCall v1 export scores 1, junk and non-RC json score 0", () => {
  expect(codec.detect(asText(makeRcExport()))).toBe(1);
  expect(codec.detect({ text: "not json" })).toBe(0);
  // an ST worldbook (entries map, no schemaVersion/lorebook envelope) is not RC
  expect(codec.detect(asText({ entries: { "0": { key: ["x"], content: "y" } } }))).toBe(0);
  // a character card is not a lorebook
  expect(codec.detect(asText({ spec: "chara_card_v2", data: { name: "x" } }))).toBe(0);
});

test("toCanonical flattens the nested wire and preserves advanced per-trigger probability", () => {
  const ent = codec.toCanonical(asText(makeRcExport()));
  expect(ent.kind).toBe("lorebook");
  expect(ent.id).toBe("aetheria");
  expect(ent.body.name).toBe("Aetheria");
  expect(ent.body.lorebookType).toBe("world");
  expect(ent.body.globalMatchWholeWords).toBe(true);
  expect(ent.body.tags).toEqual(["skyships", "oc"]);
  expect(ent.body.entries).toHaveLength(2);

  const e1 = ent.body.entries[0]!;
  expect(e1.title).toBe("The Skyports");
  expect(e1.comment).toBe("internal authoring note");
  expect(e1.triggerMode).toBe("advanced");
  expect(e1.triggers).toEqual([{ keyword: "skyport", isRegex: false, probability: 80 }]);
  expect(e1.secondaryTriggers).toEqual([{ keyword: "dock", isRegex: false, probability: 50 }]);
  expect(e1.position).toBe("before_example");
  expect(e1.scanDepth).toBe(5);
  expect(e1.sticky).toBe(3);
  expect(e1.groupName).toBe("places");
  expect(e1.categoryId).toBe("cat1");
  expect(e1.excludeRecursion).toBe(true);
  expect(e1.characterFilter).toEqual({ isExclude: false, names: ["Aria"], tags: [] });
  expect(e1.scanCharacterDescription).toBe(true);
  expect(e1.scanScenario).toBe(true);
  expect(e1.sideEffects?.effects[0]?.variable).toBe("visited");
  expect(e1.metadata).toEqual({ entry_type: "location", structured_data: { region: "north" } });

  expect(ent.body.categories).toEqual([{ id: "cat1", name: "Places", sortOrder: 0, enabled: true }]);
});

test("the whole raw export rides in original (raw-only tree + unsupportedFields captured)", () => {
  const ent = codec.toCanonical(asText(makeRcExport()));
  const raw = ent.original?.["rolecall-lorebook"]?.raw as ReturnType<typeof makeRcExport>;
  expect(raw.lorebook.tree.build_mode).toBe("auto");
  expect(raw.lorebook.entries[0]!.unsupportedFields).toEqual({
    vectorized: true,
    automationId: "auto-9",
    matchCreatorNotes: false,
  });
});

test("round-trips a RoleCall v1 export losslessly (nesting, tree, unsupportedFields, exportDate)", () => {
  const original = makeRcExport();
  const ent = codec.toCanonical(asText(original));
  const back = JSON.parse(codec.fromCanonical(ent).text ?? "");
  expect(back).toEqual(original);
});

test("an edited entry field re-projects into the nested wire on serialize", () => {
  const ent = codec.toCanonical(asText(makeRcExport()));
  ent.body.entries[0]!.content = "Rebuilt after the storm.";
  ent.body.entries[0]!.priority = 50;
  const back = JSON.parse(codec.fromCanonical(ent).text ?? "");
  expect(back.lorebook.entries[0].content).toBe("Rebuilt after the storm.");
  expect(back.lorebook.entries[0].priority.priority).toBe(50);
  // untouched raw-only field still survives the edit
  expect(back.lorebook.entries[0].unsupportedFields.automationId).toBe("auto-9");
});

// -- De-original (real sample): the unsupportedFields bag's authored ST-origin toggles are first-class --

import { readFileSync } from "node:fs";
import { join } from "node:path";

const realBook = readFileSync(
  join(import.meta.dir, "../../../samples/rolecall/lorebooks/aetheria-lorebook.v1.json"),
  "utf8",
);

test("de-original read: unsupportedFields toggles land in first-class canonical slots", () => {
  const canon = codec.toCanonical({ text: realBook });
  const e0 = canon.body.entries[0]!;
  expect(e0.vectorized).toBe(true);
  expect(e0.groupOverride).toBe(true);
  expect(e0.useGroupScoring).toBe(false);
  expect(e0.automationId).toBe("auto-9");
  expect(e0.scanCharacterDepthPrompt).toBe(false);
  expect(e0.scanCreatorNotes).toBe(false);
});

test("de-original edit: flipping the toggles reaches the unsupportedFields bag, residue survives", () => {
  const canon = codec.toCanonical({ text: realBook });
  canon.body.entries[0]!.vectorized = false;
  canon.body.entries[0]!.useGroupScoring = true;
  const out = JSON.parse(codec.fromCanonical(canon).text ?? "");
  const bag = out.lorebook.entries[0].unsupportedFields;
  expect(bag.vectorized).toBe(false);
  expect(bag.useGroupScoring).toBe(true);
  expect(bag.groupOverride).toBe(true); // unedited neighbor
  // raw-only bag residue (RC-side automation wiring) survives the clone
  expect(bag.generationTriggers).toEqual([]);
  expect(bag.outletName).toBe("");
});

test("de-original round-trip: the real RC lorebook re-emits unedited without wire mutation", () => {
  const canon = codec.toCanonical({ text: realBook });
  expect(JSON.parse(codec.fromCanonical(canon).text ?? "")).toEqual(JSON.parse(realBook));
});
