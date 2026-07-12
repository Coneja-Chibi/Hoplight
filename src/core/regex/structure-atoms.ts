/**
 * Structure atoms for the NL builder (REGEX-JEWEL-PLAN.md R3 port scope, gap-closer #2). Three
 * deterministic grammar pieces beginners reach for that plain words alone cannot express:
 *   any number            - `\d+` (or `\d+(?:\.\d+)?` for decimals).
 *   anything between X, Y  - escaped X + `[\s\S]*?` + escaped Y (the most common beginner want, e.g.
 *                            [status] ... [/status]) - lazy so it stops at the first Y.
 *   start / end of a line  - `^` / `$` under the `m` flag.
 *
 * Each atom BUILDS a find/flags pair, is EXPLAINED by the general AST reader (explainPattern.reading
 * already reads `\d+`, `[\s\S]*?`, `^`/`$`), and ROUND-TRIPS via the recognizer here so a words-mode
 * slot can reopen the atom it built. Recognition is exact-shape only; anything else is null (Pattern
 * mode territory, the honesty floor). SAFETY: these are pattern DATA, compiled only in apply.ts.
 */

const escapeLiteral = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Reverse `escapeLiteral` for a run with no bare metacharacters, or null if it is not a plain run. */
function unescapeLiteral(fragment: string): string | null {
  let out = "";
  for (let i = 0; i < fragment.length; i++) {
    const c = fragment[i];
    if (c === "\\") {
      const next = fragment[i + 1];
      if (next === undefined) return null;
      out += next;
      i++;
      continue;
    }
    out += c;
  }
  return escapeLiteral(out) === fragment ? out : null;
}

export interface AtomBuilt {
  find: string;
  flags: string;
}

/** `\d+`, or `\d+(?:\.\d+)?` when decimals are allowed. Global-safe flags left to the caller. */
export function buildAnyNumber(decimals = false): AtomBuilt {
  return { find: decimals ? "\\d+(?:\\.\\d+)?" : "\\d+", flags: "" };
}

/** Escaped X, then anything (as little as possible), then escaped Y. Both bounds required. */
export function buildBetween(x: string, y: string): AtomBuilt {
  return { find: `${escapeLiteral(x)}[\\s\\S]*?${escapeLiteral(y)}`, flags: "" };
}

/** A line anchor: `^` (start) or `$` (end), each under the `m` flag so it means "each line". */
export function buildLineAnchor(which: "start" | "end"): AtomBuilt {
  return { find: which === "start" ? "^" : "$", flags: "m" };
}

export type StructureAtom =
  | { kind: "any-number"; decimals: boolean }
  | { kind: "between"; x: string; y: string }
  | { kind: "line-anchor"; which: "start" | "end" };

const BETWEEN_MID = "[\\s\\S]*?";

/**
 * Recognize a find/flags pair as exactly one structure atom, or null. Used for round-trip: an atom
 * built here re-recognizes to the same descriptor, which rebuilds to the same find/flags.
 */
export function recognizeAtom(find: string, flags: string): StructureAtom | null {
  if (find === "\\d+") return { kind: "any-number", decimals: false };
  if (find === "\\d+(?:\\.\\d+)?") return { kind: "any-number", decimals: true };
  if (find === "^" && flags.includes("m")) return { kind: "line-anchor", which: "start" };
  if (find === "$" && flags.includes("m")) return { kind: "line-anchor", which: "end" };

  const mid = find.indexOf(BETWEEN_MID);
  if (mid > 0 && find.indexOf(BETWEEN_MID, mid + 1) === -1) {
    const xRaw = find.slice(0, mid);
    const yRaw = find.slice(mid + BETWEEN_MID.length);
    if (yRaw.length > 0) {
      const x = unescapeLiteral(xRaw);
      const y = unescapeLiteral(yRaw);
      if (x !== null && y !== null) return { kind: "between", x, y };
    }
  }
  return null;
}
