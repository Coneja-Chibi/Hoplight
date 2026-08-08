/**
 * The link map's whole job: turn a Lumiverse id recorded by an earlier row into the fresh id a
 * later row references, or say plainly that it never resolved. Both shapes are pinned so a caller
 * can trust `resolve`'s return without re-deriving them.
 */
import { describe, expect, test } from "bun:test";
import { WORLD_BOOK_ID } from "../_fixtures/lumiverse-archive/rows";
import { createLinkMap } from "./links";
import { createLvbakReport } from "./report";

describe("createLinkMap", () => {
  test("a recorded entity resolves to the exact id and name it was recorded under", () => {
    const links = createLinkMap();
    const report = createLvbakReport();
    links.record("world_books", WORLD_BOOK_ID, { id: "hoplight-book-1", name: "Test World Book Alpha" });

    const found = links.resolve(
      "personas/lv-persona-000000000001(Test Persona Alpha)",
      "world_books",
      WORLD_BOOK_ID,
      report,
    );
    expect(found).toEqual({ id: "hoplight-book-1", name: "Test World Book Alpha" });
    expect(report.unresolvedLinks).toEqual([]);
  });

  test("an unrecorded target resolves to null and names both sides on the report", () => {
    const links = createLinkMap();
    const report = createLvbakReport();

    const from = "regex_scripts/lv-regex-000000000003(Test Regex Dangling)";
    const found = links.resolve(from, "characters", "lv-missing-999999999999", report);

    expect(found).toBeNull();
    expect(report.unresolvedLinks).toEqual([
      {
        from,
        to: "characters/lv-missing-999999999999",
        reason: "the referenced row was skipped, failed, or never existed",
      },
    ]);
  });

  test("the same Lumiverse id under two different tables never collides", () => {
    const links = createLinkMap();
    const report = createLvbakReport();
    links.record("characters", "lv-shared-id", { id: "hoplight-char-1", name: "Character" });
    links.record("presets", "lv-shared-id", { id: "hoplight-preset-1", name: "Preset" });

    expect(links.resolve("x", "characters", "lv-shared-id", report)).toEqual({
      id: "hoplight-char-1",
      name: "Character",
    });
    expect(links.resolve("x", "presets", "lv-shared-id", report)).toEqual({
      id: "hoplight-preset-1",
      name: "Preset",
    });
  });
});
