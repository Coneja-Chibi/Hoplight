/**
 * The default studio folder, rename-aware: the app now lives at "Hoplight Studio", but studios
 * created before the rename sit in "Vaude Studio". First boot after the rename MOVES the folder
 * (one atomic rename, no copying); if the move is refused (folder open elsewhere, permissions),
 * the legacy path keeps serving so the user's library never looks empty.
 */
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

export function resolveDefaultStudioDir(homeDir: string): string {
  const fresh = join(homeDir, "Documents", "Hoplight Studio");
  const legacy = join(homeDir, "Documents", "Vaude Studio");
  if (!existsSync(fresh) && existsSync(legacy)) {
    try {
      renameSync(legacy, fresh);
    } catch {
      return legacy;
    }
  }
  return fresh;
}
