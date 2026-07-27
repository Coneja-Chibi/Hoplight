/**
 * The macro oracle's fixture shape: what a real engine says its macro vocabulary is.
 *
 * FACTS ONLY, AND THE SCHEMA ENFORCES IT. There is deliberately no `description` field. Macro names,
 * aliases, arity and the engine's own category labels are facts about an interface and carry over
 * freely. Upstream description prose does not: Lumiverse ships under a source-available licence that
 * grants no distribution right for any portion of its software, so its prose can never live in this
 * repo. Omitting the field is the enforcement, because a field that exists gets filled in by whoever
 * touches this next. `src/core/preset/macros/lumiverse.ts` set this precedent already ("only
 * tokens/syntax/behavior facts carry over, never its prose"); this schema makes it structural.
 *
 * These fixtures are captured out-of-band by `extract.ts`, which runs each engine's own registration
 * code in its own checkout. Nothing here evaluates a macro and nothing here ships: this is dev
 * tooling that produces data. It therefore does not depend on ADR-012, which governs whether
 * Hoplight may host a macro evaluator at all. Do not read this harness as that ADR being assumed.
 */

/** One macro as its own engine defines it. */
export interface EngineMacroFact {
  /** Primary name, lowercased. The key the engine dispatches on. */
  name: string;
  /** Alternate names the engine resolves to this same macro, lowercased and sorted. */
  aliases: string[];
  /** The engine's own category label, when it has one. A short label, never prose. */
  category?: string;
}

/** One engine's complete captured vocabulary. */
export interface EngineFixture {
  /** Matches the extractor id and the catalog it is compared against. */
  engine: string;
  /** How this was obtained, so a reader can re-derive it rather than trust it. */
  provenance: string;
  /** Env var that points at the checkout, for whoever needs to recapture. */
  sourceEnvVar: string;
  /** ISO date supplied by the caller; never read from the clock inside an extractor. */
  capturedAt: string;
  macroCount: number;
  aliasCount: number;
  /** Sorted by name so a recapture produces a reviewable diff, not a reordering. */
  macros: EngineMacroFact[];
}

/** A drop-in extractor. One file per engine under ./engines, discovered by folder. */
export interface MacroOracleEngine {
  /** Must match the fixture filename and the catalog id it verifies. */
  id: string;
  /** Env var naming the checkout root. */
  sourceEnvVar: string;
  /** Human-readable note recorded into the fixture. */
  provenance: string;
  /** Run the engine's own registration code and report its vocabulary. Throws if the checkout is
   *  unusable: a missing source must fail loud, never silently produce an empty capture. */
  extract(root: string): Promise<EngineMacroFact[]>;
}

/** Normalize and sort so two captures of the same engine diff cleanly. */
export function normalizeFacts(raw: readonly EngineMacroFact[]): EngineMacroFact[] {
  return raw
    .map((fact) => ({
      name: fact.name.toLowerCase(),
      aliases: [...new Set(fact.aliases.map((a) => a.toLowerCase()))].sort(),
      ...(fact.category ? { category: fact.category } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every name the engine answers to: primaries plus aliases. */
export function vocabularyOf(facts: readonly EngineMacroFact[]): Set<string> {
  return new Set(facts.flatMap((fact) => [fact.name, ...fact.aliases]));
}
