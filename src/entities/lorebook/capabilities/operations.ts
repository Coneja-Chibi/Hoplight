/**
 * Pure lorebook body mutations shared by the Workbench and semantic capability previews.
 */
import type { LorebookBody, LorebookEntry } from "../schema";

export type LorebookSettingsPatch = Partial<Pick<
  LorebookBody,
  | "name"
  | "description"
  | "tags"
  | "lorebookType"
  | "genre"
  | "fandom"
  | "globalCaseSensitive"
  | "globalMatchWholeWords"
  | "globalScanDepth"
  | "globalRecursion"
  | "tokenBudget"
  | "budgetMode"
  | "entryBudget"
>>;

export function updateLorebookSettings(
  body: LorebookBody,
  patch: LorebookSettingsPatch,
): LorebookBody {
  if (Object.keys(patch).length === 0) return body;
  return { ...body, ...patch };
}

export function updateLorebookEntry(
  body: LorebookBody,
  id: string,
  patch: Partial<LorebookEntry>,
): LorebookBody {
  const index = body.entries.findIndex((entry) => entry.id === id);
  if (index < 0) return body;
  const entries = [...body.entries];
  entries[index] = { ...entries[index]!, ...patch, id };
  return { ...body, entries };
}

export function reorderLorebookEntry(
  body: LorebookBody,
  id: string,
  toIndex: number,
): LorebookBody {
  const from = body.entries.findIndex((entry) => entry.id === id);
  if (from < 0) return body;
  const entries = [...body.entries];
  const [entry] = entries.splice(from, 1);
  const clamped = Math.max(0, Math.min(toIndex, entries.length));
  entries.splice(clamped, 0, entry!);
  return { ...body, entries };
}

export function setLorebookEntriesEnabled(
  body: LorebookBody,
  ids: readonly string[],
  enabled: boolean,
): LorebookBody {
  if (ids.length === 0) return body;
  const selected = new Set(ids);
  return {
    ...body,
    entries: body.entries.map((entry) =>
      selected.has(entry.id) ? { ...entry, enabled } : entry),
  };
}

export function removeLorebookEntries(
  body: LorebookBody,
  ids: readonly string[],
): LorebookBody {
  if (ids.length === 0) return body;
  const selected = new Set(ids);
  const entries = body.entries.filter((entry) => !selected.has(entry.id));
  return entries.length === body.entries.length ? body : { ...body, entries };
}
