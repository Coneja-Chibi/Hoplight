// ─────────────────────────────────────────────────────────────
// chub.js: figure data for the Chub user guide
// (docs/guide/platforms/chub.md). Keyed by slug then figure id;
// prose drops a figure in with a line like `@fig journey`. Same
// DATA SHAPE as portfolio/site/data/figures.js. Renderer comes
// later; the `@fig` marker is inert until then. Grounded in the
// real room names (the Library, the Workbench, the Press) and in
// src/formats/_shared/extension-platforms.ts: a Chub card is read
// through the sillytavern adapter, never a dedicated chub codec.
// ─────────────────────────────────────────────────────────────

export const figures = {
  chub: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "one wire, two names",
      caption:
        "A Chub card is a SillyTavern-shaped Character Card v2/v3 with an extensions.chub block riding inside it. Hoplight reads that block on the Library, edits it as its own set of cards on the Workbench, and on the Press an export back to Chub or SillyTavern keeps it whole. An export to a different app carries the shared character and leaves the Chub block behind.",
      steps: [
        { label: "Drop on the Library", sub: ".png or .json card", color: "teal" },
        { label: "Read as SillyTavern", sub: "extensions.chub kept whole", color: "sage" },
        { label: "Edit on the Workbench", sub: "fields, plus Chub-tagged cards", color: "ochre" },
        { label: "Stage for the Press", sub: "pick a target format", color: "clay" },
        { label: "Export a card", sub: "back to Chub or ST keeps it all", color: "plum" },
      ],
    },
  },
};
