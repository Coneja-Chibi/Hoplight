/**
 * Turning a word somebody typed into exactly one preset, or a reason why not.
 *
 * ONE MATCHER, because there are now three doors onto the same act - `rail_open` from the model,
 * `/rail` from the terminal, and `/rail` from the desktop window - and three matchers would mean
 * "paramnesia" could open different presets depending on which one you came through. That is the
 * duplicated-authority bug this repository keeps paying for, in the one place where the cost is
 * rearranging the wrong file.
 *
 * IT REFUSES TO GUESS. Two presets matching one word is a question, not a coin toss.
 */
import type { EntitySummary } from "../../bridge";

export type PresetPick =
  | { readonly ok: true; readonly piece: EntitySummary }
  | { readonly ok: false; readonly detail: string };

export function findPreset(presets: readonly EntitySummary[], query: string): PresetPick {
  if (presets.length === 0) {
    return { ok: false, detail: "There are no presets in the studio." };
  }
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return { ok: false, detail: "Name a preset to open." };
  }

  /**
   * AN EXACT NAME WINS OUTRIGHT. Without this the shorter of two similar presets is unreachable:
   * "paramnesia" is contained in "paramnesia-vi", so the exact short name matched both and was
   * refused - with no longer string available to disambiguate, because it was already complete.
   */
  const exact = presets.filter(
    (piece) => piece.id.toLowerCase() === needle || piece.name.toLowerCase() === needle,
  );
  const found = exact.length === 1 ? exact : presets.filter(
    (piece) => piece.id.toLowerCase().includes(needle) || piece.name.toLowerCase().includes(needle),
  );

  if (found.length === 0) {
    return {
      ok: false,
      detail: `No preset matches "${query}". There is: ${presets.map((p) => p.id).join(", ")}`,
    };
  }
  if (found.length > 1) {
    return {
      ok: false,
      detail: `Several match: ${found.map((p) => p.id).join(", ")}. Ask which one; do not pick.`,
    };
  }
  return { ok: true, piece: found[0]! };
}
