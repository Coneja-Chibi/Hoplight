/**
 * The block graveyard - the pure shape, parser and edits (the fs store lives in graveyard.ts).
 *
 * WHY IT EXISTS. Deleting a block out of a preset is the only way to get it out of the way, and it
 * is irreversible: the block is gone from the file and there is nowhere else it lives. So blocks
 * that are plainly not wanted stay in presets anyway, because deleting them means losing writing
 * somebody spent real time on. A graveyard is the missing third option - out of the preset, still
 * yours.
 *
 * THE WHOLE BLOCK IS BURIED, verbatim, not a summary of it. A grave that held a block's NAME and a
 * note about what it did would be a memorial, not a backup: the point is to be able to put it back.
 * The stored block keeps its own id, so restoring it into the preset it came from restores the
 * thing that was there rather than a copy with a new identity.
 *
 * CORDONED, and that is what the separate file is for. A grave is not a piece: it has no deck, it
 * is never listed among presets, and nothing resolves `@` to it. It is a drawer, and drawers are
 * not shelves.
 */
import type { PresetPrompt } from "../entities/preset/schema";

/** One buried block, with enough around it to know where it came from and put it back. */
export interface Grave {
  /** This grave's own id. NOT the block's - two copies of one block may be buried separately. */
  readonly id: string;
  /** The block, exactly as it was. */
  readonly block: PresetPrompt;
  /** Where it was dug out of, so a restore knows where "back" is. */
  readonly from: { readonly presetId: string; readonly presetName: string };
  /** Epoch ms. A graveyard is chronological: the most recent burial is the one being undone. */
  readonly at: number;
  /** Whatever the person or the agent said about why. Optional, and often the useful part. */
  readonly note?: string;
}

export interface GraveyardFile {
  readonly graves: readonly Grave[];
}

export const EMPTY_GRAVEYARD: GraveyardFile = { graves: [] };

/**
 * How many burials are kept.
 *
 * A CAP RATHER THAN FOREVER, because this file is read whole and a block is a wall of prose - a
 * thousand graves is a multi-megabyte read on every listing. Old ones fall off the end, oldest
 * first, which is the only order that keeps what somebody is most likely to reach for.
 */
export const MAX_GRAVES = 200;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A block, checked to the depth that matters.
 *
 * The four fields a restore cannot do without: an id to put back under, a name to recognise it by,
 * the content itself, and the role it played. Everything else on a prompt has a sane default at the
 * far end, but a grave missing its content is an empty box with a label.
 */
function parseBlock(raw: unknown): PresetPrompt | null {
  if (!isRecord(raw)) return null;
  const { id, name, content, role } = raw;
  if (typeof id !== "string" || id === "") return null;
  if (typeof name !== "string") return null;
  if (typeof content !== "string") return null;
  if (role !== "system" && role !== "user" && role !== "assistant" && role !== "tool") return null;
  return raw as unknown as PresetPrompt;
}

function parseGrave(raw: unknown): Grave | null {
  if (!isRecord(raw)) return null;
  const block = parseBlock(raw["block"]);
  if (!block) return null;
  const id = raw["id"];
  const at = raw["at"];
  const from = isRecord(raw["from"]) ? raw["from"] : null;
  if (typeof id !== "string" || id === "") return null;
  if (typeof at !== "number" || !Number.isFinite(at)) return null;
  const presetId = from?.["presetId"];
  const presetName = from?.["presetName"];
  const note = raw["note"];
  return {
    id,
    block,
    at,
    from: {
      presetId: typeof presetId === "string" ? presetId : "",
      // An unknown origin is honest; refusing the grave over it would lose the block.
      presetName: typeof presetName === "string" ? presetName : "",
    },
    ...(typeof note === "string" && note ? { note } : {}),
  };
}

/**
 * Tolerant, fail-closed reader: anything malformed reads as absent, never throws.
 *
 * PER GRAVE, the same rule parseSettings and parseCollections follow. One unreadable burial must
 * not cost somebody the other hundred - this file is the only copy of everything in it.
 */
export function parseGraveyard(raw: unknown): GraveyardFile {
  const list = isRecord(raw) && Array.isArray(raw["graves"]) ? raw["graves"] : [];
  const graves: Grave[] = [];
  for (const entry of list) {
    const grave = parseGrave(entry);
    if (grave && !graves.some((held) => held.id === grave.id)) graves.push(grave);
  }
  return { graves };
}

/** Newest first, which is the order a graveyard is actually read in. */
export const gravesNewestFirst = (file: GraveyardFile): readonly Grave[] =>
  [...file.graves].sort((a, b) => b.at - a.at);

export function bury(
  file: GraveyardFile,
  grave: Grave,
): GraveyardFile {
  /**
   * BURYING THE SAME BLOCK TWICE IS TWO GRAVES, deliberately. The same block id can exist in two
   * presets with different content, and collapsing them would silently discard one person's edit
   * because another preset happened to use the same identifier.
   */
  const graves = [...file.graves, grave];
  // Oldest fall off the end; the cap is on the file, not on any one preset's burials.
  return { graves: graves.slice(-MAX_GRAVES) };
}

/** Take one out. Restoring reads it first, then removes it; forgetting just removes it. */
export function exhume(file: GraveyardFile, id: string): GraveyardFile {
  return { graves: file.graves.filter((g) => g.id !== id) };
}

/** One grave by id, for a restore that needs the block back. */
export const graveById = (file: GraveyardFile, id: string): Grave | null =>
  file.graves.find((g) => g.id === id) ?? null;
