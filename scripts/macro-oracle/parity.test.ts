/**
 * The gate: does each shipped catalog match what its real engine actually supports?
 *
 * This reads ONLY the committed fixtures, never an upstream checkout, so it runs in CI where those
 * do not exist. That split is deliberate. `extract.ts` needs the checkouts and fails loud without
 * them; this proves the catalog against the last honest capture and can never silently skip.
 *
 * Two directions, and they are not equally dangerous:
 *   over-claim  catalog has a name the engine does not. This is the one that hurts: it makes a
 *               transfer report say a macro survives when it dies on that host.
 *   under-claim catalog is missing a name the engine has. Costs coverage, not correctness: an
 *               unlisted macro gets flagged as dying when it would actually have worked.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { FIXTURE_DIR } from "./discover";
import { vocabularyOf, type EngineFixture } from "./types";
import {
  LUMIVERSE_MACRO_GROUPS,
  MARINARA_MACRO_GROUPS,
  ROLECALL_MACRO_GROUPS,
} from "../../src/core/preset/macros";
import { macroName } from "../../src/core/preset/macros/support";
import type { MacroGroup } from "../../src/core/preset/macros/types";

const loadFixture = async (id: string): Promise<EngineFixture> =>
  (await Bun.file(join(FIXTURE_DIR, `${id}.json`)).json()) as EngineFixture;

/**
 * Comparable names only. Some engines register a macro under a non-identifier name (Lumiverse has
 * one literally called "//", the comment form). `macroName` returns "" for those by design and
 * `isMacroSupported` treats comment tokens as always fine, so they can never be over-claimed or
 * flagged as dead. Comparing them would report permanent drift about a case the checks do not use.
 */
const comparable = (names: Iterable<string>): string[] =>
  [...names].filter((name) => /^[a-z_][a-z0-9_.]*$/.test(name));

/** Every name our catalog claims for an engine: token leads plus declared aliases. */
const catalogVocabulary = (groups: readonly MacroGroup[]): Set<string> =>
  new Set(
    groups
      .flatMap((group) => group.macros)
      .flatMap((entry) => [macroName(entry.macro), ...(entry.aliases ?? []).map((a) => a.toLowerCase())])
      .filter(Boolean),
  );

const CASES = [
  { id: "rolecall", groups: ROLECALL_MACRO_GROUPS },
  { id: "lumiverse", groups: LUMIVERSE_MACRO_GROUPS },
  { id: "marinara", groups: MARINARA_MACRO_GROUPS },
] as const;

describe("macro oracle parity", () => {
  test("every engine we model has a committed capture", async () => {
    for (const { id } of CASES) {
      const fixture = await loadFixture(id);
      expect(fixture.engine).toBe(id);
      expect(fixture.macroCount).toBeGreaterThan(0);
      expect(fixture.macros.length).toBe(fixture.macroCount);
    }
  });

  test("a fixture never carries upstream description prose", async () => {
    // Structural licence guard: Lumiverse grants no distribution right for any portion of its
    // software, so a stray description field is a real problem, not a style nit.
    for (const { id } of CASES) {
      const fixture = await loadFixture(id);
      for (const macro of fixture.macros) {
        expect(Object.keys(macro).sort()).toEqual(
          macro.category ? ["aliases", "category", "name"] : ["aliases", "name"],
        );
      }
    }
  });

  for (const { id, groups } of CASES) {
    test(`${id}: the catalog never claims a macro the engine does not have`, async () => {
      const fixture = await loadFixture(id);
      const engine = vocabularyOf(fixture.macros);
      const overClaimed = comparable(catalogVocabulary(groups)).filter((name) => !engine.has(name)).sort();
      expect(overClaimed).toEqual([]);
    });
  }

  test("lumiverse: the catalog covers every name the engine answers to", async () => {
    // Lumiverse is the engine whose catalog was machine-dumped from the registry, so it is the one
    // that can hold the strict both-ways contract today. The others are tracked below instead.
    const fixture = await loadFixture("lumiverse");
    const catalog = catalogVocabulary(LUMIVERSE_MACRO_GROUPS);
    const missing = comparable(vocabularyOf(fixture.macros))
      .filter((name) => !catalog.has(name))
      .sort();
    expect(missing).toEqual([]);
  });
});
