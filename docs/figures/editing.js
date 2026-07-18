// ─────────────────────────────────────────────────────────────
// editing.js - figure data for docs/guide/editing.md, keyed by
// slug then figure id. Prose lives in the .md and drops a figure
// in with a line like `@fig views`; this is the data behind that
// id. Copies the portfolio `matrix` shape (site/data/figures.js);
// imports nothing. Renderer comes later; the marker is inert for now.
// Grounded in src/ui/apps/settings/sections/workbench.tsx (the
// same Bento/Playbill/Grid/Steps copy shown in Settings) and
// src/ui/apps/workbench/Editor.tsx (the three presenters).
// ─────────────────────────────────────────────────────────────

export const figures = {
  editing: {
    views: {
      type: "matrix", fig: "fig·01", title: "one draft, three views",
      caption:
        "Grid and Steps read the same draft; Bento and Playbill are two layouts inside Grid. Switching between them never changes a field's value, only how much of the card you see at once, and Save writes the same draft no matter which one is on screen.",
      cols: ["Shows", "Best when"],
      rows: [
        { label: "Steps", cells: ["one field at a time, guided", "starting a piece from nothing"] },
        { label: "Bento", cells: ["every field in one card grid", "you know the card and want it all at once"] },
        { label: "Playbill", cells: ["fields grouped into acts you page through", "a long card, scanned section by section"] },
      ],
    },
  },
};
