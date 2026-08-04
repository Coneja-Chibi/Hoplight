/**
 * Which folders Kit may read, and the one rule that keeps that honest.
 *
 * THE SHAPE, AND WHY IT IS THIS ONE. Outside the studio Kit reads and never writes. When it needs to
 * change something it copies the file INTO the studio first, and from there the ordinary tools apply:
 * the draft, the review gate, the receipt. So a granted folder can never be modified, no matter which
 * tool is holding the path, because no tool that writes ever accepts a path from outside.
 *
 * That boundary is worth more than a permission prompt. A prompt asks about one call and is answered
 * by a tired person; this makes "Kit changed a file I did not point it at" unrepresentable.
 *
 * PURE ON PURPOSE. Path containment is the kind of check that looks obvious and is not: `..` escapes,
 * a prefix match that lets /studio-backup pass for /studio, and on Windows two spellings of the same
 * drive. None of that needs a filesystem to test, so none of it is tested against one.
 */
import { isAbsolute, relative, resolve, sep } from "node:path";
import { realpath } from "node:fs/promises";

/** A folder the user has pointed Kit at for this session. Read access only, always. */
export interface Grant {
  /** Absolute, resolved at grant time so a later cwd change cannot move it. */
  readonly root: string;
  /** What the user called it, for messages. */
  readonly label?: string;
  /**
   * This grant is ONE FILE, not a folder: `root` must match exactly, and nothing beside it is
   * reachable.
   *
   * Why the distinction exists. Somebody pasting a path into the composer and saying "look at this"
   * has consented to that file, exactly as picking it in a file dialog would - and being told to run
   * a sharing command first is a step they correctly read as arbitrary. But granting the FOLDER it
   * happens to sit in would turn one file into a directory, and a Downloads folder is not a thing
   * anybody meant to hand over.
   *
   * So the trust comes from a human action at a boundary rather than from widening a check: the
   * model reaching for a path on its own still gets nothing new.
   */
  readonly file?: boolean;
}

export type GrantDenial =
  /** Nothing has been granted, so there is nothing to search. */
  | "no-grants"
  /** The path resolves outside every granted root. */
  | "outside-grants"
  /** The path is not absolute, so it cannot be checked against anything. */
  | "not-absolute";

export interface GrantRefusal {
  readonly ok: false;
  readonly reason: GrantDenial;
  /** One sentence naming what to do, since a refusal a person cannot act on is just a wall. */
  readonly detail: string;
}

export type GrantCheck = { readonly ok: true; readonly path: string; readonly root: string } | GrantRefusal;

const refuse = (reason: GrantDenial, detail: string): GrantRefusal => ({ ok: false, reason, detail });

/**
 * Windows compares paths case-insensitively and Linux does not, so the comparison follows the
 * platform rather than picking one. Getting this backwards fails in opposite directions: too strict
 * refuses a folder the user did grant, too loose accepts one they did not.
 */
const comparable = (path: string): string => (process.platform === "win32" ? path.toLowerCase() : path);

/**
 * Is `candidate` inside `root`?
 *
 * Uses `relative` rather than a prefix match. A prefix match says /studio-backup is inside /studio,
 * which is the classic way this check is written wrong, and the failure grants access to a sibling
 * directory the user never named.
 */
export function contains(root: string, candidate: string): boolean {
  const from = comparable(resolve(root));
  const to = comparable(resolve(candidate));
  if (from === to) return true;
  const rel = relative(from, to);
  // Empty means identical; a leading ".." means it climbed out; absolute means a different drive.
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}

/**
 * Resolve a path against the grants, or refuse.
 *
 * Returns the RESOLVED path, so a caller cannot accidentally use the raw input it was handed. That is
 * the difference between checking a path and using the one you checked.
 */
