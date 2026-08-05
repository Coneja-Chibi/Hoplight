/**
 * The regex slice: rows group into one canonical set per scope through the existing Lumiverse regex
 * codec, a scoped set's name comes from the resolved target (or its raw id when the target was
 * never imported), and a broken placement column drops only that row before grouping ever runs.
 */
import { describe, expect, test } from "bun:test";
import { buildBadRowsLvbak, buildCrossLinksLvbak, buildMinimalLvbak } from "../_fixtures/lumiverse-archive/build-lvbak";
import { CHARACTER_ID, DANGLING_ID, PRESET_ID, REGEX_ID } from "../_fixtures/lumiverse-archive/rows";
import { createBinaries, indexImages } from "./binaries";
import { importCharacters, indexCharacterGallery } from "./characters";
import { createLinkMap } from "./links";
import { ndjsonLineCeiling } from "./ndjson";
import { importPresets } from "./presets";
import { groupRegexRows, importRegexSets, regexRowToScript } from "./regex-sets";
import { createLvbakReport } from "./report";
import { readTable, type TableRow } from "./table-walk";
import { zipEntrySource } from "./zip-source";

const V1_CEILING = ndjsonLineCeiling(1);
const noFailures = () => expect.unreachable();

/** Populate links the way a real orchestrator would, running characters and presets first. */
async function populateLinks(bytes: Uint8Array) {
  const report = createLvbakReport();
  const links = createLinkMap();

  const charSource = zipEntrySource(bytes);
  const binaries = createBinaries(charSource, await charSource.list(), report);
  const images = await indexImages(charSource, { lineCeiling: V1_CEILING, onFailure: noFailures });
  const gallery = await indexCharacterGallery(charSource, { lineCeiling: V1_CEILING, onFailure: noFailures });
  await importCharacters(charSource, { lineCeiling: V1_CEILING, report, links, binaries, images, gallery });

  const presetSource = zipEntrySource(bytes);
  await importPresets(presetSource, { lineCeiling: V1_CEILING, report, links });

  return { report, links };
}

async function readRegexRows(bytes: Uint8Array): Promise<TableRow[]> {
  const source = zipEntrySource(bytes);
  const rows: TableRow[] = [];
  for await (const read of readTable(source, "regex_scripts", { lineCeiling: V1_CEILING, onFailure: noFailures })) {
    rows.push(read);
  }
  return rows;
}

describe("regexRowToScript", () => {
  test("maps flat columns, coerces 0/1 to booleans, and carries inner-JSON arrays through", async () => {
    const [read] = await readRegexRows(buildMinimalLvbak());
    const script = regexRowToScript(read!.row, read!.inner);
    expect(script).toMatchObject({
      id: REGEX_ID,
      name: "Test Regex Alpha",
      find_regex: "fixture",
      replace_string: "FIXTURE",
      flags: "gi",
      placement: ["user_input", "ai_output"],
      target: ["prompt", "display"],
      run_on_edit: false,
      disabled: false,
      sort_order: 0,
      description: "A synthetic regex rule for fixture use.",
    });
    expect(script.actions).toEqual([{ type: "replace", label: "Shout the word" }]);
    expect(script.metadata).toEqual({ source: "fixture" });
  });
});

describe("groupRegexRows", () => {
  test("account-scoped rows share one bucket; character/preset scopes split by scope_id, not just scope", async () => {
    const rows = await readRegexRows(buildCrossLinksLvbak());
    const groups = groupRegexRows(rows);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => [g.scope, g.scopeId])).toEqual([
      ["character", CHARACTER_ID],
      ["preset", PRESET_ID],
      ["character", DANGLING_ID],
    ]);
  });
});

