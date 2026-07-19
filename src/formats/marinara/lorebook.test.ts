import { test, expect } from "bun:test";
import marinaraLorebook from "./lorebook";

/**
 * The fixture is a constructed-but-schema-true Marinara `.marinara.json` export envelope (built to
 * lorebook.schema.ts + the lorebooks.routes.ts export envelope; see samples/marinara/SOURCES.md). The
 * codec escrows the whole envelope and overlays only edited fields, so an unedited book round-trips
 * deep-equal on the re-parsed envelope (byte-order-agnostic, matching the NovelAI suite's intent).
 */
const FIXTURE_PATH = new URL("../../../samples/marinara/lorebooks/arcadia-world-lore.marinara.json", import.meta.url);
const fixtureText = await Bun.file(FIXTURE_PATH).text();
const asText = (c: unknown) => ({ text: JSON.stringify(c) });
const reparse = (canon: Parameters<typeof marinaraLorebook.fromCanonical>[0]) =>
  JSON.parse(marinaraLorebook.fromCanonical(canon).text ?? "");

test("marinara-lorebook detects only the marinara_lorebook envelope", () => {
  expect(marinaraLorebook.detect({ text: fixtureText })).toBe(1);
  expect(marinaraLorebook.detect(asText({ type: "marinara_lorebook", version: 1 }))).toBe(0); // no data.entries
  expect(marinaraLorebook.detect(asText({ entries: { "0": { keys: ["x"] } } }))).toBe(0); // ST worldbook
  expect(marinaraLorebook.detect(asText({ lorebookVersion: 3, entries: [] }))).toBe(0); // NovelAI export
  expect(marinaraLorebook.detect(asText([{ findRegex: "x", replaceString: "y", order: 1 }]))).toBe(0); // regex dump
});

test("marinara-lorebook maps native fields to the canonical entry (spot checks)", () => {
  const canon = marinaraLorebook.toCanonical({ text: fixtureText });
  const [court, spies, throne, ledger] = canon.body.entries;

  // regex keys: useRegex flag promotes every plain-string key to a regex trigger (no /.../ wrapping).
  expect(court!.triggers).toEqual([
    { keyword: "Silver\\s+Court", isRegex: true },
    { keyword: "northern border", isRegex: true },
  ]);
  expect(court!.title).toBe("Silver Court");
  expect(court!.comment).toBe("The ruling faction of Arcadia's northern border."); // description -> comment
  expect(court!.categoryId).toBe("folder-court"); // folderId -> categoryId

  // secondary keys + and_all logic.
  expect(spies!.triggerMode).toBe("advanced");
  expect(spies!.secondaryTriggers.map((t) => t.keyword)).toEqual(["Silver Court", "oath"]);
  expect(spies!.selectiveLogic).toBe("and_all");
  expect(spies!.sticky).toBe(3);
  expect(spies!.cooldown).toBe(2);
  expect(spies!.position).toBe("character"); // Marinara position 1 = after character defs

  // constant entry at depth with a non-default role.
  expect(throne!.constant).toBe(true);
  expect(throne!.position).toBe("depth"); // Marinara position 2
  expect(throne!.depth).toBe(6);
  expect(throne!.role).toBe("assistant");

  // additional matching sources -> scan flags; the unmapped "character_name" has no flag.
  expect(court!.scanCharacterDescription).toBe(true);
  expect(court!.scanUserPersona).toBe(true); // persona_description
  expect(court!.scanScenario).toBe(false);
  expect(ledger!.scanScenario).toBe(true); // character_scenario
  expect(ledger!.scanCharacterPersonality).toBe(true);

  // character filter is derived when a mode is engaged.
  expect(ledger!.characterFilter).toEqual({ names: ["char-rival-envoy"], tags: ["noble"], isExclude: true });

  // single placement axis: order -> sortOrder, priority stays the default and never leaks a Marinara field.
  expect(court!.sortOrder).toBe(10);
  expect(court!.priority).toBe(100);
});

