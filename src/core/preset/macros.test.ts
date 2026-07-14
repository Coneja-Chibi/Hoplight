/**
 * The macro reference catalog + per-lens visibility (the capability layer). Guards that the modeled
 * allow-lists never silently drop a group to a typo, that the lens ordering is canonical, and that
 * every macro entry is well-formed. Catalog is transcribed from RC's MacroReferenceDropdown.
 */
import { describe, expect, test } from "bun:test";
import { MACRO_GROUPS, MACRO_GROUPS_BY_PROFILE, macroGroupsForProfile } from "./macros";
import { PRESET_WRITE_FOR_PROFILES } from "./capabilities";

const names = (gs: { name: string }[]): string[] => gs.map((g) => g.name);
const ALL = names(MACRO_GROUPS);

describe("macro catalog integrity", () => {
  test("group names are unique", () => {
    expect(new Set(ALL).size).toBe(ALL.length);
  });

  test("every entry has a non-empty macro token and description", () => {
    for (const g of MACRO_GROUPS) {
      expect(g.macros.length).toBeGreaterThan(0);
      for (const m of g.macros) {
        expect(m.macro.trim().length).toBeGreaterThan(0);
        expect(m.description.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("per-lens visibility", () => {
  test("full + rolecall expose the whole engine, in canonical order", () => {
    expect(names(macroGroupsForProfile("full"))).toEqual(ALL);
    expect(names(macroGroupsForProfile("rolecall"))).toEqual(ALL);
  });

  test("sillytavern drops RC's engine-only Runtime & Stats + Roleplay & Game", () => {
    const st = names(macroGroupsForProfile("sillytavern"));
    expect(st).not.toContain("Runtime & Stats");
    expect(st).not.toContain("Roleplay & Game");
    expect(st).toContain("Lorebook");
  });

  test("marinara exposes its variable/game subset", () => {
    const mari = names(macroGroupsForProfile("marinara"));
    expect(mari).toContain("Variables");
    expect(mari).toContain("Roleplay & Game");
    expect(mari.length).toBeLessThan(ALL.length);
  });

  test("every lens allow-list name resolves to a real group (no typos drop groups)", () => {
    for (const profile of PRESET_WRITE_FOR_PROFILES) {
      const allowed = MACRO_GROUPS_BY_PROFILE[profile];
      if (allowed === "all") continue;
      const resolved = names(macroGroupsForProfile(profile));
      // filter never invents; a typo'd name would make resolved shorter than the allow-list
      expect(resolved.length).toBe(allowed.length);
      for (const n of allowed) expect(ALL).toContain(n);
    }
  });

  test("filtered groups keep canonical order, never allow-list order", () => {
    const mari = names(macroGroupsForProfile("marinara"));
    const sorted = [...mari].sort((a, b) => ALL.indexOf(a) - ALL.indexOf(b));
    expect(mari).toEqual(sorted);
  });
});
