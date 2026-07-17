/**
 * Per-platform macro catalogs. These tests encode a real audit: the lens catalogs were once
 * RoleCall's list filtered by group name, which showed SillyTavern 55/91 macros it cannot run and
 * hid 48 it can. The regressions below pin the findings so that cannot come back.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
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

/**
 * Source-pin: hand-transcribing the RoleCall catalog quietly dropped 66 of its 174 macros, so this
 * re-parses the upstream source and demands an exact match.
 *
 * The path comes from an env var, never a literal: upstream lives outside this repo (and is not
 * public), so a hardcoded path would both leak a local filesystem and make the test a permanent
 * skip for everyone else. Set VAUD_RC_MACRO_SRC to the upstream dropdown to arm it; unset, it skips.
 */
const RC_SRC = process.env.VAUD_RC_MACRO_SRC ?? "";
describe("pinned to the upstream RoleCall source", () => {
  test.skipIf(!RC_SRC || !existsSync(RC_SRC))("carries every group and macro upstream ships, none abridged", () => {
    const src = readFileSync(RC_SRC, "utf8");
    const body = src.slice(src.indexOf("const MACRO_GROUPS"), src.indexOf("interface MacroReferenceDropdownProps"));
    const marks = [...body.matchAll(/name:\s*"([^"]+)",\s*\n\s*icon:/g)].map((m) => ({ name: m[1]!, at: m.index! }));
    const realCounts = marks.map((g, i) => {
      const seg = body.slice(g.at, i + 1 < marks.length ? marks[i + 1]!.at : body.length);
      return { name: g.name, count: (seg.match(/\{ macro:/g) ?? []).length };
    });
    expect(ROLECALL_MACRO_GROUPS.map((g) => g.name)).toEqual(realCounts.map((g) => g.name));
    expect(ROLECALL_MACRO_GROUPS.map((g) => g.macros.length)).toEqual(realCounts.map((g) => g.count));
  });
});

describe("dispatch: every lens gets its OWN engine's catalog", () => {
  test("each lens resolves to a catalog", () => {
    for (const p of PRESET_WRITE_FOR_PROFILES) expect(macroGroupsForProfile(p).length).toBeGreaterThan(0);
  });

  test("sillytavern and marinara do NOT get RoleCall's catalog", () => {
    expect(macroGroupsForProfile("sillytavern")).toBe(SILLYTAVERN_MACRO_GROUPS);
    expect(macroGroupsForProfile("marinara")).toBe(MARINARA_MACRO_GROUPS);
    expect(macroGroupsForProfile("sillytavern")).not.toBe(ROLECALL_MACRO_GROUPS);
    expect(macroGroupsForProfile("marinara")).not.toBe(ROLECALL_MACRO_GROUPS);
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

/**
 * Source-pinning: when the real SillyTavern install is present, assert every token we advertise is
 * one ST's own reference lists. Skipped where ST isn't installed, so CI stays green.
 */
// Path via env var, not a literal: a local SillyTavern checkout is not in this repo, and hardcoding
// one leaks a filesystem and makes the pin a permanent skip elsewhere. Point
// VAUD_ST_MACRO_HELP at SillyTavern's public/scripts/templates/macros.html to arm it.
const ST_HELP = process.env.VAUD_ST_MACRO_HELP ?? "";
const bareName = (tok: string): string => tok.replace(/^\{\{/, "").split(/[:\s}\\]/)[0]!.toLowerCase();

describe("pinned to the real SillyTavern install", () => {
  test.skipIf(!existsSync(ST_HELP))("every ST token we show exists in ST's own macro reference", () => {
    const html = readFileSync(ST_HELP, "utf8");
    const real = new Set(
      [...html.matchAll(/<tt>(.*?)<\/tt>/g)]
        .map((m) => m[1]!.replace(/&lcub;/g, "{").replace(/&rcub;/g, "}").replace(/<[^>]*>/g, "").trim())
        .filter((t) => t.startsWith("{{"))
        .map(bareName)
        .filter(Boolean),
    );
    expect(tokens(SILLYTAVERN_MACRO_GROUPS).filter((t) => !real.has(bareName(t)))).toEqual([]);
  });
});
