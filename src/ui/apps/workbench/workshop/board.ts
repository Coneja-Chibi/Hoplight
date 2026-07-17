/**
 * Pure board helpers for Workshop Test Bench + package honesty copy.
 * Sorting, empty-state copy, and export-loss wording live here so the view stays thin.
 */

export type BoardVar = { name: string; value: string };
export type BoardDelta = { name: string; before: string; after: string; moved: boolean };

/** Sort variable rows so names that moved in the last run float first (stable within each group). */
export function orderVarsMovedFirst(vars: readonly BoardVar[], movedNames: ReadonlySet<string>): BoardVar[] {
  const moved: BoardVar[] = [];
  const rest: BoardVar[] = [];
  for (const v of vars) {
    if (v.name && movedNames.has(v.name)) moved.push(v);
    else rest.push(v);
  }
  return [...moved, ...rest];
}

/** Delta pills: moved first, then unchanged. */
export function orderDeltaMovedFirst(delta: readonly BoardDelta[]): BoardDelta[] {
  return [...delta].sort((a, b) => Number(b.moved) - Number(a.moved));
}

/** Names that changed in a delta list. */
export const movedNameSet = (delta: readonly BoardDelta[]): Set<string> =>
  new Set(delta.filter((d) => d.moved && d.name).map((d) => d.name));

export const EMPTY_VARS_MESSAGE =
  "No variables yet. Use a starter, or add a name and value here. After Run, anything that moved floats to the top.";

/** Plain banner when a packaged module is present. */
export const PACKAGE_BANNER =
  "These parts came in the card package. They re-export fully only as Risu (.charx). " +
  "Other platforms keep the plain card fields and drop package scripts.";

/**
 * Honesty line when the card carries Risu-only behavior and the lens is not aiming at Risu.
 * Returns null when there is nothing to warn about.
 */
export function exportLossWarning(args: {
  hasBehavior: boolean;
  hasPackage: boolean;
  /** selected platform lens ids (empty = no lens filter / unknown) */
  targets: readonly string[];
}): string | null {
  if (!args.hasBehavior && !args.hasPackage) return null;
  const aimsRisu = args.targets.length === 0 || args.targets.includes("risu");
  if (aimsRisu) {
    if (args.hasPackage) {
      return "Package scripts and module rows stay with a Risu (.charx) save. Keep Risu selected to take the full package with you.";
    }
    return null;
  }
  if (args.hasPackage) {
    return "Your lens is not on Risu. Exporting to the selected platforms will keep plain card fields but drop the package (module scripts, module lore, module regex).";
  }
  return "Your lens is not on Risu. Trigger rules and card scripts may not travel to every selected platform. Prefer Risu (.charx) for a full behavior pack.";
}
