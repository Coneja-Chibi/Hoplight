/**
 * Pure mappers for the entry drawer's structured extras (functional core, tested):
 * character filter inputs <-> CharacterFilter | null, side-effect rows <-> EntrySideEffects | null,
 * and the contextConfig patch that never leaves empty keys on the wire.
 */
import type {
  CharacterFilter,
  EntryContextConfig,
  EntrySideEffect,
  EntrySideEffects,
  SideEffectType,
} from "../../../../entities/lorebook/schema";

export const parseCsv = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const joinCsv = (list: readonly string[]): string => list.join(", ");

export type FilterMode = "off" | "include" | "exclude";

/** Empty names+tags collapse to null (no filter) regardless of mode; mode "off" always nulls. */
export function filterFromInputs(mode: FilterMode, namesRaw: string, tagsRaw: string): CharacterFilter | null {
  if (mode === "off") return null;
  const names = parseCsv(namesRaw);
  const tags = parseCsv(tagsRaw);
  if (names.length === 0 && tags.length === 0) return null;
  return { names, tags, isExclude: mode === "exclude" };
}

export function filterMode(filter: CharacterFilter | null): FilterMode {
  if (!filter) return "off";
  return filter.isExclude ? "exclude" : "include";
}

const SIDE_EFFECT_TYPES: readonly SideEffectType[] = ["setvar", "addvar", "incvar", "decvar", "delvar"];

const isSideEffectType = (v: unknown): v is SideEffectType =>
  typeof v === "string" && (SIDE_EFFECT_TYPES as readonly string[]).includes(v);

/** ListEditor rows -> canonical side effects; no rows collapses the whole block to null. */
export function sideEffectsFromRows(
  rows: readonly Record<string, unknown>[],
  onlyOnFirstTrigger: boolean,
  clearOnDeactivate: boolean,
): EntrySideEffects | null {
  const effects: EntrySideEffect[] = rows
    .filter((r) => typeof r.variable === "string" && (r.variable as string).trim() !== "")
    .map((r) => {
      const type = isSideEffectType(r.type) ? r.type : "setvar";
      const out: EntrySideEffect = {
        type,
        variable: (r.variable as string).trim(),
        scope: r.scope === "global" ? "global" : "local",
      };
      if (type === "setvar" && typeof r.value === "string") out.value = r.value;
      if (type !== "setvar" && type !== "delvar" && typeof r.amount === "number") out.amount = r.amount;
      return out;
    });
  if (effects.length === 0) return null;
  return { effects, onlyOnFirstTrigger, clearOnDeactivate };
}

export function rowsFromSideEffects(se: EntrySideEffects | null): Record<string, unknown>[] {
  if (!se) return [];
  return se.effects.map((e) => ({
    type: e.type,
    variable: e.variable,
    value: e.value ?? "",
    amount: e.amount,
    scope: e.scope,
  }));
}

/** Patch contextConfig dropping empty-string/undefined keys; an all-empty config becomes undefined. */
export function patchContextConfig(
  current: EntryContextConfig | undefined,
  patch: Partial<EntryContextConfig>,
): EntryContextConfig | undefined {
  const merged: Record<string, unknown> = { ...current, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "") delete merged[k];
  }
  return Object.keys(merged).length > 0 ? (merged as EntryContextConfig) : undefined;
}
