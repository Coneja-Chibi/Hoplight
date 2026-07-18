// ─────────────────────────────────────────────────────────────
// getting-started.js - figure data for docs/guide/getting-started.md,
// keyed by slug then figure id. Prose lives in the .md and drops a
// figure in with a line like `@fig boot`; this is the data behind
// that id. Copies the portfolio `flow` shape (site/data/figures.js);
// imports nothing. Renderer comes later; the marker is inert for now.
// Grounded in src/ui/shell/App.tsx, src/ui/shell/store.ts (homeApp /
// firstLandingApp), and docs/reference/ui.md.
// ─────────────────────────────────────────────────────────────

export const figures = {
  "getting-started": {
    boot: {
      type: "flow", fig: "fig·01", title: "what bun run dev does with your settings",
      caption:
        "This is the first-run path only. The wizard and the Library's two doors are a once-only branch: once setup is complete, every later boot skips both and opens straight into the Workbench, or wherever you last were.",
      steps: [
        { label: "bun run dev", sub: "opens the loopback studio", color: "clay" },
        { label: "Settings check", sub: "has setup finished before?", color: "ochre" },
        { label: "Setup wizard", sub: "4 questions, first run only", color: "sage" },
        { label: "Library, two doors", sub: "first landing, once", color: "teal" },
        { label: "The Workbench", sub: "home, every boot after", color: "plum" },
      ],
    },
  },
};
