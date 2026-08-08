/**
 * Putting the unreadable-files notice away, without putting away the next one.
 *
 * A DISMISSAL IS ABOUT THESE FILES, NOT ABOUT THE NOTICE. "Never show this again" would be the easy
 * build and the wrong one: the banner is the only place Hoplight ever says a file in somebody's
 * studio did not load, so a permanent off switch means the next unreadable preset arrives in
 * silence and the deck is quietly short by one. What is remembered is WHICH files were waved away,
 * so a new one - or an old one failing for a new reason - brings the notice straight back.
 *
 * FEWER PROBLEMS NEVER RE-NAGS. Dismiss two, fix one, and the remaining one stays dismissed: it is
 * the same file somebody already said they knew about. Only something not on the list can reopen it.
 */
import type { StudioDamagedEntry } from "../../app-contract";

/** Namespaced by app id, the same rule every other Library preference follows. */
export const PREF_DAMAGE_SEEN = "library.damageSeen";

/**
 * One file's failure, identified by WHAT and WHY.
 *
 * The reason is part of it deliberately. A file that stops being "not readable JSON" and starts
 * being "holds a different piece id than its filename" is a different problem with different advice,
 * and hiding the new one under the old dismissal would be the silence this whole thing guards.
 */
const keyOf = (entry: StudioDamagedEntry): string => `${entry.kind}/${entry.id}:${entry.reason}`;

/** What to store when somebody dismisses. Sorted so the stored value does not churn on re-reads. */
export function damageSeenList(entries: readonly StudioDamagedEntry[]): string[] {
  return [...new Set(entries.map(keyOf))].sort();
}

/** The stored preference, read defensively: anything else on that key is treated as nothing seen. */
const seenSet = (stored: unknown): ReadonlySet<string> =>
  new Set(Array.isArray(stored) ? stored.filter((v): v is string => typeof v === "string") : []);

/**
 * Should the notice stay down?
 *
 * Only when every file it would name has already been waved away. One unknown file shows the whole
 * notice again, which is right: the count in the heading is the honest number of files that did not
 * load, not the number of new ones.
 */
export function damageHidden(
  entries: readonly StudioDamagedEntry[],
  stored: unknown,
): boolean {
  if (entries.length === 0) return true;
  const seen = seenSet(stored);
  return entries.every((entry) => seen.has(keyOf(entry)));
}
