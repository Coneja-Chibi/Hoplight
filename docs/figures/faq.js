// ─────────────────────────────────────────────────────────────
// faq.js - figure data for docs/guide/faq.md, keyed by slug then
// figure id. Prose lives in the .md and drops a figure in with a
// line like `@fig support`; this is the data behind that id. Copies
// the portfolio `matrix` shape (site/data/figures.js); imports
// nothing. Renderer comes later; the marker is inert for now.
// Grounded in each format's `export default` in src/formats/*/index.ts
// (kind coverage per adapter), cross-checked against
// docs/reference/formats/README.md.
// ─────────────────────────────────────────────────────────────

export const figures = {
  faq: {
    support: {
      type: "matrix", fig: "fig·01", title: "one card, nine apps",
      caption:
        "What each app's adapter actually reads and writes today. A blank cell isn't a bug, that app never had that piece to begin with, RisuAI has no persona file, Marinara only ever shipped regex and personas. Chub cards are the SillyTavern row: Chub has no wire shape of its own, it rides SillyTavern's Character Card v2/v3 with one extra block along for the ride. Hoplight's own native JSON isn't in this table, it's the local storage format every kind is already saved as, not a convert destination.",
      cols: ["Character", "Lorebook", "Persona", "Regex"],
      rows: [
        { label: "SillyTavern", cells: [true, true, true, true] },
        { label: "RoleCall", cells: [true, true, true, true] },
        { label: "RisuAI", cells: [true, true, false, true] },
        { label: "Lumiverse", cells: [true, false, true, true] },
        { label: "Agnai", cells: [true, true, false, false] },
        { label: "Backyard / Faraday", cells: [true, false, false, false] },
        { label: "Pygmalion", cells: [true, false, false, false] },
        { label: "NovelAI", cells: [false, true, false, false] },
        { label: "Marinara", cells: [false, false, true, true] },
      ],
    },
  },
};
