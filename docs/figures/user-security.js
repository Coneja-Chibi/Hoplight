// Figures for docs/guide/security.md. Default-export a map keyed by @fig id.
// Data shape only (kind: flow), grounded in ADR-009, the README safety FAQ, and
// src/sandbox. No imports. Plain ASCII: no long dashes, arrows, or curly quotes.

export default {
  "card-cage": {
    type: "flow",
    fig: "fig-01",
    title: "how far a card's script gets",
    caption:
      "A downloaded card is read, not run. Regex and macros are treated as data. The only thing that executes a card's Lua is the Risu Test Bench, which you open on purpose, and it runs inside a WebAssembly VM, inside a web worker, on a separate loopback origin that serves two files and refuses every /api path. That last boundary is proven in the automated tests at the HTTP layer; it is not yet measured inside the packaged Windows app (ADR-009).",
    steps: [
      {
        label: "Local by default",
        sub: "loopback Studio; network features are explicit",
        color: "teal",
      },
      { label: "Read as data", sub: "regex, macros parsed, never run", color: "sage" },
      { label: "Size-capped", sub: "zip and PNG bombs die at the cap", color: "ochre" },
      { label: "Lua only if you ask", sub: "opt-in Risu Test Bench", color: "clay" },
      { label: "Caged", sub: "WASM VM, worker, separate origin", color: "plum" },
    ],
  },
};
