// ─────────────────────────────────────────────────────────────
// untrusted-content.js - figure data for docs/reference/security/
// untrusted-content.md, keyed by figure id. Prose lives in the .md
// and drops a figure in with a line like `@fig door`; this is the
// data behind that id. Edit the shape/labels here; edit the words
// in the .md. Grounded in src/formats/_shared/{png,card-io}.ts,
// src/core/archive.ts, src/entities/character/schema.ts,
// src/formats/risu/{index,risu-fields}.ts, src/convert.ts,
// src/ui/receipt.ts. Execution-time controls (the Test Bench worker
// itself) are a different figure: docs/figures/script-sandbox.js.
// ─────────────────────────────────────────────────────────────

export default {
  door: {
    type: "flow",
    fig: "fig 01",
    title: "past the door, not onto the stage",
    caption:
      "Every import runs the same shape: bytes go through one tolerant parse into a known type, " +
      "authored scripts land as inert data on the canonical body, and the raw source stays sealed in " +
      "escrow under its own format id. Nothing in this path evaluates a script. The only way a script " +
      "body runs at all is an operator opening the Test Bench and pressing run, a separate, resource-" +
      "capped surface documented on its own page.",
    steps: [
      { label: "Untrusted bytes", sub: "PNG chunk, JSON, or .charx/.risum zip", color: "clay" },
      { label: "One tolerant parse", sub: "JSON.parse / chunk read, try-catch to null", color: "ochre" },
      { label: "Bounded unzip", sub: "size + entry + count caps before inflate", color: "ochre" },
      { label: "Canonical body + escrow twin", sub: "scripts land as data, raw sealed under original.<format>", color: "sage" },
      { label: "Operator opens Test Bench", sub: "explicit click; never on import or convert", color: "teal" },
      { label: "Worker sandbox", sub: "see script-sandbox.md for the run itself", color: "plum" },
    ],
  },
};
