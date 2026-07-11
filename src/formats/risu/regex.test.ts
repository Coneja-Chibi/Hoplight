/**
 * Risu regex codec tests: the four R1-must checks (design/REGEX-FORMATS.md, REGEX-JEWEL-PLAN.md
 * R1 must #2/#6) - field mapping, editrequest->request, omitted-type honesty, <cbs> flags stored
 * verbatim, and byte-exact round-trip on real fixture rows.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  readRegexScripts,
  regexScriptsToWire,
  regexRowsToRules,
  rulesToRegexRows,
  type RisuRegexRow,
} from "./regex";
import type { RegexRule } from "../../entities/regex/schema";

const FIXTURE = JSON.parse(
  readFileSync(join(import.meta.dir, "../_fixtures/regex/risu-module-rows.json"), "utf8"),
) as { rows: RisuRegexRow[] };

describe("narrow card-embedded twin (moved from risu-fields.ts)", () => {
  test("readRegexScripts round-trips comment/in/out/type/flag/ableFlag", () => {
    const wire = [{ comment: "swap", in: "old", out: "new", type: "editoutput", flag: "gi", ableFlag: true }];
    const scripts = readRegexScripts(wire);
    expect(scripts).toEqual([
      { label: "swap", find: "old", replace: "new", phase: "editoutput", flags: "gi", useFlags: true },
    ]);
    expect(regexScriptsToWire(scripts!)).toEqual(wire);
  });

  test("non-array input -> undefined, not a throw", () => {
    expect(readRegexScripts(null)).toBeUndefined();
    expect(readRegexScripts("nope")).toBeUndefined();
    expect(readRegexScripts([])).toBeUndefined();
  });
});

describe("field mapping: in/out/type/flag/ableFlag/disabled <-> canonical (R1 must #2)", () => {
  test("full row maps every field", () => {
    const row: RisuRegexRow = {
      comment: "Trim",
      in: "\\bfoo\\b",
      out: "bar",
      type: "editoutput",
      flag: "gi",
      ableFlag: true,
      disabled: false,
    };
    const rule = regexRowsToRules([row]).at(0)!;
    expect(rule).toMatchObject({
      id: "0",
      label: "Trim",
      find: "\\bfoo\\b",
      flags: "gi",
      useFlags: true,
      replace: "bar",
      phases: ["output"],
      enabled: true,
      sortOrder: 0,
    });
  });

  test("disabled:true -> enabled:false", () => {
    const rule = regexRowsToRules([{ comment: "c", in: "a", out: "b", type: "editinput", disabled: true }]).at(0)!;
    expect(rule.enabled).toBe(false);
  });

  test("malformed disabled value (observed live: empty string) is tolerated as enabled", () => {
    const rule = regexRowsToRules([{ comment: "c", in: "a", out: "b", type: "editinput", disabled: "" as unknown as boolean }]).at(0)!;
    expect(rule.enabled).toBe(true);
  });

  test("non-array input returns empty array, never throws", () => {
    expect(regexRowsToRules(null)).toEqual([]);
    expect(regexRowsToRules("nope")).toEqual([]);
  });
});

describe("editinput/editoutput/editdisplay/editrequest/editprocess -> phase (R1 must #2)", () => {
  test.each([
    ["editinput", "input"],
    ["editoutput", "output"],
    ["editdisplay", "display"],
    ["editrequest", "request"],
    ["editprocess", "request"],
  ])("%s -> %s", (wireType, phase) => {
    const rule = regexRowsToRules([{ comment: "c", in: "a", out: "b", type: wireType }]).at(0)!;
    expect(rule.phases).toEqual([phase]);
  });

  test("unknown type string passes through verbatim as an open-union phase", () => {
    const rule = regexRowsToRules([{ comment: "c", in: "a", out: "b", type: "editfuture" }]).at(0)!;
    expect(rule.phases).toEqual(["editfuture"]);
  });
});

describe("omitted type: no invented default (R1 residual)", () => {
  test("omitted type decodes to an empty phases array", () => {
    const rule = regexRowsToRules([{ comment: "c", in: "a", out: "b" }]).at(0)!;
    expect(rule.phases).toEqual([]);
  });

  test("unedited row with omitted type re-exports with type still absent", () => {
    const twin: RisuRegexRow[] = [{ comment: "c", in: "a", out: "b" }];
    const rules = regexRowsToRules(twin);
    const out = rulesToRegexRows(rules, twin);
    expect("type" in out[0]!).toBe(false);
    expect(out[0]).toEqual(twin[0]);
  });
});

describe("<cbs>-bearing flags stored verbatim, never compiled (R1 must #2)", () => {
  test("gu<cbs> flag string is preserved exactly", () => {
    const rule = regexRowsToRules([{ comment: "c", in: "a", out: "b", type: "editdisplay", flag: "gu<cbs>" }]).at(0)!;
    expect(rule.flags).toBe("gu<cbs>");
    // never attempt to compile it here - the codec has no RegExp construction at all.
  });
});

describe("byte-exact round-trip on real fixture rows (R1 must #6)", () => {
  test("unedited fixture rows re-emit identical to the source array", () => {
    const rules = regexRowsToRules(FIXTURE.rows);
    const out = rulesToRegexRows(rules, FIXTURE.rows);
    expect(out).toEqual(FIXTURE.rows);
  });

  test("editrequest spelling survives an unrelated edit (label change) untouched", () => {
    const rules = regexRowsToRules(FIXTURE.rows);
    const requestRule = rules.find((r) => r.phases.includes("request"))!;
    expect(requestRule).toBeTruthy();
    const edited: RegexRule = { ...requestRule, label: "renamed" };
    const out = rulesToRegexRows(
      rules.map((r) => (r.id === edited.id ? edited : r)),
      FIXTURE.rows,
    );
    const row = out.find((r) => r.comment === "renamed")!;
    expect(row.type).toBe("editrequest"); // untouched twin field, not rewritten to editprocess
  });

  test("editing the phase on the editrequest row writes the current source spelling editprocess", () => {
    const rules = regexRowsToRules(FIXTURE.rows);
    const requestRule = rules.find((r) => r.phases.includes("request"))!;
    const edited: RegexRule = { ...requestRule, phases: ["output"] };
    const out = rulesToRegexRows(
      rules.map((r) => (r.id === edited.id ? edited : r)),
      FIXTURE.rows,
    );
    const changedRow = out[Number(edited.id)]!;
    expect(changedRow.type).toBe("editoutput");
  });

  test("editing a rule's flags to request phase from empty writes editprocess (fresh phase set)", () => {
    const rules = regexRowsToRules(FIXTURE.rows);
    const displayRule = rules.find((r) => r.phases.includes("display") && r.flags === "g")!;
    expect(displayRule).toBeTruthy();
    const edited: RegexRule = { ...displayRule, phases: ["request"] };
    const out = rulesToRegexRows(
      rules.map((r) => (r.id === edited.id ? edited : r)),
      FIXTURE.rows,
    );
    const changedRow = out[Number(edited.id)]!;
    expect(changedRow.type).toBe("editprocess");
  });

  test("deleted rule drops from the re-exported wire array", () => {
    const rules = regexRowsToRules(FIXTURE.rows);
    const kept = rules.filter((r) => r.id !== "0");
    const out = rulesToRegexRows(kept, FIXTURE.rows);
    expect(out.length).toBe(FIXTURE.rows.length - 1);
  });

  test("added rule with no twin appends a fresh row", () => {
    const rules = regexRowsToRules(FIXTURE.rows);
    const added: RegexRule = {
      id: "new-1",
      label: "New rule",
      find: "x",
      flags: "g",
      replace: "y",
      phases: ["input"],
      enabled: true,
      sortOrder: rules.length,
    };
    const out = rulesToRegexRows([...rules, added], FIXTURE.rows);
    expect(out.length).toBe(FIXTURE.rows.length + 1);
    const row = out[out.length - 1]!;
    expect(row).toEqual({ comment: "New rule", in: "x", out: "y", type: "editinput", flag: "g" });
  });
});
