/**
 * Resolve the fields the editor shows for a set of selected platforms. Walk each selected platform's
 * declared fields in order, turn a common id into its catalog definition and keep own fields inline,
 * and DEDUPE by id across platforms (first occurrence wins) so a shared field like name shows exactly
 * once. Pure - the caller supplies the catalog and the selection - so it is unit-tested directly and
 * the editor is just a view over the result.
 */
import type { FieldModule } from "../fields";
import type { FieldRef, Platform, ResolvedField } from "./types";

/** A common id with no catalog entry resolves to null (a typo should surface as a visible gap in dev,
 * never silently render an editor bound to nothing). Own fields always resolve to themselves. */
const resolveRef = (ref: FieldRef, catalog: ReadonlyMap<string, FieldModule>): ResolvedField | null => {
  if (typeof ref === "string") {
    const module = catalog.get(ref);
    return module ? { source: "common", id: ref, module } : null;
  }
  return { source: "own", id: ref.id, field: ref };
};

/**
 * The ordered, deduped list of fields to render for the selected platforms. Order follows the platform
 * registry order, then each platform's declared field order; the first platform to introduce a field
 * owns its position. An empty selection yields an empty list (the editor shows the platform-agnostic
 * baseline elsewhere).
 */
export function resolvePlatformFields(
  platforms: readonly Platform[],
  selectedKeys: readonly string[],
  catalogById: ReadonlyMap<string, FieldModule>,
): ResolvedField[] {
  const selected = new Set(selectedKeys);
  const seen = new Set<string>();
  const out: ResolvedField[] = [];
  for (const platform of platforms) {
    if (!selected.has(platform.key)) continue;
    for (const ref of platform.fields) {
      const resolved = resolveRef(ref, catalogById);
      if (!resolved || seen.has(resolved.id)) continue;
      seen.add(resolved.id);
      out.push(resolved);
    }
  }
  return out;
}
