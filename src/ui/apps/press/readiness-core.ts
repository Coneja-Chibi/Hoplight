/**
 * Press readiness core (the locked vs-press-room-1 wire): per piece x platform, which of the
 * platform's carried canonical paths are FILLED on the body, which are empty, folded to the row's
 * verdict. Pure over CoverageInfo + a body record; the same carries[] the Write-for lens trusts.
 * Dot-boundary prefix semantics match core/coverage.
 */
import type { CoverageInfo } from "../../app-contract";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Read a dot-path off a body; undefined when any hop is missing. */
export function readBodyPath(body: unknown, dotPath: string): unknown {
  let cur: unknown = body;
  for (const key of dotPath.split(".")) {
    if (!isRec(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Filled = carries a real value: non-empty string, non-empty array, true, number, non-empty rec. */
export function isFilled(v: unknown): boolean {
  if (v === undefined || v === null || v === false) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (isRec(v)) return Object.values(v).some(isFilled);
  return true; // numbers (0 is a real answer), true
}

export interface Readiness {
  /** carried paths that hold a value */
  filled: string[];
  /** carried paths that are empty on this piece */
  empty: string[];
  /** short human names of the empties (last two path segments, dots to spaces) */
  emptyNames: string[];
  verdict: "ready" | "empties" | "unknown";
}

/** Human name for a canonical path: "prompts.systemPrompt" -> "system prompt". */
export const pathName = (p: string): string =>
  (p.split(".").pop() ?? p).replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

/**
 * Readiness of one body against one platform's coverage entry. Unknown coverage (no entry for the
 * platform) is an honest "unknown", never a fake green.
 */
export function readiness(body: unknown, coverage: CoverageInfo | undefined): Readiness {
  if (!coverage || coverage.carries.length === 0) {
    return { filled: [], empty: [], emptyNames: [], verdict: "unknown" };
  }
  const filled: string[] = [];
  const empty: string[] = [];
  for (const path of coverage.carries) {
    (isFilled(readBodyPath(body, path)) ? filled : empty).push(path);
  }
  return {
    filled,
    empty,
    emptyNames: empty.map(pathName),
    verdict: empty.length === 0 ? "ready" : "empties",
  };
}

/** The row's readiness line: "11 of 16 filled - empty: appearance, system prompt, +2 more". */
export function readinessLine(r: Readiness, maxNamed = 3): string {
  if (r.verdict === "unknown") return "no coverage claims for this platform";
  const total = r.filled.length + r.empty.length;
  if (r.verdict === "ready") return `${total} of ${total} filled - everything carried is set`;
  const named = r.emptyNames.slice(0, maxNamed).join(", ");
  const more = r.emptyNames.length - maxNamed;
  return `${r.filled.length} of ${total} filled - empty: ${named}${more > 0 ? `, +${more} more` : ""}`;
}

/** The lorebook red-case from the locked wire: entries that can never fire (no keys, not constant). */
export function lorebookKeyGap(body: unknown): { total: number; keyless: number } {
  const b = isRec(body) ? body : {};
  const entries = Array.isArray(b.entries) ? b.entries : [];
  let keyless = 0;
  for (const e of entries) {
    if (!isRec(e)) continue;
    const triggers = Array.isArray(e.triggers) ? e.triggers : [];
    if (triggers.length === 0 && e.constant !== true) keyless++;
  }
  return { total: entries.length, keyless };
}
