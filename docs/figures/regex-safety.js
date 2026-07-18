// ─────────────────────────────────────────────────────────────
// regex-safety.js: figure data for docs/reference/security/regex-safety.md,
// keyed by figure id (flat map, matches docs/figures/regex.js). Prose
// lives in the .md and drops a figure in with a line like `@fig pipeline`;
// this file is the data behind that id. Copies the portfolio `flow`
// shape (site/data/figures.js); imports nothing. Renderer comes later,
// so the marker is inert for now.
// Grounded in src/core/regex/ast/parser.ts, src/core/regex/ast/redos.ts,
// src/core/regex/validate.ts, and src/core/regex/apply.ts (applyRule).
// ─────────────────────────────────────────────────────────────

export default {
  pipeline: {
    type: "flow",
    fig: "fig 01",
    title: "a card-authored pattern, before it is ever allowed to compile",
    caption:
      "Every stage up to the gate is analysis over the pattern STRING: nothing here compiles or " +
      "runs the pattern (ast-types.ts:13-14). A 'dangerous' verdict stops the pattern at the gate " +
      "with a culprit span and never reaches a real RegExp compile. This runs on EVERY execution of " +
      "EVERY enabled rule, not just once at save time (apply.ts:214).",
    steps: [
      { label: "Find pattern string", sub: "untrusted, card-authored", color: "clay" },
      { label: "Parse to AST", sub: "parser.ts, unicode-mode grammar, never throws", color: "ochre" },
      { label: "Structural ReDoS scan", sub: "redos.ts, 3 culprit shapes, precision over recall", color: "sage" },
      { label: "Gate: validateRule", sub: "dangerous refused before compile, validate.ts", color: "teal" },
      { label: "Compile + run, budgeted", sub: "native RegExp, per-call timeoutMs, apply.ts", color: "plum" },
    ],
  },
};
