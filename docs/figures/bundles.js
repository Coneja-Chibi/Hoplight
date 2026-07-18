// ─────────────────────────────────────────────────────────────
// bundles.js: figure data for docs/reference/concepts/bundles.md,
// keyed by page slug then figure id. Prose lives in the .md and
// drops a figure in with `@fig <id>`; this file is the data behind
// that id. Shape (flow) mirrors the portfolio figure spec
// (site/data/figures.js); imports nothing. Renderer comes later, so
// the marker is inert for now. Grounded in src/convert.ts,
// src/core/adapter.ts, and src/ui/server-engine.ts.
// ─────────────────────────────────────────────────────────────

export const figures = {
  bundles: {
    lifecycle: {
      type: "flow", fig: "fig·01", title: "extract on import, re-embed on export",
      caption:
        "One knowledgeRefs link carries a lorebook across the boundary in both directions. Extract picks the adapter's own extractLorebook override when present, else the shared CCv2/v3 extractor. Resolve differs by caller: the CLI's convertFile feeds extraction straight into re-embedding in one in-memory pass; the Studio persists the lorebook and the character as two separate entities and resolves the ref back from the store at export time.",
      steps: [
        { label: "Import", sub: "character adapter's toCanonical", color: "teal" },
        { label: "Extract", sub: "shared extractor or extractLorebook override", color: "sage" },
        { label: "Link", sub: "knowledgeRefs = [lorebook.id]", color: "ochre" },
        { label: "Resolve", sub: "CLI: same pass · Studio: read from the store", color: "clay" },
        { label: "Re-embed", sub: "target adapter's own book slot via EmitContext", color: "plum" },
      ],
    },
  },
};
