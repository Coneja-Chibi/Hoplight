// ─────────────────────────────────────────────────────────────
// add-a-format.js: figure data for docs/reference/extending/add-a-format.md,
// keyed by page slug then figure id. Prose lives in the .md and
// drops a figure in with `@fig <id>`; this file is the data behind
// that id. Shapes (flow / matrix) mirror the portfolio figure spec.
// Every figure is grounded in src/formats/_template/, src/core/loader.ts,
// src/core/adapter.ts, and src/core/registry.ts.
// ─────────────────────────────────────────────────────────────

export default {
  "add-a-format": {
    steps: {
      type: "flow",
      fig: "fig·01",
      title: "six steps, one folder, zero core edits",
      caption:
        "Copy the template folder, fill in the three verbs and a coverage file, stop. The loader " +
        "globs src/formats/*/index.ts on every run (loader.ts:20-37) and registers whatever a folder " +
        "default-exports, so nothing outside the new folder changes.",
      steps: [
        { label: "Copy _template", sub: "cp -r src/formats/_template src/formats/<name>", color: "sage" },
        { label: "detect(input)", sub: "0..1 confidence, registry keeps the top score >= 0.5", color: "teal" },
        { label: "toCanonical(input)", sub: "map wire to body, stash the twin in original.<id>.raw", color: "ochre" },
        { label: "fromCanonical(entity)", sub: "overlay body onto the twin, or a bare object with none", color: "clay" },
        { label: "Declare coverage", sub: "coverage.ts: which canonical paths the wire actually carries", color: "plum" },
        { label: "Loader discovers it", sub: "no registration call, no core file touched", color: "sage" },
      ],
    },
  },
};
