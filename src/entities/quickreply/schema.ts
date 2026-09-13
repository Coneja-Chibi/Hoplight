/** Canonical quick-reply set - a page of named buttons that send or run prepared text. */
import type { CanonicalEntity } from "../../core/canonical";

/**
 * CanonicalQuickReplySet - SillyTavern's QuickReply sets, as a piece.
 *
 * WHY A KIND. A preset that leans on slash-command buttons is HALF a preset without them: the
 * author ships both, the platform stores them as separate files, and a person who exports one from
 * the Press and not the other gets a rig that quietly does less than it did at home. Being a piece
 * is what lets a preset LINK one (PresetBody.quickReplyRefs) so the Press can print them together -
 * the same shape as character->lorebook and preset->regex.
 *
 * THE CANONICAL MODEL IS THE USEFUL SUBSET, the wire is escrowed whole. ST's QuickReplySetLink
 * grammar carries a dozen per-button switches (auto-execute hooks, context menus, icons); those
 * ride `extras` per reply and `original` on the envelope untouched, because Hoplight edits the
 * label and the message - the parts a person actually authors - and must never invent opinions
 * about fields it does not model. Same lossless-escrow doctrine as the regex kind.
 *
 * A REPLY'S MESSAGE IS DATA. It is usually a slash-command script, and nothing in this repo ever
 * executes it - the same scripts-as-data rule every entity here lives under.
 *
 * Stored under studio/quickreply/<id>.json, the same hub-spoke shape as its siblings.
 */

/** One button: what it says, and what it sends. */
export interface QuickReply {
  /** Stable per-row id, minted at import when the wire has none. */
  id: string;
  /** The button's label; ST allows "" (icon-only buttons), so empty is legal here too. */
  label: string;
  /** What pressing it sends - usually a slash-command script. Data, never executed here. */
  message: string;
  /** Hover text, when the wire carries one. */
  title?: string;
  /** Row disabled on the platform (ST `isHidden`); kept so a toggle round-trips. */
  hidden?: boolean;
  /** Unmodelled wire fields for this row, re-merged on export without semantic loss. */
  extras?: Record<string, unknown>;
}

export interface QuickReplyBody {
  /** What the set is called; ST names sets, and the Library titles from the body like every kind. */
  name: string;
  replies: QuickReply[];
  /** Set-level wire fields the canonical model does not first-class (disableSend, color, ...). */
  extras?: Record<string, unknown>;
  /** The author's own notes, same shape every other entity uses. */
  notes?: string;
}

export type CanonicalQuickReplySet = CanonicalEntity<"quickreply", QuickReplyBody>;

/** A new, empty set. */
export const emptyQuickReplyBody = (name: string): QuickReplyBody => ({ name, replies: [] });
