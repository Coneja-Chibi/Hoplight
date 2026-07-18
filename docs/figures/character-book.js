// ─────────────────────────────────────────────────────────────
// character-book.js - figure data for docs/reference/concepts/
// character-book.md, keyed by figure id. Prose lives in the .md
// and drops a figure in with a line like `@fig pipeline`; this is
// the data behind that id. Edit the shape/labels here; edit the
// words in the .md. Grounded in src/formats/_shared/character-book.ts
// and src/convert.ts.
// ─────────────────────────────────────────────────────────────

export default {
  pipeline: {
    type: "flow",
    fig: "fig 01",
    title: "extract on import, re-embed on export",
    caption:
      "An embedded character_book is never treated as inline card content. Import pulls it out into " +
      "its own canonical lorebook and links it by id; export resolves that link back into the target " +
      "format's own book slot. The two halves are separate functions, not one round-trip step, so the " +
      "extracted lorebook can be viewed and edited on its own between them.",
    steps: [
      { label: "Card carries character_book", sub: "findCharacterBook locates it", color: "clay" },
      { label: "Extract on import", sub: "characterBookToLorebook, own escrow", color: "ochre" },
      { label: "Linked, editable entity", sub: "knowledgeRefs; not inline content", color: "sage" },
      { label: "Resolved at export time", sub: "EmitContext.lorebooks", color: "teal" },
      { label: "Re-embed on export", sub: "embedCharacterBook writes data.character_book", color: "plum" },
    ],
  },
};
