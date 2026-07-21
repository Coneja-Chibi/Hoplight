/**
 * Piece identity keys - the one spelling of "which open piece is this" shared by the shell store,
 * the tab strip, and apps. Pure string builders with no store state, housed in _shared so apps
 * never have to reach into shell modules for them.
 */

/** "kind:id" composite key, the one spelling shared by the store and the tab strip. */
export const keyOf = (id: string, kind: string): string => `${kind}:${id}`;

/**
 * Pane identity: same as keyOf unless focusEntry is set, then kind:id@focusEntry so one lorebook
 * can sit beside itself on two entries. Dirty tracking still uses keyOf (entity-level).
 */
export const paneKey = (
  id: string,
  kind: string,
  focusEntry?: string | null,
): string => (focusEntry ? `${kind}:${id}@${focusEntry}` : keyOf(id, kind));

export const paneKeyOf = (p: {
  id: string;
  kind: string;
  params?: { focusEntry?: string };
}): string => paneKey(p.id, p.kind, p.params?.focusEntry);
