/**
 * The default studio folder, rename-aware: the app now lives at "Hoplight Studio", but studios
 * created before the rename sit in "Vaude Studio". First boot after the rename MOVES the work
 * across (folder rename when the new home is absent; per-kind moves when an EMPTY new home
 * already exists - a stray empty folder must never strand a real library). If every move is
 * refused (folder open elsewhere, permissions), the legacy path keeps serving so the user's
 * pieces never look gone.
 */
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

const CONTENT_DIRS = ["character", "lorebook", "pack", "persona", "preset", "regex"];

const hasContent = (dir: string): boolean => CONTENT_DIRS.some((k) => existsSync(join(dir, k)));

export function resolveDefaultStudioDir(homeDir: string): string {
  const fresh = join(homeDir, "Documents", "Hoplight Studio");
  const legacy = join(homeDir, "Documents", "Vaude Studio");
  if (!existsSync(legacy)) return fresh;

  if (!existsSync(fresh)) {
    try {
      renameSync(legacy, fresh);
      return fresh;
    } catch {
      return legacy;
    }
  }

  // Both exist. A fresh home that already holds content wins untouched; an empty one adopts the
  // legacy library kind by kind (settings stay: the fresh copy holds the user's newest answers).
  if (hasContent(fresh) || !hasContent(legacy)) return fresh;
  let movedAny = false;
  for (const kind of CONTENT_DIRS) {
    const from = join(legacy, kind);
    const to = join(fresh, kind);
    if (!existsSync(from) || existsSync(to)) continue;
    try {
      renameSync(from, to);
      movedAny = true;
    } catch {
      /* refused move: that kind stays behind; the check below decides which root serves */
    }
  }
  return movedAny || !hasContent(legacy) ? fresh : legacy;
}