export function checkGrant(grants: readonly Grant[], candidate: string): GrantCheck {
  if (grants.length === 0) {
    return refuse(
      "no-grants",
      "no folder has been shared with Kit yet. Point it at one first, and it will still only read.",
    );
  }
  if (!candidate.trim()) {
    return refuse("not-absolute", "no path was given.");
  }
  const resolved = resolve(candidate);
  if (!isAbsolute(resolved)) {
    return refuse("not-absolute", `${candidate} is not an absolute path.`);
  }
  for (const grant of grants) {
    // A file grant matches ITSELF and nothing else. `contains` returns true for an identical path,
    // so this is the same comparison narrowed - never a second, subtly different one.
    const ok = grant.file
      ? comparable(resolve(grant.root)) === comparable(resolved)
      : contains(grant.root, resolved);
    if (ok) return { ok: true, path: resolved, root: grant.root };
  }
  const shared = grants.map((g) => g.label ?? g.root).join(", ");
  return refuse(
    "outside-grants",
    `${resolved} is outside the folders shared with Kit (${shared}). Share that folder if you meant to.`,
  );
}

/**
 * Normalise a folder the user is granting.
 *
 * Resolved once, here, so every later comparison is against a stable absolute path. A grant recorded
 * as a relative path would silently follow the process around.
 */
export const grantFolder = (root: string, label?: string): Grant =>
  label === undefined ? { root: resolve(root) } : { root: resolve(root), label };

/**
 * Do two paths name the same folder?
 *
 * Uses the SAME platform-aware comparison containment uses. Comparing raw strings here instead was a
 * real fail-open: `contains` lowercases on Windows, so `/share C:\Presets` then
 * `/unshare c:\presets` found no match, told the user it "was not shared", and left the grant fully
 * live. A revocation control that silently does nothing is worse than one that errors.
 */
export const sameRoot = (a: string, b: string): boolean =>
  comparable(resolve(a)) === comparable(resolve(b));

/**
 * Resolve a path against the grants AND against the filesystem, so a link cannot carry it out.
 *
 * WHY THE LEXICAL CHECK IS NOT ENOUGH, proven on a stock Windows profile with no attacker involved.
 * `C:\Users\chiev\Videos` is a shell junction to `D:\Videos`. Sharing `C:\Users\chiev` and asking for
 * that path passes containment - the STRING sits under the root - and then reads another drive. The
 * measured result was 93 files enumerated from `D:` while the tool reported a `C:` root, which is
 * indistinguishable from a contained read.
 *
 * The walk already skipped symlinked ENTRIES, and that was the trap: it made the boundary look
 * closed while the walk's own root, and every read and import target, went unchecked.
 *
 * Both sides are resolved, because a granted root can itself be a link. Sharing `C:\Users\chiev\Videos`
 * means the user shared `D:\Videos`, and its real children must stay reachable.
 *
 * A path that does not exist keeps the lexical answer: there is nothing behind it to leak, and every
 * caller stats it immediately and reports "not found".
 */
export async function checkGrantReal(
  grants: readonly Grant[],
  candidate: string,
): Promise<GrantCheck> {
  const lexical = checkGrant(grants, candidate);
  if (!lexical.ok) return lexical;

  const real = await realpath(lexical.path).catch(() => null);
  if (real === null) return lexical;

  for (const grant of grants) {
    const realRoot = await realpath(grant.root).catch(() => grant.root);
    // The file narrowing has to be repeated HERE, not only in checkGrant. Leaving it out would let a
    // one-file grant behave as a folder grant the moment the link-aware path ran, which is the
    // fail-OPEN version of the same code and the direction that actually costs something.
    const ok = grant.file
      ? comparable(resolve(realRoot)) === comparable(real)
      : contains(realRoot, real);
    // The REAL path is what comes back, so a caller can only ever open what was checked.
    if (ok) return { ok: true, path: real, root: realRoot };
  }
  const shared = grants.map((g) => g.label ?? g.root).join(", ");
  return refuse(
    "outside-grants",
    `${lexical.path} leads outside the folders shared with Kit (${shared}). It is a link to ${real}.`,
  );
}
