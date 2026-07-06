/**
 * Shell store pure helpers - the Workbench recents map's parse + merge (functional core for
 * shell/store.ts). No DOM, no fetch, no zustand: unit-tested directly.
 */

/** "kind:id" composite key, the one spelling shared by the store and the tab strip. */
export const keyOf = (id: string, kind: string): string => `${kind}:${id}`;

/** Fail-closed reader: only "key" -> finite-number pairs survive an untrusted persisted blob. */
export function parseRecents(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** Stamp the given keys as opened at `now`, pruned to the newest `cap` entries (bounded map). */
export function bumpRecents(
  existing: Record<string, number>,
  keys: string[],
  now: number,
  cap: number,
): Record<string, number> {
  const merged = { ...existing };
  for (const k of keys) merged[k] = now;
  const kept = Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap);
  return Object.fromEntries(kept);
}
