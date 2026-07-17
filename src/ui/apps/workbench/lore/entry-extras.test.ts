import { describe, expect, test } from "bun:test";
import {
  biasPhraseLine,
  emptyBiasGroup,
  filterFromInputs,
  filterMode,
  parseCsv,
  patchContextConfig,
  phrasesFromLines,
  removeBiasGroup,
  replaceBiasGroup,
  rowsFromSideEffects,
  sideEffectsFromRows,
} from "./entry-extras";

describe("character filter mapping", () => {
  test("off or empty inputs collapse to null", () => {
    expect(filterFromInputs("off", "Marlowe", "hero")).toBeNull();
    expect(filterFromInputs("include", "  ", "")).toBeNull();
  });

  test("include/exclude carry parsed csv lists", () => {
    expect(filterFromInputs("include", "Marlowe, Asa-Ren", "")).toEqual({
      names: ["Marlowe", "Asa-Ren"],
      tags: [],
      isExclude: false,
    });
    expect(filterFromInputs("exclude", "", "villain")!.isExclude).toBe(true);
  });

  test("filterMode round-trips", () => {
    expect(filterMode(null)).toBe("off");
    expect(filterMode({ names: [], tags: ["x"], isExclude: true })).toBe("exclude");
    expect(filterMode({ names: ["a"], tags: [], isExclude: false })).toBe("include");
  });

  test("parseCsv trims and drops empties", () => {
    expect(parseCsv(" a, ,b,")).toEqual(["a", "b"]);
  });
});

describe("side-effect rows mapping", () => {
  test("no valid rows collapses to null", () => {
    expect(sideEffectsFromRows([], false, false)).toBeNull();
    expect(sideEffectsFromRows([{ type: "setvar", variable: "  " }], false, false)).toBeNull();
  });

  test("rows map to typed effects; value only for setvar, amount only for numeric ops", () => {
    const se = sideEffectsFromRows(
      [
        { type: "setvar", variable: "mood", value: "grim", amount: 5, scope: "global" },
        { type: "incvar", variable: "hp", value: "ignored", amount: 2, scope: "local" },
        { type: "delvar", variable: "tmp", scope: "nonsense" },
      ],
      true,
      false,
    )!;
    expect(se.effects).toEqual([
      { type: "setvar", variable: "mood", scope: "global", value: "grim" },
      { type: "incvar", variable: "hp", scope: "local", amount: 2 },
      { type: "delvar", variable: "tmp", scope: "local" },
    ]);
    expect(se.onlyOnFirstTrigger).toBe(true);
  });

  test("rowsFromSideEffects round-trips through sideEffectsFromRows", () => {
    const se = sideEffectsFromRows([{ type: "addvar", variable: "gold", amount: 10, scope: "local" }], false, true)!;
    const rows = rowsFromSideEffects(se);
    expect(sideEffectsFromRows(rows, se.onlyOnFirstTrigger, se.clearOnDeactivate)).toEqual(se);
  });
});

describe("NAI phrase bias helpers", () => {
  test("phrasesFromLines and biasPhraseLine round-trip", () => {
    const phrases = phrasesFromLines("alpha\nbeta\n", []);
    expect(phrases.map(biasPhraseLine)).toEqual(["alpha", "beta"]);
    expect(phrases[0]!.type).toBe(2);
  });

  test("replace/remove bias groups", () => {
    const g0 = emptyBiasGroup();
    const g1 = { ...emptyBiasGroup(), bias: 0.2 };
    expect(replaceBiasGroup([g0], 0, g1)[0]!.bias).toBe(0.2);
    expect(removeBiasGroup([g0, g1], 0)).toEqual([g1]);
    expect(removeBiasGroup([g0], 0)).toBeUndefined();
  });
});

describe("patchContextConfig", () => {
  test("drops empty keys and collapses an all-empty config to undefined", () => {
    expect(patchContextConfig(undefined, { prefix: "" })).toBeUndefined();
    expect(patchContextConfig({ prefix: "[ " }, { prefix: "" })).toBeUndefined();
  });

  test("merges keeping other keys", () => {
    expect(patchContextConfig({ prefix: "[ ", tokenBudget: 100 }, { suffix: " ]" })).toEqual({
      prefix: "[ ",
      tokenBudget: 100,
      suffix: " ]",
    });
  });
});
