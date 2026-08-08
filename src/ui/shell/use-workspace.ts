/**
 * Remembering the bench across a restart, and putting it back.
 *
 * TWO HALVES THAT MUST NOT FIGHT. The snapshot writes whenever the bench changes; the restore runs
 * once at boot. Without the guard below they chase each other: restore opens the pieces, opening
 * them changes the bench, the change writes a snapshot, and a half-restored bench overwrites the
 * record that was still being read from.
 *
 * RESTORING IS ONE STORE WRITE, never a loop of send() calls: each of those fires the follow
 * prompt, stamps recents, and triggers a snapshot - so putting twenty tabs back would ask twenty
 * questions and overwrite the record it was still reading from halfway through.
 *
 * THE SETTING IS CHECKED IN BOTH DIRECTIONS. Off means nothing is written and nothing is restored,
 * so turning it on does not silently reopen a bench from whenever it was last on.
 */
import { useEffect, useRef } from "react";
import { useShellStore } from "./store";
import { paneKeyOf } from "./store-core";
import { liveRefs, readWorkspace, snapshotWorkspace, workspaceKey } from "./workspace-core";
import type { StudioEntitySummary } from "../app-contract";

/** Same key the Settings toggle writes. */
export const RESTORE_PREF = "workbench.restoreSession";
const WORKSPACE_KEY = "workbench.workspace";

/** Write the bench down whenever it changes, so a kill loses nothing. */
export function useRememberWorkspace(): void {
  const settings = useShellStore((s) => s.settings);
  const openPieces = useShellStore((s) => s.openPieces);
  const activeKey = useShellStore((s) => s.activeKey);
  const splitKey = useShellStore((s) => s.splitKey);
  const activeAppId = useShellStore((s) => s.activeAppId);
  /** The last thing written, so an unchanged bench does not rewrite the settings file. */
  const written = useRef("");

  useEffect(() => {
    if (settings[RESTORE_PREF] !== true) return;
    const snap = snapshotWorkspace({
      pieces: openPieces,
      activeKey,
      splitKey,
      appId: activeAppId,
    });
    const key = workspaceKey(snap);
    /**
     * Compared by VALUE. The store rebuilds these arrays on every write - a status-bar message
     * included - so identity would have this writing the settings file continuously.
     */
    if (key === written.current) return;
    written.current = key;
    useShellStore.getState().patchSettings({ [WORKSPACE_KEY]: snap });
  }, [settings, openPieces, activeKey, splitKey, activeAppId]);
}

/**
 * Put the bench back, once, at boot.
 *
 * `studio` is the piece list the shell already fetched, so this costs no extra request - and it is
 * what lets a piece deleted since be dropped rather than restored as a tab that cannot open.
 */
export function restoreWorkspace(
  settings: Record<string, unknown>,
  studio: readonly StudioEntitySummary[],
): { pieces: StudioEntitySummary[]; activeKey: string; splitKey: string; appId: string } | null {
  if (settings[RESTORE_PREF] !== true) return null;
  const stored = readWorkspace(settings[WORKSPACE_KEY]);
  if (!stored || stored.open.length === 0) return null;

  const pieces = liveRefs(stored, studio).map((p, at) => {
    const ref = stored.open[at];
    // The entry a lorebook was open on is part of its pane identity, not decoration.
    return ref?.focusEntry ? { ...p, params: { focusEntry: ref.focusEntry } } : p;
  });
  if (pieces.length === 0) return null;

  /**
   * A REMEMBERED ACTIVE PIECE THAT IS GONE FALLS BACK to the first surviving one rather than to
   * nothing. Restoring four tabs and focusing none of them looks like the restore half-failed.
   */
  const keys = new Set(pieces.map(paneKeyOf));
  const activeKey = keys.has(stored.activeKey) ? stored.activeKey : paneKeyOf(pieces[0]!);
  const splitKey = keys.has(stored.splitKey) && stored.splitKey !== activeKey ? stored.splitKey : "";

  return { pieces, activeKey, splitKey, appId: stored.appId };
}
