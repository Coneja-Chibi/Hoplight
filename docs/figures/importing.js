// ─────────────────────────────────────────────────────────────
// importing.js - figure data for docs/guide/importing.md, keyed
// by slug then figure id. Prose lives in the .md and drops a figure
// in with a line like `@fig intake`; this is the data behind that
// id. Copies the portfolio `flow` shape (site/data/figures.js);
// imports nothing. Renderer comes later; the marker is inert for now.
// Grounded in src/ui/apps/library/import-flow.tsx + index.tsx +
// src/ui/server-engine.ts (handleInspect) + src/studio/bundle.ts.
// ─────────────────────────────────────────────────────────────

export const figures = {
  importing: {
    intake: {
      type: "flow", fig: "fig·01", title: "one drop, one receipt, one deck",
      caption:
        "Every file, whether you dragged it onto the shelves or clicked Import, is read on its own and handed back as a receipt before anything is written. Nothing lands in the studio until you say so, and a file that fails to read never blocks the ones that worked.",
      steps: [
        { label: "Drop or Import", sub: "onto the shelves, from anywhere", color: "clay" },
        { label: "Read, one by one", sub: "detected, healed if it needs it", color: "ochre" },
        { label: "Receipt shown", sub: "kept, checked, or could not be read", color: "sage" },
        { label: "Uncheck, then commit", sub: "only the checked ones are written", color: "teal" },
        { label: "Lands in its deck", sub: "by kind, as a new piece", color: "plum" },
      ],
    },
  },
};
