/**
 * Derived activation mode for the Keys tri-mode control (Keywords / Always on / By meaning)
 * plus live plain-language summary lines for the masthead and Timing fold.
 */
import type { LorebookEntry } from "../../../../entities/lorebook/schema";

export type EntryFireMode = "keyed" | "always" | "meaning";

export function entryFireMode(entry: LorebookEntry): EntryFireMode {
  if (entry.constant) return "always";
  if (entry.vectorized) return "meaning";
  return "keyed";
}

export function fireModePatch(mode: EntryFireMode): Partial<LorebookEntry> {
  if (mode === "always") return { constant: true, vectorized: false };
  if (mode === "meaning") return { constant: false, vectorized: true };
  return { constant: false, vectorized: false };
}

/** Masthead voice line: honest computed sentence, never a stored field. */
export function firesLine(entry: LorebookEntry): string {
  if (entry.constant) return "Always on - it speaks in every scene.";
  if (entry.vectorized) return "By meaning - it fires when the chat is similar, not on exact keys.";
  const words = entry.triggers.map((t) => t.keyword).filter(Boolean);
  if (words.length === 0) return "No keys yet - it never fires.";
  const shown = words.slice(0, 5).join(", ");
  return `Fires on: ${shown}${words.length > 5 ? ` and ${words.length - 5} more` : ""}.`;
}

/**
 * Live Timing & chance status. Recomputes from the entry on every patch so sticky / cool /
 * delay / chance / recursion / group always show what is actually set.
 */
export function timingLine(entry: LorebookEntry): string {
  const parts: string[] = [];

  if (entry.probability <= 0) {
    parts.push("0% chance (never fires)");
  } else if (entry.probability < 100) {
    parts.push(`${entry.probability}% chance`);
  }

  if (entry.sticky > 0) {
    parts.push(`sticks for ${entry.sticky} message${entry.sticky === 1 ? "" : "s"}`);
  }
  if (entry.cooldown > 0) {
    parts.push(`cooldown ${entry.cooldown} message${entry.cooldown === 1 ? "" : "s"}`);
  }
  if (entry.delay > 0) {
    parts.push(`waits ${entry.delay} message${entry.delay === 1 ? "" : "s"} first`);
  }

  if (entry.preventRecursion) parts.push("never wakes others");
  if (entry.excludeRecursion) parts.push("cannot be woken by recursion");
  if (entry.delayUntilRecursion > 0) {
    parts.push(`only from recursion level ${entry.delayUntilRecursion}`);
  }

  if (entry.groupName?.trim()) parts.push(`group "${entry.groupName.trim()}"`);
  if (entry.ignoreBudget) parts.push("always kept past the budget");

  if (parts.length === 0) {
    return "Fires every time keys match. No chance roll, stickiness, cooldown, or delay.";
  }
  return parts.join(" · ") + ".";
}
