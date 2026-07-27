/** Regression coverage for the lorebook.test behavior owned beside this file. */
import { test, expect } from "bun:test";
import { globSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import codec from "./lorebook";
import rcLorebook from "../rolecall/lorebook";
import { DEFAULT_SCAN_DEPTH } from "../../entities/lorebook/schema";
import { scanBook } from "../../core/lore/activation";

/**
 * A standard SillyTavern worldbook: entries as a keyed map, ST int enums (position/role/
 * selectiveLogic), regex encoded inline as /pattern/flags, scan sources as match* flags. Two
 * entries carry raw-only keys (uid, vectorized, matchCharacterDepthPrompt, automationId) that the
 * canonical model does not first-class - they must survive a round-trip via original.
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
        displayIndex: 7, // cosmetic display order: distinct from `order`, rides original (no canonical slot)
        order: 50, // insertion/placement order -> canonical sortOrder
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
        // raw-only: not modeled canonically, must ride original untouched
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

test("detect: CCv3/Chub character_book (entries array + keys) scores 0.85 and imports", () => {
  const chub = {
    name: "Chub Sample",
    entries: [
      {
        keys: ["skyport"],
        content: "Floating docks.",
        name: "Skyports",
        insertion_order: 10,
        enabled: true,
      },
    ],
    scan_depth: 4,
    token_budget: 1000,
  };
  expect(codec.detect(asText(chub))).toBe(0.85);
  const ent = codec.toCanonical(asText(chub));
  expect(ent.body.name).toBe("Chub Sample");
  expect(ent.body.entries).toHaveLength(1);
  expect(ent.body.entries[0]!.title).toBe("Skyports");
  expect(ent.body.entries[0]!.triggers.map((t) => t.keyword)).toEqual(["skyport"]);
  // re-export as ST object-map worldbook
  const back = JSON.parse(codec.fromCanonical(ent).text ?? "");
  expect(Array.isArray(back.entries)).toBe(false);
  expect(back.entries["0"].key).toEqual(["skyport"]);
  expect(back.entries["0"].content).toBe("Floating docks.");
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
  expect(e0.sortOrder).toBe(50); // ST `order` (placement)
  expect(e0.priority).toBe(100); // ST has no eviction axis -> default 100
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

test("the whole raw worldbook rides in original (raw-only fields captured)", () => {
  const ent = codec.toCanonical(asText(makeStWorldbook()));
  const raw = ent.original?.["sillytavern-lorebook"]?.raw as ReturnType<typeof makeStWorldbook>;
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
  // reconciliation proof: ST `order` (placement) lands in RC placement, NOT RC eviction priority
  expect(out.lorebook.entries[0].priority.sortOrder).toBe(50); // ST order -> RC sortOrder (placement)
  expect(out.lorebook.entries[0].priority.priority).toBe(100); // eviction defaults (ST has no such axis)
});

/**
 * Scan depth is the difference between an imported book that matches and one that is inert:
 * activation reads depth <= 0 as "scan no lines", so an absent ST `scan_depth` must land on the
 * house default, never on a literal 0. Both shipped ST samples omit the field, and both imported
 * dead before this was fixed.
 */
test("an absent scan_depth imports at the house default, not zero", () => {
  const book = makeStWorldbook() as Record<string, unknown>;
  delete book.scan_depth;
  expect(codec.toCanonical(asText(book)).body.globalScanDepth).toBe(DEFAULT_SCAN_DEPTH);
});

test("an explicit scan_depth is preserved", () => {
  const book = { ...makeStWorldbook(), scan_depth: 7 };
  expect(codec.toCanonical(asText(book)).body.globalScanDepth).toBe(7);
});

test("a nonsense scan_depth falls back rather than importing inert", () => {
  for (const bad of [0, -3, null, "4"]) {
    const book = { ...makeStWorldbook(), scan_depth: bad };
    expect(codec.toCanonical(asText(book)).body.globalScanDepth).toBe(DEFAULT_SCAN_DEPTH);
  }
});

/**
 * The corpus guard for the whole class: import every shipped ST worldbook, take a keyword out of
 * the book itself, and assert it actually fires. A unit test on the default alone would not have
 * caught this, because the bug only shows once the imported depth reaches the activation engine.
 */
test("every shipped ST sample worldbook actually matches its own keywords", () => {
  const files = globSync("samples/sillytavern/lorebooks/*.json");
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const body = codec.toCanonical({ bytes: readFileSync(file), filename: basename(file) }).body;
    const keyworded = body.entries.find((e) => e.triggers.length > 0 && !e.constant && e.enabled);
    if (!keyworded) continue; // a constants-only book has nothing to prove here
    const keyword = keyworded.triggers[0]?.keyword ?? "";
    const fired = scanBook(body, [{ text: `talking about ${keyword} right now`, role: "user" }], {
      chanceMode: "always",
    }).fired;
    expect(fired.length).toBeGreaterThan(0);
  }
});
