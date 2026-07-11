/**
 * Turn import heal notes into Health findings (worth-a-look, book-level).
 */
import type { LoreFinding } from "./inspect";
import type { HealNote } from "./heal";

export function findingsFromHealNotes(notes: readonly HealNote[]): LoreFinding[] {
  return notes.map((n) => ({
    rule: "legacy-leftovers" as const,
    severity: "worth-a-look" as const,
    message: n.path ? `Import heal (${n.path}): ${n.message}` : `Import heal: ${n.message}`,
  }));
}

/** Read heal notes from entity original bag (vaud-studio unmapped). */
export function healNotesFromOriginal(original: unknown): HealNote[] {
  if (!original || typeof original !== "object" || Array.isArray(original)) return [];
  const o = original as Record<string, unknown>;
  const studio = o["vaud-studio"];
  if (!studio || typeof studio !== "object" || Array.isArray(studio)) return [];
  const unmapped = (studio as { unmapped?: unknown }).unmapped;
  if (!unmapped || typeof unmapped !== "object" || Array.isArray(unmapped)) return [];
  const raw = (unmapped as { healNotes?: unknown }).healNotes;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n): n is { path?: unknown; message?: unknown } => !!n && typeof n === "object")
    .map((n) => ({
      path: typeof n.path === "string" ? n.path : "",
      message: typeof n.message === "string" ? n.message : "healed field",
    }))
    .filter((n) => n.message.length > 0);
}
