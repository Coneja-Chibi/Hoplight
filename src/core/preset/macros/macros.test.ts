/**
 * Per-platform macro catalogs. These tests encode a real audit: the lens catalogs were once
 * RoleCall's list filtered by group name, which showed SillyTavern 55/91 macros it cannot run and
 * hid 48 it can. The regressions below pin the findings so that cannot come back.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  LUMIVERSE_MACRO_GROUPS,
  macroGroupsForProfile,
  MARINARA_MACRO_GROUPS,
  ROLECALL_MACRO_GROUPS,
  SILLYTAVERN_MACRO_GROUPS,
} from "./index";
import type { MacroGroup } from "./types";
import { PRESET_WRITE_FOR_PROFILES } from "../capabilities";

const CATALOGS: Array<[string, MacroGroup[]]> = [
  ["rolecall", ROLECALL_MACRO_GROUPS],
  ["sillytavern", SILLYTAVERN_MACRO_GROUPS],
  ["marinara", MARINARA_MACRO_GROUPS],
  ["lumiverse", LUMIVERSE_MACRO_GROUPS],
];

const tokens = (gs: MacroGroup[]): string[] => gs.flatMap((g) => g.macros.map((m) => m.macro));
const has = (gs: MacroGroup[], tok: string): boolean => tokens(gs).includes(tok);

describe("catalog integrity", () => {
  for (const [name, cat] of CATALOGS) {
    test(`${name}: unique group names, well-formed entries`, () => {
      const groupNames = cat.map((g) => g.name);
      expect(new Set(groupNames).size).toBe(groupNames.length);
      for (const g of cat) {
        expect(g.macros.length).toBeGreaterThan(0);
        for (const m of g.macros) {
          expect(m.macro.trim().startsWith("{{")).toBe(true);
          expect(m.description.trim().length).toBeGreaterThan(0);
        }
      }
    });
  }
});

interface CatalogPin {
  provenance: string;
  capturedAt: string;
  groups: Array<{ name: string; tokens: string[] }>;
}

const pin = (name: string): CatalogPin => JSON.parse(
  readFileSync(join(import.meta.dir, "_fixtures", `${name}.json`), "utf8"),
) as CatalogPin;

describe("pinned to reviewed upstream snapshots", () => {
  test("RoleCall carries every reviewed group and token, none abridged", () => {
    const source = pin("rolecall-source-pin");
    expect(source.provenance).toContain("RoleCall");
    expect(ROLECALL_MACRO_GROUPS.map((group) => ({
      name: group.name,
      tokens: group.macros.map((macro) => macro.macro),
    }))).toEqual(source.groups);
  });

  test("SillyTavern carries every reviewed token", () => {
    const source = pin("sillytavern-source-pin");
    expect(source.provenance).toContain("SillyTavern");
    expect(SILLYTAVERN_MACRO_GROUPS.map((group) => ({
      name: group.name,
      tokens: group.macros.map((macro) => macro.macro),
    }))).toEqual(source.groups);
  });
});

describe("Lumiverse source pin: the catalog matches the live engine registry exactly", () => {
  // Arm with VAUD_LUMI_MACRO_SRC=<path to the Lumiverse clone>. The pin RUNS the engine's own
  // registration code and compares name+alias sets both ways, so an upstream macro added on
  // staging or a catalog typo both fail loud. Unarmed (CI without the clone), it skips.
  const src = process.env["VAUD_LUMI_MACRO_SRC"];
  const lead = (token: string): string => /^\{\{([^:}\s]+)/.exec(token)?.[1]?.toLowerCase() ?? "";

  test.if(!!src)("every engine name and alias is cataloged, and none are invented", async () => {
    const mod = (await import(`${src!.replaceAll("\\", "/")}/src/macros/index.ts`)) as {
      initMacros: () => void;
      registry: { getAllMacros: () => Array<{ name: string; aliases?: string[] }> };
    };
    mod.initMacros();
    const engine = new Set(
      mod.registry.getAllMacros().flatMap((d) => [d.name, ...(d.aliases ?? [])]).map((n) => n.toLowerCase()),
    );
    const catalog = new Set(
      LUMIVERSE_MACRO_GROUPS.flatMap((g) => g.macros).flatMap((m) => [
        lead(m.macro),
        ...(m.aliases ?? []).map((a) => a.toLowerCase()),
      ]),
    );
    expect(engine.size).toBeGreaterThanOrEqual(400); // 239 macros + ~180 aliases; floor guards an empty parse
    expect([...engine].filter((n) => !catalog.has(n))).toEqual([]);
    expect([...catalog].filter((n) => !engine.has(n))).toEqual([]);
  });
});

describe("dispatch: every lens gets its OWN engine's catalog", () => {
  test("each lens resolves to a catalog", () => {
    for (const p of PRESET_WRITE_FOR_PROFILES) expect(macroGroupsForProfile(p).length).toBeGreaterThan(0);
  });

  test("sillytavern, marinara, and lumiverse do NOT get RoleCall's catalog", () => {
    expect(macroGroupsForProfile("sillytavern")).toBe(SILLYTAVERN_MACRO_GROUPS);
    expect(macroGroupsForProfile("marinara")).toBe(MARINARA_MACRO_GROUPS);
    expect(macroGroupsForProfile("lumiverse")).toBe(LUMIVERSE_MACRO_GROUPS);
    expect(macroGroupsForProfile("sillytavern")).not.toBe(ROLECALL_MACRO_GROUPS);
    expect(macroGroupsForProfile("marinara")).not.toBe(ROLECALL_MACRO_GROUPS);
    expect(macroGroupsForProfile("lumiverse")).not.toBe(ROLECALL_MACRO_GROUPS);
  });

  test("full mirrors the placement matrix: the superset dialect", () => {
    expect(macroGroupsForProfile("full")).toBe(ROLECALL_MACRO_GROUPS);
    expect(macroGroupsForProfile("rolecall")).toBe(ROLECALL_MACRO_GROUPS);
  });
});

describe("regression: RoleCall-only macros must never leak into another engine's lens", () => {
  // every one of these was shown on the ST lens by the old filtered catalog; ST cannot run any.
  const RC_ONLY = [
    "{{firstMessage}}", "{{charVersion}}", "{{charCreator}}", "{{charTags}}", "{{accentColor}}", "{{palette}}",
    "{{messageCount}}", "{{recentMessages::N}}", "{{memories}}", "{{season}}",
    "{{hasvar::name}}", "{{pushvar::name::value}}", "{{listvar::name}}", "{{allvars}}",
    "{{coinflip}}", "{{shuffle::a::b::c}}", "{{weighted::a::3::b::1}}",
    "{{upper::text}}", "{{title::text}}", "{{truncate::text::len}}", "{{regex::text::pattern::new}}",
    "{{compare::a::==::b}}", "{{switch::val::case1::res1}}", "{{and::a::b}}",
    "{{they}}", "{{uthey}}", "{{stat::name}}", "{{check::stat::DC}}", "{{inventory}}",
    "{{triggered}}", "{{lorebookCount}}",
  ];

  test("SillyTavern lens carries none of them", () => {
    expect(RC_ONLY.filter((t) => has(SILLYTAVERN_MACRO_GROUPS, t))).toEqual([]);
  });

  test("Marinara lens carries none of them", () => {
    expect(RC_ONLY.filter((t) => has(MARINARA_MACRO_GROUPS, t))).toEqual([]);
  });

  test("Marinara never gets RC's invented stat/roleplay macros", () => {
    for (const t of ["{{mood}}", "{{tension}}", "{{hp}}", "{{progress::current::max}}"]) {
      expect(has(MARINARA_MACRO_GROUPS, t)).toBe(false);
    }
  });
});

describe("regression: separators are load-bearing and differ per engine", () => {
  test("dice: ST and Marinara use one colon, RoleCall uses two", () => {
    expect(has(SILLYTAVERN_MACRO_GROUPS, "{{roll:1d6}}")).toBe(true);
    expect(has(MARINARA_MACRO_GROUPS, "{{roll:XdY}}")).toBe(true);
    expect(has(ROLECALL_MACRO_GROUPS, "{{roll::NdM}}")).toBe(true);
    expect(has(SILLYTAVERN_MACRO_GROUPS, "{{roll::NdM}}")).toBe(false);
    expect(has(MARINARA_MACRO_GROUPS, "{{roll::NdM}}")).toBe(false);
  });

  test("ST's datetimeformat is space-separated, never ::", () => {
    expect(has(SILLYTAVERN_MACRO_GROUPS, "{{datetimeformat::FMT}}")).toBe(false);
    expect(tokens(SILLYTAVERN_MACRO_GROUPS).some((t) => t.startsWith("{{datetimeformat "))).toBe(true);
  });

  test("trim takes no argument outside RoleCall", () => {
    expect(has(SILLYTAVERN_MACRO_GROUPS, "{{trim}}")).toBe(true);
    expect(has(MARINARA_MACRO_GROUPS, "{{trim}}")).toBe(true);
    expect(has(SILLYTAVERN_MACRO_GROUPS, "{{trim::text}}")).toBe(false);
    expect(has(MARINARA_MACRO_GROUPS, "{{trim::text}}")).toBe(false);
  });
});

describe("regression: the silent-wrong-output trap", () => {
  // {{random::a::b}} LOOKS shared but ST picks one of the listed items; RC treats it as a range.
  test("ST's random:: is documented as a list pick, never a range", () => {
    const st = SILLYTAVERN_MACRO_GROUPS.flatMap((g) => g.macros).find((m) => m.macro === "{{random::a::b}}");
    expect(st).toBeDefined();
    expect(st!.description.toLowerCase()).toContain("not a range");
    expect(has(SILLYTAVERN_MACRO_GROUPS, "{{random::min::max}}")).toBe(false);
  });

  test("Marinara's range form is single-colon and IS a range", () => {
    const mari = MARINARA_MACRO_GROUPS.flatMap((g) => g.macros).find((m) => m.macro === "{{random:X:Y}}");
    expect(mari).toBeDefined();
    expect(mari!.description.toLowerCase()).toContain("between");
    expect(has(MARINARA_MACRO_GROUPS, "{{random::min::max}}")).toBe(false);
  });
});

describe("regression: the Lumiverse dialect is its own, never RC's or ST's", () => {
  test("dual-mode random is documented as BOTH range and list pick", () => {
    const rand = LUMIVERSE_MACRO_GROUPS.flatMap((g) => g.macros).find((m) => m.macro === "{{random::min::max}}");
    expect(rand).toBeDefined();
    expect(rand!.description.toLowerCase()).toContain("range");
    expect(rand!.description.toLowerCase()).toContain("pick");
  });

  test("Lumi dice are double-colon; Lumi-only systems never leak into other lenses", () => {
    expect(has(LUMIVERSE_MACRO_GROUPS, "{{roll::2d6}}")).toBe(true);
    for (const t of ["{{lumiaOOC}}", "{{loomSovHand}}", "{{presetBlock::key}}", "{{entityFacts::name}}"]) {
      expect(has(LUMIVERSE_MACRO_GROUPS, t)).toBe(true);
      expect(has(SILLYTAVERN_MACRO_GROUPS, t)).toBe(false);
      expect(has(MARINARA_MACRO_GROUPS, t)).toBe(false);
      expect(has(ROLECALL_MACRO_GROUPS, t)).toBe(false);
    }
  });

  test("aliases are carried and heavy: the engine's alternate names resolve as supported", () => {
    const entries = LUMIVERSE_MACRO_GROUPS.flatMap((g) => g.macros);
    const aliasCount = entries.reduce((n, m) => n + (m.aliases?.length ?? 0), 0);
    expect(aliasCount).toBeGreaterThanOrEqual(170);
    const char = entries.find((m) => m.macro === "{{char}}");
    expect(char?.aliases).toEqual(["charName"]);
  });
});

describe("regression: real macros the old filtered catalog hid", () => {
  test("ST exposes the ones it actually has", () => {
    for (const t of ["{{pipe}}", "{{original}}", "{{isotime}}", "{{var::name}}", "{{mesExamplesRaw}}",
      "{{group}}", "{{notChar}}", "{{lastMessageId}}", "{{maxPrompt}}", "{{isMobile}}"]) {
      expect(has(SILLYTAVERN_MACRO_GROUPS, t)).toBe(true);
    }
  });

  test("Marinara exposes the ones it actually has", () => {
    for (const t of ["{{backstory}}", "{{appearance}}", "{{example}}", "{{characters}}", "{{agent::TYPE}}",
      "{{trimStart}}", "{{uppercase}}...{{/uppercase}}", "{{NAME}}"]) {
      expect(has(MARINARA_MACRO_GROUPS, t)).toBe(true);
    }
  });
});
