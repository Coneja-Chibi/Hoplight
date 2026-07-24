/**
 * Pure decisions about MOVING between versions (distinct from reading history, which is version-history.ts):
 * which direction a switch goes, and whether it crosses a release that changed how the studio is stored.
 * All comparisons via compareVersions (bare "0.1.8" vs tag "v0.1.8"). Reused by the switch route + the
 * rollback-safety gate.
 */
import { compareVersions } from "./update-check";

/**
 * Versions that changed how the studio is stored on disk. A rollback that crosses one of these means an
 * older app meeting newer data, the silent-data-loss trap, so it routes through the backup+preview gate.
 * EMPTY today (CANONICAL_SCHEMA_VERSION has never moved); the storage-shape tripwire test forces a new
 * entry here whenever the on-disk shape changes, so this list can never silently fall behind.
 */
export const SCHEMA_BUMPS: readonly string[] = [];

/**
 * The first release that carries the Updates feature itself. A rollback to a version BELOW this cannot
 * show a post-restart confirmation or an Undo (that old code has neither), so the confirm screen becomes
 * the receipt. This ships in v0.1.12 (one patch above the current v0.1.11 release, via the auto-release
 * train), so every existing release is correctly treated as pre-feature.
 */
export const UPDATES_FEATURE_MIN_VERSION: string = "v0.1.12";

/** True if a version has the Updates feature, so a switch INTO it will show the post-restart popup. */
export function isFeatureAware(version: string): boolean {
  return UPDATES_FEATURE_MIN_VERSION !== "" && compareVersions(version, UPDATES_FEATURE_MIN_VERSION) >= 0;
}

/** Which way a switch goes. "current" (same version, either spelling) is refused by the route upstream. */
export function switchKind(installed: string, target: string): "update" | "rollback" | "current" {
  const cmp = compareVersions(target, installed);
  if (cmp === 0) return "current";
  return cmp > 0 ? "update" : "rollback";
}

/**
 * Does moving between two versions cross a storage-changing release? A bump `b` is crossed iff
 * min(from,to) < b <= max(from,to): rolling back FROM the bump release counts (you leave its schema),
 * rolling back TO it does not (it reads its own schema). Fires on forward crossings too; policy is to warn
 * only on backward moves, but every backward move (including an Undo) is classified here, one code path.
 */
export function classifyDataChange(from: string, to: string, bumps: readonly string[] = SCHEMA_BUMPS): boolean {
  const lo = compareVersions(from, to) <= 0 ? from : to;
  const hi = compareVersions(from, to) <= 0 ? to : from;
  return bumps.some((b) => compareVersions(lo, b) < 0 && compareVersions(b, hi) <= 0);
}
