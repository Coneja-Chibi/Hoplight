// ─────────────────────────────────────────────────────────────
// escrow-and-roundtrip.js: figure data for docs/reference/concepts/
// escrow-and-roundtrip.md, keyed by page slug then figure id. Prose
// lives in the .md and drops a figure in with `@fig <id>`; this file
// is the data behind that id. Copies the portfolio `flow` shape
// (site/data/figures.js); imports nothing. Renderer comes later, so
// the marker is inert for now. Grounded in src/core/canonical.ts and
// src/formats/_shared/tavern-fields.ts (the three-state overlay).
// ─────────────────────────────────────────────────────────────

export const figures = {
  "escrow-and-roundtrip": {
    roundtrip: {
      type: "flow", fig: "fig·01", title: "why a same-format round-trip loses nothing",
      caption:
        "On import the whole source payload is kept verbatim as a twin in the entity's original field. Edits land on the canonical body, never on the twin. On export the adapter overlays the body onto a clone of that twin: changed fields re-encode, and every field the canonical model does not express comes straight back from the twin, so nothing is silently dropped.",
      steps: [
        { label: "Import", sub: "store the raw twin in original", color: "teal" },
        { label: "Edit the body", sub: "canonical superset shape", color: "sage" },
        { label: "Export same format", sub: "overlay onto a twin clone", color: "ochre" },
        { label: "Changed fields re-encode", sub: "the rest come from the twin", color: "clay" },
        { label: "Lossless round-trip", sub: "no field silently dropped", color: "plum" },
      ],
    },
  },
};
