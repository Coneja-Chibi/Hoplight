/**
 * CanonicalPack - a reusable expression / sprite pack as a first-class studio entity.
 * Same wrapper pattern as character/lorebook/persona: body is the authored content;
 * stored under studio/pack/<id>.json. Open in the Workbench as a pack "folder".
 */
import type { CanonicalEntity } from "../../core/canonical";
import type { SpritePackValue } from "../../core/media";

export interface PackBody {
  /** Library / tab name */
  name: string;
  /** Short blurb on the shelf card (never host wire) */
  brief?: string;
  /** The emotion pack (label -> image). Hub shape shared with character media. */
  pack: SpritePackValue;
  /** Optional multi-character groups (Lumi-style); flat pack is the default group. */
  groups?: Record<string, SpritePackValue>;
}

export type CanonicalPack = CanonicalEntity<"pack", PackBody>;

/** Empty pack entity body for a new library pack. */
export function emptyPackBody(name = "Untitled pack"): PackBody {
  return {
    name,
    pack: { items: [] },
  };
}
