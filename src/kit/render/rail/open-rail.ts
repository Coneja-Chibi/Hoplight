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
  /**
   * `content` is the block text, keyed by block id.
   *
   * Handed over here because this is where the body is already open. The rail needs it to seed the
   * rewrite editor with what is there, and reading the preset a second time to get it would be a
   * second answer to what the rail is showing.
   */
  follow: (
    id: string,
    title: string,
    rows: readonly OutlineRow[],
    content: ReadonlyMap<string, string>,
  ) => void,
): Promise<OpenOutcome> {
  if (!source) return { ok: false, detail: "The preset rail is unavailable in this build." };
  const presets = await source.list();
  if (presets.length === 0) {
    return { ok: false, detail: "There are no presets in the studio yet." };
  }

  const needle = query.trim().toLowerCase();
  /**
   * AN EXACT NAME WINS OUTRIGHT, and without this the shorter of two similar presets was
   * unreachable. `paramnesia` and `paramnesia-vi` both CONTAIN "paramnesia", so asking for the
   * short one by its exact name returned two matches and refused - and there was no longer string
   * to type, because the name was already complete. The refusal is meant to stop a guess between
   * two candidates; it is not a guess when somebody typed one of them exactly.
   */
  const exact = presets.filter(
    (piece) => piece.id.toLowerCase() === needle || piece.name.toLowerCase() === needle,
  );
  // No argument with exactly one preset is not ambiguous, so it does not ask.
  const found = needle === ""
    ? (presets.length === 1 ? presets : [])
    : exact.length === 1 ? exact : presets.filter((piece) => matches(piece, needle));

  /**
   * A list of ids in a sentence is the WORST way to offer a choice, and it used to be the only way:
   * the slash popup completed the command word and stopped, so somebody who submitted a bare `/rail`
   * got a comma-separated wall to read and retype from.
   *
   * The popup now completes the argument too, so these messages stop being the interaction and go
   * back to being what they should have been - a fallback that says where the real chooser is. The
   * ids are still listed, because somebody who got here deserves the answer rather than a redirect.
   */
  const pickHint = "Type /rail then a space to pick one from a list.";
  if (found.length === 0) {
    const names = presets.map((piece) => piece.id).join(", ");
    return {
      ok: false,
      detail: needle === ""
        ? `${pickHint}\n\nThere is ${names}.`
        : `No preset matches "${query.trim()}". ${pickHint}\n\nThere is ${names}.`,
    };
  }
  if (found.length > 1) {
    // Never picks. Opening the wrong preset and editing it is worse than one more keystroke.
    return {
      ok: false,
      detail: `Several match: ${found.map((piece) => piece.id).join(", ")}. ${pickHint}`,
    };
  }

  const piece = found[0]!;
  const body = await source.read(piece.id);
  if (!body) return { ok: false, detail: `${piece.id} could not be read.` };
  const content = new Map<string, string>(
    (body.prompts ?? []).map((prompt) => [prompt.id, prompt.content ?? ""]),
  );
  follow(piece.id, piece.name || piece.id, outlineOf(body), content);
  return { ok: true };
}
