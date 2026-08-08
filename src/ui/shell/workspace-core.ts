/**
 * What the bench looked like, so it can look like that again.
 *
 * SURVIVES THE SERVER, not just the page. sessionStorage would carry a reload and lose a restart;
 * localStorage would carry a restart and stay behind on one machine. This rides in the studio's own
 * settings record, the way the recents rail already does, so it survives the server being killed
 * and travels with the studio rather than with the browser that happened to open it.
 *
 * IT STORES REFERENCES, NEVER CONTENT. What is restored is which pieces were open and which one was
 * being edited - the pieces themselves are read from disk on the way back in. Snapshotting content
 * would make this a second copy of the studio that goes stale the moment anything else writes, and
 * restoring from it would quietly resurrect an old version of somebody's work.
 */

/** One open pane, by reference. */
export interface OpenRef {
  readonly kind: string;
  readonly id: string;
  /** Lorebooks can be open twice on different entries; the pane key carries which. */
  readonly focusEntry?: string;
}

export interface Workspace {
  readonly open: readonly OpenRef[];
  /** Pane key of the piece being edited, or "" when none was. */
  readonly activeKey: string;
  /** Pane key pinned in the second pane, or "" when the stage was single. */
  readonly splitKey: string;
  /** Which app was on the canvas. */
  readonly appId: string;
}

/** Bounded, so a session with a hundred tabs cannot bloat the settings file. */
const MAX_OPEN = 40;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Take a snapshot worth writing down. */
export function snapshotWorkspace(input: {
  readonly pieces: readonly { kind: string; id: string; params?: { focusEntry?: string } }[];
  readonly activeKey: string;
  readonly splitKey: string;
  readonly appId: string;
}): Workspace {
  return {
    open: input.pieces.slice(0, MAX_OPEN).map((p) => ({
      kind: p.kind,
      id: p.id,
      ...(p.params?.focusEntry ? { focusEntry: p.params.focusEntry } : {}),
    })),
    activeKey: input.activeKey,
    splitKey: input.splitKey,
    appId: input.appId,
  };
}

/**
 * Read a stored workspace, dropping anything that is not one.
 *
 * TOLERANT, because this record is written by one build and read by the next. A field that changed
 * shape between versions should cost somebody their tab layout, not their ability to start the app.
 */
export function readWorkspace(stored: unknown): Workspace | null {
  if (!isRecord(stored)) return null;
  const open = Array.isArray(stored["open"])
    ? stored["open"].filter(isRecord)
      .filter((r) => typeof r["kind"] === "string" && typeof r["id"] === "string")
      .slice(0, MAX_OPEN)
      .map((r) => ({
        kind: r["kind"] as string,
        id: r["id"] as string,
        ...(typeof r["focusEntry"] === "string" ? { focusEntry: r["focusEntry"] } : {}),
      }))
    : [];
  const str = (key: string): string => (typeof stored[key] === "string" ? stored[key] : "");
  return { open, activeKey: str("activeKey"), splitKey: str("splitKey"), appId: str("appId") };
}

/**
 * Which stored refs still exist in the studio.
 *
 * A PIECE DELETED SINCE IS DROPPED, not restored as an error tab. A conversation about restoring
 * state should not end with three tabs that cannot open, and the alternative - refusing the whole
 * restore because one piece is gone - throws away the nineteen that are fine.
 */
export function liveRefs<T extends { kind: string; id: string }>(
  workspace: Workspace,
  studio: readonly T[],
): T[] {
  const byKey = new Map(studio.map((p) => [`${p.kind}:${p.id}`, p]));
  return workspace.open
    .map((ref) => byKey.get(`${ref.kind}:${ref.id}`))
    .filter((p): p is T => p !== undefined);
}

/**
 * Has the bench actually changed since the last snapshot?
 *
 * Compared as text because the pieces are rebuilt objects on every store write, so identity says
 * nothing. Without this, every status-bar message would write the settings file.
 */
export function workspaceKey(w: Workspace): string {
  return [
    w.open.map((r) => `${r.kind}:${r.id}${r.focusEntry ? `@${r.focusEntry}` : ""}`).join(","),
    w.activeKey,
    w.splitKey,
    w.appId,
  ].join("|");
}
