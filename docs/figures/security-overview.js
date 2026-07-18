// ─────────────────────────────────────────────────────────────
// security-overview.js - figure data for docs/reference/security/README.md,
// keyed by figure id (flat map; the page drops a figure in with a line like
// `@fig routes` or `@fig status`; this is the data behind that id). Edit the
// shape/labels here; edit the words in the .md.
// Grounded in src/core/archive.ts, src/core/regex/validate.ts + apply.ts,
// src/ui/_shared/render-markup.ts, src/sandbox/lua/*, src/ui/server-security.ts,
// docs/decisions/ADR-009-sandbox-origin.md, specs/engine/key-vault.md.
// Kinds match docs/figures shapes: matrix = cols + rows[{ label, cells }].
// ─────────────────────────────────────────────────────────────

export default {
  // Each untrusted input meets ITS OWN gate. Nothing traverses all layers in series:
  // a zip hits archive caps, a regex hits the ReDoS gate, field text hits DOMPurify,
  // Lua hits the sandbox. Only Lua runs code, and only on an explicit Test Bench run.
  routes: {
    type: "matrix",
    fig: "fig 01",
    title: "each untrusted input, its own gate",
    caption:
      "vaud does not funnel every input through one pipeline. Each kind of untrusted content meets " +
      "the gate built for it. Import and conversion never execute a card's scripts; the only code " +
      "that runs is Lua, sandboxed, and only when the user opens the Test Bench.",
    cols: ["Entry gate", "Handling", "Runs code?"],
    rows: [
      {
        label: "PNG / JSON card",
        cells: ["adapter detect + toCanonical", "scripts kept in escrow as data", { v: "no", hi: true }],
      },
      {
        label: "ZIP / charx / byaf",
        cells: ["unzipBounded caps", "bounded inflate, then parse", { v: "no", hi: true }],
      },
      {
        label: "Regex rule",
        cells: ["validateRule pre-compile", "refused if bomb-shaped; timed match loop", { v: "no eval", hi: true }],
      },
      {
        label: "Field markup",
        cells: ["200k input cap", "marked then DOMPurify, sanitize last", { v: "no", hi: true }],
      },
      {
        label: "Lua script",
        cells: ["Test Bench, explicit run", "hardened VM, worker kill, budgets", { v: "yes, sandboxed", hi: true }],
      },
    ],
  },

  // The honest status map. Third column is meaningful only for the origin-isolation row:
  // the code-layer defenses are host independent, so "not applicable" is honest, not a dodge.
  status: {
    type: "matrix",
    fig: "fig 02",
    title: "defense layers and their honest status",
    caption:
      "What each layer enforces, whether it has a code-layer suite, and whether it is proven in the " +
      "packaged Windows host. Two rows are not fully green on purpose: distinct-origin isolation is " +
      "proven only at the HTTP layer (packaged WebView2 probe BLOCKED, ADR-009), and the key vault is " +
      "a draft spec with no implementation in the tree.",
    cols: ["Enforced in", "Code-layer suite", "Packaged-host proof"],
    rows: [
      { label: "Parse, not execute", cells: ["core adapters + escrow", true, "not applicable"] },
      { label: "Archive caps", cells: ["core/archive.ts", true, "not applicable"] },
      { label: "ReDoS gate", cells: ["regex/validate.ts", true, "not applicable"] },
      { label: "Sanitized render", cells: ["ui/_shared render", true, "not applicable"] },
      { label: "Lua resource budgets", cells: ["sandbox/lua limits", true, "not applicable"] },
      { label: "Value-only wire", cells: ["sandbox/lua protocol", true, "not applicable"] },
      { label: "Loopback token gate", cells: ["ui/server-security", true, "not applicable"] },
      {
        label: "Distinct-origin isolation",
        cells: ["dual loopback listener", { v: "HTTP layer only", hi: true }, { lvl: 0, v: "BLOCKED" }],
      },
      {
        label: "BYOK key vault",
        cells: [{ v: "spec only, M2", hi: true }, { lvl: 0, v: "not built" }, { lvl: 0, v: "not built" }],
      },
    ],
  },
};