test("marinara-lorebook maps book fields and projects folders to categories", () => {
  const canon = marinaraLorebook.toCanonical({ text: fixtureText });
  expect(canon.body.name).toBe("Arcadia World Lore");
  expect(canon.body.lorebookType).toBe("world"); // category "world"
  expect(canon.body.globalScanDepth).toBe(2);
  expect(canon.body.globalRecursion).toBe(true);
  expect(canon.body.tokenBudget).toBe(2048);
  expect(canon.body.entryBudget).toBe(100);
  expect(canon.body.tags).toEqual(["fantasy", "arcadia"]);
  expect(canon.body.categories).toEqual([
    { id: "folder-court", name: "Silver Court", sortOrder: 10, enabled: true },
    { id: "folder-spies", name: "Espionage", sortOrder: 20, enabled: true },
  ]);
});

test("marinara-lorebook re-emits an unedited book deep-equal on the re-parsed envelope", () => {
  const canon = marinaraLorebook.toCanonical({ text: fixtureText });
  expect(reparse(canon)).toEqual(JSON.parse(fixtureText));
});

test("marinara-lorebook rewrites an edited title/content, preserving raw residue", () => {
  const canon = marinaraLorebook.toCanonical({ text: fixtureText });
  canon.body.entries[0]!.title = "Renamed Court";
  canon.body.entries[0]!.content = "New body.";
  const out = reparse(canon);
  const fixture = JSON.parse(fixtureText);

  expect(out.data.entries[0].name).toBe("Renamed Court");
  expect(out.data.entries[0].content).toBe("New body.");
  expect(out.data.entries[0].keys).toEqual(["Silver\\s+Court", "northern border"]); // untouched, from twin
  expect(out.data.entries[0].useRegex).toBe(true); // untouched
  expect(out.data.entries[0].relationships).toEqual({ "e-oathbound-spies": "controls" }); // escrow residue
  expect(out.data.entries[1]).toEqual(fixture.data.entries[1]); // sibling byte-identical
});

test("marinara-lorebook keeps nested folders intact through a round-trip", () => {
  const canon = marinaraLorebook.toCanonical({ text: fixtureText });
  const out = reparse(canon);
  expect(out.data.folders[1].parentFolderId).toBe("folder-court"); // child still points at its parent
  expect(out.data.folders).toEqual(JSON.parse(fixtureText).data.folders);
});

test("marinara-lorebook keeps escrowed exotica (schedule, activationConditions) untouched", () => {
  const canon = marinaraLorebook.toCanonical({ text: fixtureText });
  // edit an unrelated entry to prove the exotica-bearing entry is not disturbed
  canon.body.entries[0]!.title = "Poke";
  const out = reparse(canon);
  const throne = out.data.entries[2];
  expect(throne.schedule).toEqual({ activeTimes: ["night"], activeDates: [], activeLocations: ["throne room"] });
  expect(throne.activationConditions).toEqual([{ field: "location", operator: "equals", value: "throne_room" }]);
  expect(throne.locked).toBe(true);
});

test("marinara-lorebook reaches the wire for an edited category rename and scan flag", () => {
  const canon = marinaraLorebook.toCanonical({ text: fixtureText });
  canon.body.categories![1]!.name = "Spycraft";
  canon.body.entries[0]!.scanScenario = true; // was false
  const out = reparse(canon);

  expect(out.data.folders[1].name).toBe("Spycraft");
  expect(out.data.folders[1].parentFolderId).toBe("folder-court"); // nesting residue survives the overlay
  // the flip adds character_scenario while the unmapped character_name is preserved from the twin.
  expect(out.data.entries[0].additionalMatchingSources).toContain("character_scenario");
  expect(out.data.entries[0].additionalMatchingSources).toContain("character_name");
  expect(out.data.entries[0].additionalMatchingSources).toContain("character_description");
});
