/**
 * The folders shared with Kit this session, and the only place that list changes.
 *
 * WHY THIS EXISTS AS A HOLDER rather than an array on the dispatch context. The context is built once
 * when the session starts and every tool call reads the same object, so a plain array would freeze the
 * grants at startup and no command could ever add one. The session hands the context a getter over
 * this book instead, which is what makes sharing a folder mid-conversation take effect on the next
 * call rather than the next launch.
 *
 * SHARING IS CHECKED, NOT RECORDED. A path that does not exist, or names a file, is refused here. The
 * failure it prevents is quiet and confusing: the user believes they shared something, Kit answers
 * "outside the folders shared with Kit", and nothing in either message says the folder was never real.
 *
 * SESSION-LOCAL ON PURPOSE. Nothing here is written to disk. A grant that outlived the conversation
 * would mean a later session could read a folder the person shared once, for one question, and
 * forgot about. Re-sharing costs a line; a forgotten standing grant costs the boundary.
 */
import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import { grantFolder, sameRoot, type Grant } from "./grants";

/** Enough for a preset folder, a card folder and a few more; small enough to read back in one line. */
const MAX_GRANTS = 16;

export type ShareOutcome =
  | { readonly ok: true; readonly grant: Grant; readonly already: boolean }
  | { readonly ok: false; readonly reason: "missing" | "not-a-folder" | "full"; readonly detail: string };

export interface GrantBook {
  /** Every folder shared this session, in the order they were shared. */
  list(): readonly Grant[];
  /** Share one folder for reading. Verified to exist and be a directory before it is recorded. */
  share(path: string, label?: string): Promise<ShareOutcome>;
  /**
   * Share ONE FILE, because the person named it themselves.
   *
   * Separate from `share` rather than a flag on it, so the two authorities never blur: `share` is a
   * folder the user pointed Kit at, and this is a single file they handed over by writing its path -
   * the same consent picking it in a file dialog carries, and no wider. Nothing beside it becomes
   * reachable, which is the whole reason it is not implemented as "grant the parent folder".
   *
   * Verified to exist and be a FILE before it is recorded, so a typo never becomes a live grant.
   */
  shareFile(path: string, label?: string): Promise<ShareOutcome>;
  /** Stop sharing one folder. True when something was actually removed. */
  revoke(path: string): boolean;
}

export function createGrantBook(): GrantBook {
  const grants: Grant[] = [];
  // Identity uses the SAME comparison containment uses. A raw === here was a fail-open: on Windows
  // containment lowercases, so /unshare with different casing found nothing, said "was not shared",
  // and left the grant live - while /share of a case variant recorded a second copy of one folder.
  const indexOf = (path: string): number =>
    grants.findIndex((grant) => sameRoot(grant.root, path));

  return {
    list: () => grants,

    async share(path, label) {
      const grant = grantFolder(path, label);
      const existing = indexOf(path);
      if (existing >= 0) return { ok: true, grant: grants[existing]!, already: true };
      if (grants.length >= MAX_GRANTS) {
        return {
          ok: false,
          reason: "full",
          detail: `Kit is already reading ${MAX_GRANTS} folders. Stop sharing one before adding another.`,
        };
      }
      let info;
      try {
        info = await stat(grant.root);
      } catch {
        return { ok: false, reason: "missing", detail: `There is nothing at ${grant.root}.` };
      }
      if (!info.isDirectory()) {
        return {
          ok: false,
          reason: "not-a-folder",
          detail: `${grant.root} is a file. Share the folder it sits in.`,
        };
      }
      grants.push(grant);
      return { ok: true, grant, already: false };
    },

    async shareFile(path, label) {
      const root = resolve(path);
      const existing = indexOf(root);
      if (existing >= 0) return { ok: true, grant: grants[existing]!, already: true };
      if (grants.length >= MAX_GRANTS) {
        return {
          ok: false,
          reason: "full",
          detail: `Kit is already reading ${MAX_GRANTS} things. Stop sharing one before adding another.`,
        };
      }
      let info;
      try {
        info = await stat(root);
      } catch {
        // A path that is not there never becomes a grant. Somebody mistyping into the composer must
        // not leave a live authority behind for a name that does not exist yet.
        return { ok: false, reason: "missing", detail: `There is nothing at ${root}.` };
      }
      if (info.isDirectory()) {
        return {
          ok: false,
          reason: "not-a-folder",
          detail: `${root} is a folder. Use /share for a folder; this is for one file.`,
        };
      }
      const grant: Grant = { root, file: true, ...(label ? { label } : {}) };
      grants.push(grant);
      return { ok: true, grant, already: false };
    },

    revoke(path) {
      const at = indexOf(path);
      if (at < 0) return false;
      grants.splice(at, 1);
      return true;
    },
  };
}
