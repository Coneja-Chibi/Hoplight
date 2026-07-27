/**
 * The cross-engine join. Every "what is this on that platform?" answer is COMPUTED here from the
 * per-engine catalogs; nothing in this file, and nothing anywhere else, states a pair by hand.
 *
 * The shape of the answer is the one a person actually wants:
 *   on this platform it is X, and on the others it is A, B, or nothing at all.
 *
 * How a verdict is reached, in order:
 *   1. Resolve the source token to the catalog entry whose argument count it matches.
 *   2. If that entry declares an op, look for a target entry with the SAME op. Found means
 *      portable (rewrite it into the target's spelling); not found means a real gap.
 *   3. If both sides share a name but declare DIFFERENT ops, that is a collision. It is derived,
 *      not remembered: this is the {{random}} trap and nothing had to be written down for it.
 *   4. With no op on either side, fall back to the name. That is correct for the large majority of
 *      macros, which mean the same thing everywhere they appear.
 */
import type { PresetWriteForProfile } from "../capabilities";
import { PRESET_WRITE_FOR_PROFILES } from "../capabilities";
import { macroGroupsForProfile } from "./index";
import { macroName } from "./support";
import type { MacroEntry } from "./types";
import { arityAccepts, arityOf, opFamily, renderToken, type MacroOp } from "./ops";

/** One engine's way of performing an operation. */
export interface EngineForm {
  engine: PresetWriteForProfile;
  entry: MacroEntry;
}

export type Verdict =
  /** The target has the same operation; the token is rewritten into its spelling. */
  | "portable"
  /** Same name on both engines, but they perform DIFFERENT operations. */
  | "collision"
  /** The target has nothing for this operation. Near neighbours may exist. */
  | "absent";

export interface Equivalence {
  verdict: Verdict;
  /** The source entry that matched the token's argument count. */
  source: MacroEntry | null;
  /** The target's form for the same operation, when it has one. */
  target: MacroEntry | null;
  /** The token rewritten in the target's spelling; null when there is nothing to rewrite to. */
  rewritten: string | null;
  /** Same-family forms on the target, offered when there is no exact match. */
  candidates: string[];
  why: string;
}

/** Every entry an engine publishes, flattened out of its groups. */
function entriesOf(engine: PresetWriteForProfile): MacroEntry[] {
  return macroGroupsForProfile(engine).flatMap((group) => group.macros);
}

/** Does this entry answer to `name`, as its own name or one of its aliases? */
function answersTo(entry: MacroEntry, name: string): boolean {
  if (macroName(entry.macro) === name) return true;
  return (entry.aliases ?? []).some((alias) => alias.toLowerCase() === name);
}

/**
 * The entry an engine would actually use for this name at this argument count. A name with several
 * documented forms resolves by arity, which is what keeps three-argument `{{random}}` from being
 * judged by the two-argument form's meaning.
 */
export function resolveEntry(
  engine: PresetWriteForProfile,
  name: string,
  argCount: number,
): MacroEntry | null {
  const matches = entriesOf(engine).filter((entry) => answersTo(entry, name));
  if (matches.length === 0) return null;
  return matches.find((entry) => arityAccepts(arityOf(entry.macro), argCount))
    ?? matches.find((entry) => arityOf(entry.macro) === null)
    ?? matches[0]
    ?? null;
}

/** Every engine that can perform this operation, with the form it uses. THE derived view. */
export function formsForOp(op: MacroOp): EngineForm[] {
  const forms: EngineForm[] = [];
  for (const engine of PRESET_WRITE_FOR_PROFILES) {
    for (const entry of entriesOf(engine)) {
      if (entry.op === op) forms.push({ engine, entry });
    }
  }
  return forms;
}

/** Same-family forms on one engine, for when the exact operation is missing. */
function familyCandidates(engine: PresetWriteForProfile, op: MacroOp): string[] {
  const family = opFamily(op);
  return entriesOf(engine)
    .filter((entry) => entry.op && opFamily(entry.op) === family)
    .map((entry) => entry.macro);
}

