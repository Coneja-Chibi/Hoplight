/** Version-history parsing, timeline, behind-count, and data-change regressions. */
import { describe, expect, test } from "bun:test";
import {
  buildTimeline,
  headlineOf,
  parseCommitBlock,
  readReleasesList,
  type ReleaseInfo,
} from "./version-history";

const FENCE = "```";

// A real release body: install prose plus the fenced commit block.
const REAL_BODY = [
  "## Install",
  "| **Windows** | `Hoplight.exe` | Double-click it |",
  "| **Linux** | `hoplight-linux-x64` | `chmod +x` it, run `./hoplight-linux-x64 ui` |",
  "",
  "- **Windows warns once**: SmartScreen shows the unsigned warning, click Run anyway.",
  "- The `hoplight-*` files are terminal tools; double-clicking one flashes a console and closes.",
  "",
  "**Changes**: https://github.com/Coneja-Chibi/Hoplight/compare/v0.1.10...v0.1.11",
  "",
  "## Commits",
  FENCE + "commits",
  "9390fcd release: v0.1.11 [skip release]",
  "bf9bc8d feat(remote): reach the studio from your own devices (Tailscale + LAN)",
  "135a166 release: v0.1.10 [skip release]",
  "ed224b6 Merge pull request #5 from Coneja-Chibi/fix/docs-index-autoregen",
  "e76765b Hook: regenerate docs index from the staged snapshot",
  "5fab719 Auto-regenerate the docs index in pre-commit so it cannot go stale",
  FENCE,
].join("\n");

describe("parseCommitBlock", () => {
  test("reads exactly the fenced commits, not the install-guide prose around it", () => {
    const commits = parseCommitBlock(REAL_BODY);
    expect(commits).toHaveLength(6);
    expect(commits[0]).toEqual({ hash: "9390fcd", subject: "release: v0.1.11 [skip release]" });
    expect(commits[1]!.subject).toContain("feat(remote)");
    // none of the markdown bullets ("- **Windows warns once**...") leaked in as commits
    expect(commits.every((c) => /^[0-9a-f]{7,40}$/.test(c.hash))).toBe(true);
  });

  test("returns [] when there is no commits block (never guesses from prose)", () => {
    const noBlock = "## Install\n- Double-click Hoplight.exe\n\n**Changes**: https://x/compare";
    expect(parseCommitBlock(noBlock)).toEqual([]);
    expect(parseCommitBlock("")).toEqual([]);
  });
});

describe("headlineOf", () => {
  test("skips release-bump and merge commits, picks the first real change", () => {
    expect(headlineOf(parseCommitBlock(REAL_BODY))).toContain("feat(remote)");
  });
  test("falls back to the first commit when all are plumbing", () => {
    expect(headlineOf([{ hash: "aaaaaaa", subject: "release: v1 [skip release]" }])).toBe(
      "release: v1 [skip release]",
    );
    expect(headlineOf([])).toBe("");
  });
});

describe("readReleasesList", () => {
  const mk = (tag: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    tag_name: tag,
    name: `Hoplight ${tag}`,
    published_at: "2026-07-24T00:00:00Z",
    html_url: `https://x/releases/${tag}`,
    body: "",
    ...extra,
  });

  test("drops drafts, prereleases, and non-semver tags; dedupes; sorts newest first", () => {
    const list = readReleasesList([
      mk("v0.1.9"),
      mk("v0.1.11"),
      mk("v0.1.9"), // duplicate -> dropped
      mk("v0.2.0-beta.1", { prerelease: true }), // prerelease -> dropped
      mk("nightly"), // non-semver -> dropped
      mk("v0.1.10", { draft: true }), // draft -> dropped
      mk("v0.1.8"),
    ]);
    expect(list.map((r) => r.version)).toEqual(["v0.1.11", "v0.1.9", "v0.1.8"]);
  });

  test("non-array input is []", () => {
    expect(readReleasesList(null)).toEqual([]);
    expect(readReleasesList({})).toEqual([]);
  });
});

describe("buildTimeline", () => {
  const rel = (v: string): ReleaseInfo => ({
    version: v,
    name: `Hoplight ${v}`,
    date: "",
    url: "",
    headline: "",
    commits: [],
  });
  // note the real gap: no v0.1.1 exists (v0.1.0 -> v0.1.2), behind is a RELEASE count, not arithmetic.
  const releases = ["v0.1.11", "v0.1.10", "v0.1.9", "v0.1.8", "v0.1.2", "v0.1.0"].map(rel);

  test('marks "here" on a BARE installed version against v-prefixed tags (the string-equality trap)', () => {
    const tl = buildTimeline(releases, "0.1.9"); // installed reported bare
    const here = tl.rows.find((r) => r.relation === "here");
    expect(here?.release.version).toBe("v0.1.9");
    expect(tl.installedInList).toBe(true);
  });

  test("behind = count of newer releases; ahead/behind distances are inclusive release counts", () => {
    const tl = buildTimeline(releases, "0.1.9");
    expect(tl.behind).toBe(2); // v0.1.10 and v0.1.11 are newer
    expect(tl.latest).toBe("v0.1.11");
    const byV = (v: string) => tl.rows.find((r) => r.release.version === v)!;
    expect(byV("v0.1.11").relation).toBe("ahead");
    expect(byV("v0.1.11").distance).toBe(2);
    expect(byV("v0.1.10").distance).toBe(1);
    expect(byV("v0.1.8").relation).toBe("behind");
    expect(byV("v0.1.8").distance).toBe(1);
    expect(byV("v0.1.0").distance).toBe(3); // v0.1.8, v0.1.2, v0.1.0 are all <= it and < installed
  });

  test("behind counts RELEASES not version arithmetic (the v0.1.1 gap)", () => {
    // installed on the oldest, everything newer: behind must equal the number of newer ROWS (5), not
    // any patch-number difference (0.1.11 - 0.1.0 would overcount).
    const tl = buildTimeline(releases, "0.1.0");
    expect(tl.behind).toBe(5);
  });

  test('an unreleased build between tags yields no "here" row', () => {
    const tl = buildTimeline(releases, "0.1.12-dev");
    expect(tl.installedInList).toBe(false);
    expect(tl.rows.every((r) => r.relation === "behind")).toBe(true);
  });

  test("empty release list is a safe empty timeline", () => {
    const tl = buildTimeline([], "0.1.9");
    expect(tl.rows).toEqual([]);
    expect(tl.latest).toBeNull();
    expect(tl.behind).toBe(0);
  });
});
