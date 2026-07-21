/**
 * Update check, the honest kind: nothing here fires on its own. The Settings button asks GitHub's
 * public releases API once (via the local server's /api/update-check, whose target is this fixed
 * constant - never a caller-supplied URL), compares versions, and offers the release page; the app
 * never phones home unprompted (the README promises local-only, so egress happens only on an
 * explicit press) and never downloads or swaps binaries itself.
 */

export const RELEASES_API = "https://api.github.com/repos/Coneja-Chibi/Hoplight/releases/latest";
export const RELEASES_PAGE = "https://github.com/Coneja-Chibi/Hoplight/releases";

export interface LatestRelease {
  version: string;
  url: string;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Tolerant reader for the releases/latest payload: null on anything that is not a release. */
export function readLatestRelease(json: unknown): LatestRelease | null {
  if (!isRec(json) || typeof json.tag_name !== "string" || json.tag_name === "") return null;
  const url = typeof json.html_url === "string" && json.html_url ? json.html_url : RELEASES_PAGE;
  return { version: json.tag_name, url };
}

/**
 * Compare two version strings ("v0.1.0", "0.2", "1.0.0-beta.1"): -1 when a < b, 0 equal, 1 when
 * a > b. Numeric segments compare numerically; a prerelease suffix sorts BELOW its release
 * ("1.0.0-beta" < "1.0.0"); unparseable segments compare as 0 so garbage never crashes a check.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string): { nums: number[]; pre: string } => {
    const clean = v.trim().replace(/^v/i, "");
    const dash = clean.indexOf("-");
    const core = dash >= 0 ? clean.slice(0, dash) : clean;
    const pre = dash >= 0 ? clean.slice(dash + 1) : "";
    const nums = core.split(".").map((s) => {
      const n = Number.parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    });
    return { nums, pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.nums.length, pb.nums.length); i++) {
    const na = pa.nums[i] ?? 0;
    const nb = pb.nums[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  if (pa.pre !== pb.pre) {
    if (pa.pre === "") return 1; // release beats its own prerelease
    if (pb.pre === "") return -1;
    return pa.pre < pb.pre ? -1 : 1;
  }
  return 0;
}

export type UpdateStatus =
  | { state: "current"; installed: string }
  | { state: "available"; installed: string; latest: LatestRelease }
  | { state: "none" }
  | { state: "error"; message: string };

/** Fold an API response (or its absence) into the one status the Settings row renders. */
export function updateStatusOf(installed: string, httpStatus: number, body: unknown): UpdateStatus {
  if (httpStatus === 0) return { state: "error", message: "Could not reach GitHub." };
  if (httpStatus === 404) return { state: "none" };
  if (httpStatus !== 200) return { state: "error", message: `GitHub answered ${httpStatus}.` };
  const latest = readLatestRelease(body);
  if (!latest) return { state: "error", message: "GitHub's answer was not a release." };
  return compareVersions(installed, latest.version) < 0
    ? { state: "available", installed, latest }
    : { state: "current", installed };
}
