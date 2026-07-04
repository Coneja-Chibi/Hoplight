import { test, expect } from "bun:test";
import codec from "./lorebook";
import rcLorebook from "../rolecall/lorebook";

/**
 * A standard SillyTavern worldbook: entries as a keyed map, ST int enums (position/role/
 * selectiveLogic), regex encoded inline as /pattern/flags, scan sources as match* flags. Two
 * entries carry raw-only keys (uid, vectorized, matchCharacterDepthPrompt, automationId) that the
 * canonical model does not first-class - they must survive a round-trip via escrow.
 */
function makeStWorldbook() {
  return {
    entries: {
      "0": {
        uid: 0,
        comment: "The Skyports",
        content: "Floating docks ring every island.",
        disable: false,
        constant: false,
        key: ["skyport", "/dock(s)?/i"],
        keysecondary: ["harbor"],
        selective: true,
        selectiveLogic: 3,
        caseSensitive: null,
        matchWholeWords: null,
        scanDepth: 5,
        position: 2,
        depth: 4,
        role: 0,
        displayIndex: 0,
        order: 100,
        sticky: 3,
        cooldown: 2,
        delay: 1,
        group: "places",
        groupWeight: 5,
        probability: 100,
        useProbability: false,
        addMemo: false,
        excludeRecursion: true,
        preventRecursion: false,
        delayUntilRecursion: 0,
        characterFilter: { isExclude: false, names: ["Aria"], tags: [] },
        matchCharacterDescription: true,
        matchCharacterPersonality: false,
        matchPersonaDescription: false,
        matchScenario: true,
        ignoreBudget: false,
        // raw-only: not modeled canonically, must ride escrow untouched
        vectorized: true,
        matchCharacterDepthPrompt: false,
        automationId: "auto-9",
      },
      "1": {
        uid: 1,
        comment: "Common Tongue",
        content: "Everyone speaks it.",
        disable: false,
        constant: true,
        key: ["language"],
        keysecondary: [],
        selective: false,
        selectiveLogic: 0,
        caseSensitive: null,
        matchWholeWords: null,
        scanDepth: null,
        position: 1,
        depth: 4,
        role: 0,
        displayIndex: 1,
        order: 100,
        sticky: 0,
        cooldown: 0,
        delay: 0,
        group: "",
        groupWeight: 1,
        probability: 50,
        useProbability: true,
        addMemo: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: 0,
        characterFilter: { isExclude: false, names: [], tags: [] },
        matchCharacterDescription: false,
        matchCharacterPersonality: false,
        matchPersonaDescription: false,
        matchScenario: false,
        ignoreBudget: false,
      },
    },
    name: "Aetheria",
    description: "the floating world",
    scan_depth: 4,
    token_budget: 2048,
    recursive_scanning: true,
    case_sensitive: false,
    match_whole_words: true,
  };
}

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

test("detect: an ST worldbook scores 0.9; RC lorebook, character cards, and junk score 0", () => {
  expect(codec.detect(asText(makeStWorldbook()))).toBe(0.9);
  // an RC v1 lorebook keeps entries under `lorebook` (array), no top-level entries map
  expect(codec.detect(asText({ schemaVersion: "1.0.0", lorebook: { entries: [] } }))).toBe(0);
  expect(codec.detect(asText({ spec: "chara_card_v2", data: { name: "x" } }))).toBe(0);
  expect(codec.detect({ text: "not json" })).toBe(0);
});

test("toCanonical decodes ST int enums, inline regex, and match* scan sources", () => {
  const ent = codec.toCanonical(asText(makeStWorldbook()));
  expect(ent.kind).toBe("lorebook");
  expect(ent.body.name).toBe("Aetheria");
  expect(ent.body.globalScanDepth).toBe(4);
  expect(ent.body.entries).toHaveLength(2);

  const e0 = ent.body.entries[0]!;
  expect(e0.title).toBe("The Skyports");
  expect(e0.triggers).toEqual([
    { keyword: "skyport", isRegex: false },
    { keyword: "dock(s)?", isRegex: true, flags: "i" },
  ]);
  expect(e0.secondaryTriggers).toEqual([{ keyword: "harbor", isRegex: false }]);
  expect(e0.selectiveLogic).toBe("and_all"); // ST 3
  expect(e0.position).toBe("before_example"); // ST 2
  expect(e0.role).toBe("system"); // ST 0
  expect(e0.priority).toBe(100); // ST `order`
  expect(e0.sortOrder).toBe(0); // ST `displayIndex`
  expect(e0.scanCharacterDescription).toBe(true);
  expect(e0.scanScenario).toBe(true);
  expect(e0.scanUserPersona).toBe(false); // matchPersonaDescription
  expect(e0.characterFilter).toEqual({ isExclude: false, names: ["Aria"], tags: [] });

  const e1 = ent.body.entries[1]!;
  expect(e1.constant).toBe(true);
  expect(e1.position).toBe("character"); // ST 1
  expect(e1.probability).toBe(50);
  expect(e1.groupName).toBe(null); // empty group string -> null
});

test("the whole raw worldbook rides in escrow (raw-only fields captured)", () => {
  const ent = codec.toCanonical(asText(makeStWorldbook()));
  const raw = ent.escrow?.["sillytavern-lorebook"]?.raw as ReturnType<typeof makeStWorldbook>;
  expect(raw.entries["0"]!.vectorized).toBe(true);
  expect(raw.entries["0"]!.automationId).toBe("auto-9");
});

test("round-trips an ST worldbook losslessly (int enums, regex, uid + raw-only fields survive)", () => {
  const original = makeStWorldbook();
  const ent = codec.toCanonical(asText(original));
  const back = JSON.parse(codec.fromCanonical(ent).text ?? "");
  expect(back).toEqual(original);
});

test("an edited entry re-encodes to ST int enums; unmapped raw-only fields survive the edit", () => {
  const ent = codec.toCanonical(asText(makeStWorldbook()));
  ent.body.entries[0]!.position = "depth";
  ent.body.entries[0]!.content = "Rebuilt after the storm.";
  const back = JSON.parse(codec.fromCanonical(ent).text ?? "");
  expect(back.entries["0"].position).toBe(4); // depth -> ST 4
  expect(back.entries["0"].content).toBe("Rebuilt after the storm.");
  expect(back.entries["0"].automationId).toBe("auto-9"); // untouched raw-only survives
});

test("canonical bridges an ST worldbook to a RoleCall v1 lorebook export", () => {
  const ent = codec.toCanonical(asText(makeStWorldbook()));
  const out = JSON.parse(rcLorebook.fromCanonical(ent).text ?? "");
  expect(out.schemaVersion).toBe("1.0.0");
  expect(out.lorebook.name).toBe("Aetheria");
  expect(out.lorebook.entries[0].title).toBe("The Skyports");
  expect(out.lorebook.entries[0].triggers.primary).toEqual([
    { keyword: "skyport", isRegex: false },
    { keyword: "dock(s)?", isRegex: true, flags: "i" },
  ]);
  expect(out.lorebook.entries[0].injection.position).toBe("before_example");
});