/**
 * What one token becomes on another engine. `args` is the token's already-split argument list, so
 * the caller keeps ownership of parsing and this stays a pure lookup.
 */
export function equivalentOf(
  from: PresetWriteForProfile,
  to: PresetWriteForProfile,
  name: string,
  args: readonly string[],
): Equivalence {
  const source = resolveEntry(from, name, args.length);
  const sameName = resolveEntry(to, name, args.length);

  // No op on the source: the name is the meaning. Shared name means it carries over untouched.
  if (!source?.op) {
    if (sameName && !sameName.op) {
      return {
        verdict: "portable",
        source,
        target: sameName,
        rewritten: null, // identical spelling; nothing to change
        candidates: [],
        why: `Both engines have {{${name}}} and neither declares a different meaning for it.`,
      };
    }
    if (sameName?.op) {
      return {
        verdict: "collision",
        source,
        target: sameName,
        rewritten: null,
        candidates: familyCandidates(to, sameName.op),
        why:
          `${to} defines {{${name}}} as ${sameName.op}, and ${from} does not declare a matching `
          + "meaning, so it cannot be assumed to behave the same way.",
      };
    }
    return {
      verdict: "absent",
      source,
      target: null,
      rewritten: null,
      candidates: [],
      why: `${to} has no macro named "${name}".`,
    };
  }

  // The source declares an operation: find whoever on the target performs the same one.
  const target = entriesOf(to).find((entry) => entry.op === source.op) ?? null;
  if (target) {
    return {
      verdict: "portable",
      source,
      target,
      rewritten: renderToken(target.macro, args),
      candidates: [],
      why: `Both engines perform ${source.op}; ${to} spells it ${target.macro}.`,
    };
  }

  // Nobody on the target performs it. If the same NAME exists there, it means something else.
  const candidates = familyCandidates(to, source.op);
  if (sameName) {
    return {
      verdict: "collision",
      source,
      target: sameName,
      rewritten: null,
      candidates,
      why:
        `${from} uses {{${name}}} for ${source.op}, but ${to} has no macro for that operation and `
        + `its own {{${name}}} does something else. Leaving it unchanged would silently alter the prompt.`,
    };
  }
  return {
    verdict: "absent",
    source,
    target: null,
    rewritten: null,
    candidates,
    why: `${to} has no macro for ${source.op}.`,
  };
}

/**
 * Names that several engines share while spelling their arguments differently, and where at least
 * one side has NOT declared an op. These are the annotations still owed: a shared name with
 * divergent shape and no declared meaning is exactly where a silent mistranslation hides.
 */
export function unannotatedDivergence(): { name: string; engines: string[] }[] {
  const byName = new Map<string, { engine: PresetWriteForProfile; entry: MacroEntry }[]>();
  for (const engine of PRESET_WRITE_FOR_PROFILES) {
    if (engine === "full") continue; // an alias lens for RoleCall's dialect, not a separate engine
    for (const entry of entriesOf(engine)) {
      const name = macroName(entry.macro);
      if (!name) continue;
      const list = byName.get(name) ?? [];
      if (!list.some((row) => row.engine === engine)) list.push({ engine, entry });
      byName.set(name, list);
    }
  }

  const owed: { name: string; engines: string[] }[] = [];
  for (const [name, rows] of byName) {
    if (rows.length < 2) continue;
    const shapes = new Set(rows.map((row) => `${arityOf(row.entry.macro)}/${row.entry.macro.includes("::")}`));
    if (shapes.size === 1) continue; // they agree; the name is enough
    if (rows.every((row) => row.entry.op)) continue; // fully declared
    owed.push({ name, engines: rows.map((row) => row.engine) });
  }
  return owed.sort((a, b) => a.name.localeCompare(b.name));
}
