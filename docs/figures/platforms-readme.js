// ─────────────────────────────────────────────────────────────
// platforms-readme.js: figure data for docs/guide/platforms/README.md,
// keyed by slug then figure id. Prose drops a figure in with a line
// like `@fig coverage`; this is the data behind that id. Copies the
// portfolio `matrix` shape (site/data/figures.js); imports nothing.
// Renderer comes later; the marker is inert for now. Grounded in
// docs/FORMAT-SUPPORT.md (generated from the live adapter registry,
// bun run scripts/format-matrix.ts) cross-checked against the ten
// docs/guide/platforms/*.md pages for which page owns each platform's
// character workflow (Marinara redirects to the SillyTavern page).
// ─────────────────────────────────────────────────────────────

export const figures = {
  platforms: {
    coverage: {
      type: "matrix",
      fig: "fig·01",
      title: "ten platforms, four kinds of piece",
      caption:
        "Every column is a deck in the Library. \"No\" means that platform never shipped a file of that shape, not that Hoplight is missing an adapter. Marinara's character cards are SillyTavern-shaped underneath, so they read \"No\" here and go through the SillyTavern page instead.",
      cols: ["Characters", "Lorebooks", "Personas", "Regex sets"],
      rows: [
        { label: "Agnai", cells: ["Yes", "Yes", "No", "No"] },
        { label: "Backyard", cells: ["Yes", "No", "No", "No"] },
        { label: "Chub", cells: ["Yes", "Yes", "No", "No"] },
        { label: "Lumiverse", cells: ["Yes", "No", "Yes", "Yes"] },
        { label: "Marinara", cells: ["No", "No", "Yes", "Yes"] },
        { label: "NovelAI", cells: ["No", "Yes", "No", "No"] },
        { label: "Pygmalion", cells: ["Yes", "No", "No", "No"] },
        { label: "RisuAI", cells: ["Yes", "Yes", "No", "Yes"] },
        { label: "RoleCall", cells: ["Yes", "Yes", "Yes", "Yes"] },
        { label: "SillyTavern", cells: ["Yes", "Yes", "Yes", "Yes"] },
      ],
    },
  },
};