describe("importRegexSets", () => {
  test("buildMinimalLvbak's one account-scoped row becomes one set under the neutral name", async () => {
    const source = zipEntrySource(buildMinimalLvbak());
    const report = createLvbakReport();
    const links = createLinkMap();
    const sets = await importRegexSets(source, { lineCeiling: V1_CEILING, report, links });

    expect(sets).toHaveLength(1);
    const set = sets[0]!;
    if (set.kind !== "regex") throw new Error("no regex set in the result");
    expect(set.body.name).toBe("Lumiverse regex scripts");
    expect(set.body.rules).toHaveLength(1);
    const rule = set.body.rules[0]!;
    expect(rule.id).toBe(REGEX_ID);
    expect(rule.label).toBe("Test Regex Alpha");
    expect(rule.phases).toEqual(["input", "output"]);
    expect(rule.targets).toEqual(["prompt", "display"]);
    expect(rule.enabled).toBe(true);

    // no scope target to resolve for the account bucket: no links key on the archive escrow
    const unmapped = set.original!["lumiverse-archive"]!.unmapped as Record<string, unknown>;
    expect(unmapped.links).toBeUndefined();
    // the set is derived from several rows in general, so escrow carries the row array, not one row
    const archived = set.original!["lumiverse-archive"]!.raw as { rows: unknown[] };
    expect(archived.rows).toHaveLength(1);

    expect(report.imported.regex).toEqual([{ id: set.id, name: "Lumiverse regex scripts" }]);
  });

  test("buildCrossLinksLvbak: a character-scoped and a preset-scoped set each resolve to their target's name", async () => {
    const bytes = buildCrossLinksLvbak();
    const { report, links } = await populateLinks(bytes);
    const source = zipEntrySource(bytes);
    const sets = await importRegexSets(source, { lineCeiling: V1_CEILING, report, links });

    expect(sets).toHaveLength(3);
    const byName = new Map(sets.map((s) => [s.kind === "regex" ? s.body.name : "", s]));

    const charSet = byName.get("Test Character Alpha regex")!;
    if (charSet.kind !== "regex") throw new Error("unreachable");
    const charLinks = charSet.original!["lumiverse-archive"]!.unmapped as { links: Record<string, unknown> };
    expect(charLinks.links).toMatchObject({ scope: "character", scopeId: CHARACTER_ID });
    expect(typeof charLinks.links.resolvedId).toBe("string");

    const presetSet = byName.get("Test Preset Alpha regex")!;
    if (presetSet.kind !== "regex") throw new Error("unreachable");
    const presetLinks = presetSet.original!["lumiverse-archive"]!.unmapped as { links: Record<string, unknown> };
    expect(presetLinks.links).toMatchObject({ scope: "preset", scopeId: PRESET_ID });
    expect(typeof presetLinks.links.resolvedId).toBe("string");
  });

  test("a dangling scope still imports, named from the raw id, with the miss recorded on both sides", async () => {
    const bytes = buildCrossLinksLvbak();
    const { report, links } = await populateLinks(bytes);
    const source = zipEntrySource(bytes);
    const sets = await importRegexSets(source, { lineCeiling: V1_CEILING, report, links });

    const dangling = sets.find((s) => s.kind === "regex" && s.body.name === `${DANGLING_ID} regex`);
    if (!dangling || dangling.kind !== "regex") throw new Error("no dangling-scope set in the result");
    const danglingLinks = dangling.original!["lumiverse-archive"]!.unmapped as { links: Record<string, unknown> };
    expect(danglingLinks.links).toEqual({ scope: "character", scopeId: DANGLING_ID, resolvedId: null });

    const unresolved = report.unresolvedLinks.find((l) => l.to === `characters/${DANGLING_ID}`);
    expect(unresolved).toBeDefined();
    expect(unresolved!.from).toContain("regex_scripts/");
  });

  test("a broken placement column drops only that row; its account-scoped sibling still groups and imports", async () => {
    const source = zipEntrySource(buildBadRowsLvbak());
    const report = createLvbakReport();
    const links = createLinkMap();
    const sets = await importRegexSets(source, { lineCeiling: V1_CEILING, report, links });

    expect(sets).toHaveLength(1);
    const set = sets[0]!;
    if (set.kind !== "regex") throw new Error("no regex set in the result");
    expect(set.body.rules).toHaveLength(1);
    expect(set.body.rules[0]!.label).toBe("Test Regex Alpha");

    const failure = report.failed.find((f) => f.table === "regex_scripts");
    expect(failure).toBeDefined();
    expect(failure!.rowId).toBe("lv-regex-000000000002");
    expect(failure!.reason.startsWith("placement")).toBe(true);
  });
});
