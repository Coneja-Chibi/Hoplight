/**
 * Turning "/rail paramnesia" into a followed preset.
 *
 * SEPARATE FROM THE HOOK because this is the only part that can fail in ways a person has to be told
 * about, and each failure has a different next move: there are no presets yet, nothing matched that
 * word, or several did and picking one for them would be a guess with a 50% chance of being the
 * wrong file. The hook only ever receives rows that are definitely a preset.
 */
import type { EntitySummary } from "../../bridge";
import { outlineOf, type OutlineRow } from "../../../core/preset/outline";
import type { PresetBody } from "../../../entities/preset";

/** The narrow seam the rail needs: list presets, read one body. Nothing else. */
export interface PresetSource {
  list(): Promise<EntitySummary[]>;
  read(id: string): Promise<PresetBody | undefined>;
}

export type OpenOutcome = { ok: true } | { ok: false; detail: string };

/** Match on id or display name, case-insensitively, anywhere in the string. */
const matches = (piece: { id: string; name: string }, needle: string): boolean =>
  piece.id.toLowerCase().includes(needle) || piece.name.toLowerCase().includes(needle);

export async function openRail(
  source: PresetSource | undefined,
  query: string,
  follow: (id: string, title: string, rows: readonly OutlineRow[]) => void,
): Promise<OpenOutcome> {
  if (!source) return { ok: false, detail: "The preset rail is unavailable in this build." };
  const presets = await source.list();
  if (presets.length === 0) {
    return { ok: false, detail: "There are no presets in the studio yet." };
  }

  const needle = query.trim().toLowerCase();
  // No argument with exactly one preset is not ambiguous, so it does not ask.
  const found = needle === ""
    ? (presets.length === 1 ? presets : [])
    : presets.filter((piece) => matches(piece, needle));

  if (found.length === 0) {
    const names = presets.map((piece) => piece.id).join(", ");
    return {
      ok: false,
      detail: needle === ""
        ? `Name one: ${names}`
        : `No preset matches "${query.trim()}". There is ${names}.`,
    };
  }
  if (found.length > 1) {
    // Never picks. Opening the wrong preset and editing it is worse than one more keystroke.
    return { ok: false, detail: `Several match: ${found.map((piece) => piece.id).join(", ")}` };
  }

  const piece = found[0]!;
  const body = await source.read(piece.id);
  if (!body) return { ok: false, detail: `${piece.id} could not be read.` };
  follow(piece.id, piece.name || piece.id, outlineOf(body));
  return { ok: true };
}
