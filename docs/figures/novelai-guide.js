// ─────────────────────────────────────────────────────────────
// novelai-guide.js: figure data for the NovelAI user guide
// (docs/guide/platforms/novelai.md). Keyed by slug then figure id;
// prose drops a figure in with a line like `@fig journey`. Same
// DATA SHAPE as portfolio/site/data/figures.js. Renderer comes
// later; the `@fig` marker is inert until then. Grounded in the
// real room names (the Library, the Workbench, the Press) and
// src/formats/novelai/lorebook.ts (NAI has no character card, so
// the journey is lorebook-only, unlike the SillyTavern guide's).
// ─────────────────────────────────────────────────────────────

export const figures = {
  novelai: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "a lorebook, from drop to export",
      caption:
        "A NovelAI lorebook comes in through the Library as a standalone piece, no character attached. It gets edited on the Workbench, where a 'Writing for: NovelAI' lens surfaces NovelAI's own dials, then goes back out through the Press. Nothing is lost on the way in: the whole original lorebook is kept, so an export back to NovelAI returns everything. An export to a different app carries the shared entries and leaves NovelAI's private assembly dials behind.",
      steps: [
        { label: "Drop on the Library", sub: ".lorebook or .json export", color: "teal" },
        { label: "Kept in full", sub: "original lorebook held intact", color: "sage" },
        { label: "Edit on the Workbench", sub: "entries, keywords, NovelAI dials", color: "ochre" },
        { label: "Stage for the Press", sub: "pick a target format", color: "clay" },
        { label: "Export a lorebook", sub: "back to NovelAI, or another app", color: "plum" },
      ],
    },
  },
};
