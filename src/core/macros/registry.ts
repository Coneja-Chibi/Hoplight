/**
 * The closed macro registry (ADR-012 decision 5).
 *
 * There is no runtime registration API on purpose: the registry is built once from the handler
 * catalog and frozen. "Closed-world" is the whole security argument - the evaluator can only ever
 * run code Hoplight shipped, selected by name from this table, and an unlisted name degrades to
 * literal text at the evaluator. The data-only constraint (no fs/net/process/timer/dynamic code
 * in any handler) is enforced by a test that scans the ENTIRE package source, comments stripped,
 * not just each handler's own function body - a helper a handler calls is inside the net too.
 */
import type { MacroDefinition } from "./types";
import { HANDLERS } from "./handlers";
import { CONTEXT_HANDLERS } from "./handlers-context";

const ALL_HANDLERS: readonly MacroDefinition[] = [...HANDLERS, ...CONTEXT_HANDLERS];

const byName = new Map<string, MacroDefinition>();
for (const def of ALL_HANDLERS) {
  byName.set(def.name.toLowerCase(), def);
  for (const alias of def.aliases ?? []) byName.set(alias.toLowerCase(), def);
}

export const getMacro = (nameOrAlias: string): MacroDefinition | undefined =>
  byName.get(nameOrAlias.toLowerCase());

export const hasMacro = (nameOrAlias: string): boolean => byName.has(nameOrAlias.toLowerCase());

export const isVolatileMacro = (nameOrAlias: string): boolean =>
  getMacro(nameOrAlias)?.volatile === true;

/** Every registered definition, deduplicated (for docs and the data-only registry test). */
export const getAllMacros = (): readonly MacroDefinition[] => ALL_HANDLERS;
