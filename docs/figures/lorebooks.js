// ─────────────────────────────────────────────────────────────
// lorebooks.js - figure data for docs/guide/lorebooks.md, keyed
// by figure id. Prose lives in the .md and drops a figure in with
// a line like `@fig activation`; this is the data behind that id.
// Copies the portfolio `flow` shape (site/data/figures.js); imports
// nothing. Renderer comes later; the marker is inert for now.
// Grounded in src/core/lore/activation.ts (the real matcher) and
// src/core/lore/inspect.ts (the never-fires / never-woken rules).
// ─────────────────────────────────────────────────────────────

export default {
  activation: {
    type: "flow",
    fig: "fig·01",
    title: "how an entry gets from chat to prompt",
    caption:
      "The same matcher runs for Try a line, Rehearsal, and the real chat. A key hitting the scan " +
      "window is only the first gate: chance, cooldown, sticky, and delay all still have to clear, " +
      "recursion can wake an entry a second time from another entry's text, and the book's budget can " +
      "still cut a fired entry if the book is full. What survives lands at the position you set.",
    steps: [
      { label: "Chat scans for keys", sub: "the recent turns, out to Scan depth", color: "clay" },
      { label: "Chance, cooldown, sticky, delay", sub: "all have to clear, not just the key", color: "ochre" },
      { label: "Recursion (optional)", sub: "a fired entry's own text can wake another entry's keys", color: "sage" },
      { label: "Budget", sub: "token or entry cap decides what survives if the book is full", color: "teal" },
      { label: "Lands at its position", sub: "World, Character, or a richer stop, at the depth and role you set", color: "plum" },
    ],
  },
};
