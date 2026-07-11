/**
 * Derived activation mode for the Keys tri-mode control (Keywords / Always on / By meaning).
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

/** Masthead italic line: honest computed sentence, never a stored field. */
export function firesLine(entry: LorebookEntry): string {
  if (entry.constant) return "Always on - it speaks in every scene.";
  if (entry.vectorized) return "By meaning - it fires when the chat is similar, not on exact keys.";
  const words = entry.triggers.map((t) => t.keyword).filter(Boolean);
  if (words.length === 0) return "No keys yet - it never fires.";
  const shown = words.slice(0, 5).join(", ");
  return `Fires on: ${shown}${words.length > 5 ? ` and ${words.length - 5} more` : ""}.`;
}

/** Timing fold summary of what it currently hides. */
export function timingLine(entry: LorebookEntry): string {
  const parts: string[] = [];
  if (entry.sticky > 0) parts.push(`sticks for ${entry.sticky}`);
  if (entry.cooldown > 0) parts.push(`cools down ${entry.cooldown}`);
  if (entry.delay > 0) parts.push(`waits ${entry.delay} messages`);
  if (entry.preventRecursion) parts.push("never triggers others");
  if (entry.delayUntilRecursion > 0) parts.push(`waits for recursion ${entry.delayUntilRecursion}`);
  if (entry.groupName) parts.push(`in group "${entry.groupName}"`);
  if (parts.length === 0) {
    return "Fires every time, immediately. Open to add stickiness, cooldowns, or recursion rules.";
  }
  return `Currently: ${parts.join(" · ")}.`;
}
