// ─────────────────────────────────────────────────────────────
// library.js - figure data for docs/guide/library.md, keyed by
// slug then figure id. Prose lives in the .md and drops a figure
// in with a line like `@fig views`; this is the data behind that
// id. Copies the portfolio `matrix` shape (site/data/figures.js);
// imports nothing. Renderer comes later; the marker is inert for now.
// Grounded in src/ui/apps/library/view-contract.ts (the DeckView
// contract) and views/registry.ts + views/grid.tsx, showcase.tsx,
// list.tsx, shelf.tsx, regex-shelf.tsx (order, kinds, labels).
// ─────────────────────────────────────────────────────────────

export const figures = {
  library: {
    views: {
      type: "matrix", fig: "fig·01", title: "one browse room, five views",
      caption:
        "Grid, Show, and List read the same deck the same way everywhere. Shelf and Sets add deck-specific handles, an on/off switch and merge for Lorebooks, rule counts and a slow-rule flag for Regex sets, that a plain portrait card never carries.",
      cols: ["Shows", "Available on"],
      rows: [
        { label: "Grid", cells: ["a fluid wall of portrait cards, sized by the art slider", "every deck"] },
        { label: "Show", cells: ["one piece at a time: hero art, its own tagline and description, a rail to jump", "every deck"] },
        { label: "List", cells: ["dense rows: thumbnail, name, kind, and workbench state", "every deck"] },
        { label: "Shelf", cells: ["spine cards with a name-or-key search box; a Lorebook spine adds on/off, Split, Copy, and drag-to-merge", "every deck"] },
        { label: "Sets", cells: ["spine cards with a rule count, a computed one-line description, and a slow-rule flag", "Regex sets only"] },
      ],
    },
  },
};
