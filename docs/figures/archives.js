// ─────────────────────────────────────────────────────────────
// archives.js - figure data for docs/reference/security/archives.md,
// keyed by figure id (flat map: the page drops a figure in with a
// line like `@fig pipeline`; this is the data behind that id). Edit
// the shape/labels here; edit the words in the .md.
// Grounded in src/core/archive.ts, src/formats/risu/index.ts,
// src/formats/backyard/byaf-container.ts, src/formats/backyard/
// byaf-scenarios.ts, and their .test.ts files (what is actually
// exercised versus code-only).
// ─────────────────────────────────────────────────────────────

export default {
  pipeline: {
    type: "flow",
    fig: "fig 01",
    title: "one archive, from bytes to files",
    caption:
      "unzipBounded rejects an oversized upload before fflate ever runs, then bounds every entry " +
      "fflate is willing to inflate. The one gap: fflate has already fully inflated a filter-accepted " +
      "entry into memory by the time the post-inflate recheck can catch a lying declared size, so that " +
      "step is a backstop against a dishonest header, not a ceiling on the transient allocation.",
    steps: [
      { label: "Raw bytes in", sub: "reject over 96 MiB before any unzip call", color: "clay" },
      { label: "fflate reads the directory", sub: "per-entry name, size, declared originalSize", color: "ochre" },
      { label: "Pre-inflate filter", sub: "compressed cap, declared-size cap, count, aggregate", color: "sage" },
      { label: "Accepted entries inflate", sub: "fflate decompresses only what the filter kept", color: "teal" },
      { label: "Post-inflate recheck", sub: "actual byte length re-checked against the same caps", color: "plum" },
      { label: "Fail closed", sub: "any violation or read error becomes ArchiveLimitError", color: "rose" },
    ],
  },
  assurance: {
    type: "matrix",
    fig: "fig 02",
    title: "enforced where, proven where",
    caption:
      "Decompression bounds are enforced and unit-tested at the shared core, then wired identically " +
      "into both .charx and .byaf. Path-traversal safety is real for exactly one write path: a BYAF " +
      "greeting id resolving to a re-packed scenario file. The other two places an untrusted entry name " +
      "can reach a re-exported archive, a BYAF image row and a Risu asset filename, carry no traversal " +
      "check and no test.",
    cols: ["Enforced by", "Proven in"],
    rows: [
      { label: "Archive byte cap (96 MiB)", cells: ["reject before any unzip call", "automated (archive.test.ts)"] },
      { label: "Per-entry compressed/declared-original cap (64 MiB)", cells: ["pre-inflate filter throw", "automated (archive.test.ts)"] },
      { label: "Entry count cap (512)", cells: ["pre-inflate filter throw", "automated (archive.test.ts)"] },
      { label: "Aggregate inflated cap (96 MiB)", cells: ["pre-inflate filter throw", "automated (archive.test.ts)"] },
      { label: "Post-inflate actual-size backstop", cells: ["recheck vs. real byte length", "code only, no lying-header test"] },
      { label: "Fail-closed on any read/decode error", cells: ["wrapped as ArchiveLimitError", "automated (archive.test.ts)"] },
      { label: "BYAF greeting id -> scenario path", cells: ["resolveGreetingPath allowlist + traversal check", "automated (byaf.test.ts)"] },
      { label: "BYAF image row path (ch.images[].path)", cells: ["none: reused verbatim as export entry name", "untested"] },
      { label: "Risu .charx asset filename", cells: ["none: reused verbatim as export entry name", "untested"] },
    ],
  },
};
