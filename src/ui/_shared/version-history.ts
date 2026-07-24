/**
 * Version-history pure core: turn GitHub's /releases payload into the in-app timeline the Updates page
 * renders (how far behind you are, every release's commits, and per-row update/rollback direction). All
 * pure and directly tested; the fetch + apply live in the shell (server-updates.ts, updates section).
 *
 * Two hard-won rules baked in (see the Fable review): compare versions with compareVersions (installed is
 * bare "0.1.8", tags are "v0.1.8", so string equality NEVER matches), and read commit data ONLY from the
 * fenced ```commits block a release ships (see release.yml). Absence -> "commit log unavailable", never a
 * guess from the install-guide prose above it.
 */
import { compareVersions } from "./update-check";

export interface Commit {
  /** short hash, 7-40 hex */
  readonly hash: string;
  readonly subject: string;
}

export interface ReleaseInfo {
  /** the tag, e.g. "v0.1.11" (shape-validated: only real semver tags survive parsing) */
  readonly version: string;
  /** release title, e.g. "Hoplight v0.1.11" */
  readonly name: string;
  /** published_at ISO string ("" when absent) */
  readonly date: string;
  /** html_url of the release page */
  readonly url: string;
  /** the headline change: first commit that is not a release-bump or a merge (or "" when none/unavailable) */
  readonly headline: string;
  /** commits in this release, newest first (empty when the release ships no ```commits block) */
  readonly commits: readonly Commit[];
}

export type Relation = "here" | "ahead" | "behind";

export interface TimelineRow {
  readonly release: ReleaseInfo;
  readonly relation: Relation;
  /** releases between you and this one, inclusive of this one (0 for the "here" row) */
  readonly distance: number;
}

export interface Timeline {
  readonly rows: readonly TimelineRow[];
  /** the running version (as reported, may be bare or v-prefixed) */
  readonly installed: string;
  /** newest known release version, or null when the list is empty */
  readonly latest: string | null;
  /** how many fetched releases are newer than installed */
  readonly behind: number;
  /** false when installed matches no fetched release: a dev/unreleased build between tags */
  readonly installedInList: boolean;
  /** more pages exist beyond what was fetched (behind is then a lower bound -> the UI shows "N+") */
  readonly hasMore: boolean;
}

// Only real semver tags become releases; anything else (a stray non-version tag) is dropped at the
// boundary so it can never reach the sort, a git argv, or the timeline. Parse-don't-validate.
const TAG_SHAPE = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** True for a real release tag ("v0.1.11"). The switch route validates with this before a tag ever reaches
 *  a git argv, so a "--force"-shaped value cannot become an option. */
export const isReleaseTag = (s: string): boolean => TAG_SHAPE.test(s);

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** True for a commit subject that is release plumbing, not a real change (skipped when picking a headline). */
const isPlumbing = (subject: string): boolean => /^release:/i.test(subject) || /^Merge /.test(subject);

/**
 * Parse the fenced ```commits block a release body carries (release.yml emits it): each line is
 * "<shorthash> <subject>". Reads ONLY inside the fence; ignores the install-guide prose around it. Returns
 * [] when the block is absent or empty (the caller renders "commit log unavailable"). Pure, tolerant.
 */
export function parseCommitBlock(body: string): Commit[] {
  if (typeof body !== "string" || body === "") return [];
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "```commits");
  if (start < 0) return [];
  const commits: Commit[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "```") break; // closing fence
    const m = /^([0-9a-f]{7,40}) (.+)$/.exec(line.trim());
    if (m) commits.push({ hash: m[1]!, subject: m[2]! });
  }
  return commits;
}

/** The headline = the first non-plumbing commit subject, falling back to the first commit, then "". */
export function headlineOf(commits: readonly Commit[]): string {
  const real = commits.find((c) => !isPlumbing(c.subject));
  if (real) return real.subject;
  return commits[0]?.subject ?? "";
}

/**
 * Tolerant reader for the GitHub /releases array. Drops drafts, prereleases, and any tag that is not real
 * semver; dedupes exact-equal versions (first wins); sorts newest-first via compareVersions. Never throws.
 */
export function readReleasesList(json: unknown): ReleaseInfo[] {
  if (!Array.isArray(json)) return [];
  const seen = new Set<string>();
  const out: ReleaseInfo[] = [];
  for (const raw of json) {
    if (!isRec(raw)) continue;
    if (raw.draft === true || raw.prerelease === true) continue;
    const version = str(raw.tag_name);
    if (!TAG_SHAPE.test(version)) continue;
    if (seen.has(version)) continue;
    seen.add(version);
    const commits = parseCommitBlock(str(raw.body));
    out.push({
      version,
      name: str(raw.name) || version,
      date: str(raw.published_at),
      url: str(raw.html_url),
      headline: headlineOf(commits),
      commits,
    });
  }
  out.sort((a, b) => compareVersions(b.version, a.version)); // newest first
  return out;
}

/**
 * Build the timeline against the running version. Relation and behind-count come from the SIGN of
 * compareVersions (never string equality), so a bare installed "0.1.8" still matches the "v0.1.8" row.
 */
export function buildTimeline(
  releases: readonly ReleaseInfo[],
  installed: string,
  hasMore = false,
): Timeline {
  const rows: TimelineRow[] = releases.map((release) => {
    const cmp = compareVersions(release.version, installed);
    if (cmp === 0) return { release, relation: "here" as const, distance: 0 };
    if (cmp > 0) {
      // ahead: releases newer than installed but not newer than this one
      const distance = releases.filter(
        (r) => compareVersions(r.version, installed) > 0 && compareVersions(r.version, release.version) <= 0,
      ).length;
      return { release, relation: "ahead" as const, distance };
    }
    // behind: releases older than installed but not older than this one
    const distance = releases.filter(
      (r) => compareVersions(r.version, installed) < 0 && compareVersions(r.version, release.version) >= 0,
    ).length;
    return { release, relation: "behind" as const, distance };
  });
  const behind = rows.filter((r) => r.relation === "ahead").length;
  const installedInList = rows.some((r) => r.relation === "here");
  return {
    rows,
    installed,
    latest: releases[0]?.version ?? null,
    behind,
    installedInList,
    hasMore,
  };
}
