// ─────────────────────────────────────────────────────────────
// converting.js - figure data for docs/guide/converting.md, keyed
// by slug then figure id. Prose lives in the .md and drops a figure
// in with a line like `@fig pipeline`; this is the data behind that
// id. Copies the portfolio `flow` shape (site/data/figures.js);
// imports nothing. Renderer comes later; the marker is inert for now.
// Grounded in docs/reference/architecture.md (hub-and-spoke + escrow).
// ─────────────────────────────────────────────────────────────

export const figures = {
  converting: {
    pipeline: {
      type: "flow", fig: "fig·01", title: "one file in, another out",
      caption:
        "A convert never goes app to app directly. Your file is read into one shared model in the middle, then written back out in the shape the target app understands. Whatever the target cannot express is left behind on purpose, and one app's private scripts are never copied into another.",
      steps: [
        { label: "Your file", sub: "the card you already have", color: "clay" },
        { label: "Read into the model", sub: "one shared shape, the hub", color: "ochre" },
        { label: "Pick a target", sub: "the app you want it in", color: "sage" },
        { label: "Write what it speaks", sub: "keep what fits, drop the rest", color: "teal" },
        { label: "New file out", sub: "ready for the target app", color: "plum" },
      ],
    },
  },
};
