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

/** A folder the user has pointed Kit at for this session. Read access only, always. */
export interface Grant {
  /** Absolute, resolved at grant time so a later cwd change cannot move it. */
  readonly root: string;
  /** What the user called it, for messages. */
  readonly label?: string;
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
    if (contains(grant.root, resolved)) return { ok: true, path: resolved, root: grant.root };
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
