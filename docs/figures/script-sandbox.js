// ─────────────────────────────────────────────────────────────
// script-sandbox.js - figure data for docs/reference/security/
// script-sandbox.md, keyed by figure id (flat map: the page drops a
// figure in with a line like `@fig lifecycle`; this is the data
// behind that id). Edit the shape/labels here; edit the words in
// the .md. Grounded in src/sandbox/lua/{run-in-worker,worker,
// protocol,limits,engine}.ts and docs/decisions/ADR-009-sandbox-origin.md.
// ─────────────────────────────────────────────────────────────

export default {
  lifecycle: {
    type: "flow",
    fig: "fig 01",
    title: "one run, control by control",
    caption:
      "A card script is inert data until the operator puts it on the Test Bench; nothing on import " +
      "runs it. When it does run, each stage below enforces its own ceiling independently, so a " +
      "message that lies about its budget is re-clamped at the next stage rather than trusted. The " +
      "worker is on a distinct loopback origin (ADR-009), and the per-launch API token never crosses " +
      "the wire.",
    steps: [
      { label: "Script as data", sub: "never auto-runs; Test Bench only", color: "clay" },
      { label: "Pre-send checks", sub: "source cap, state budget, wire cap", color: "ochre" },
      { label: "Worker on sandbox origin", sub: "distinct port; no token on wire", color: "sage" },
      { label: "Worker re-clamps", sub: "budgets re-resolved from the message", color: "teal" },
      { label: "Hardened Lua VM", sub: "opt-in libs, heap + timeout caps", color: "plum" },
      { label: "Validate then terminate", sub: "value-only reply, response cap", color: "rose" },
    ],
  },
  assurance: {
    type: "matrix",
    fig: "fig 02",
    title: "enforced where, proven where",
    caption:
      "The honest posture: the resource, protocol, token-absence, and handler-allowlist layers are " +
      "enforced and unit-tested. Distinct-origin isolation is implemented and tested at the Bun " +
      "HTTP/handler layer only. The packaged WebView2 host is not yet measured, so Plan 017 is " +
      "BLOCKED and full isolation is not claimed.",
    cols: ["Enforced by", "Proven in"],
    rows: [
      {
        label: "Worker kill switch",
        cells: ["host terminate + in-VM timeout", "automated (Bun)"],
      },
      {
        label: "Resource budgets",
        cells: ["clamp + byte caps, three layers", "automated (unit)"],
      },
      {
        label: "Value-only wire protocol",
        cells: ["parse both directions, fail closed", "automated (unit)"],
      },
      {
        label: "Token absence on the wire",
        cells: ["forbidden-key allowlist", "automated (unit)"],
      },
      {
        label: "Sandbox-host allowlist",
        cells: ["worker + wasm only; /api returns 404", "automated (Bun HTTP)"],
      },
      {
        label: "Distinct loopback origin",
        cells: ["second listener, ephemeral port", "Bun HTTP layer only"],
      },
      {
        label: "Packaged WebView2 origin isolation",
        cells: ["not measured", "BLOCKED (Plan 017)"],
      },
      {
        label: "Shared storage / crossOriginIsolated in WebView",
        cells: ["not measured", "BLOCKED (Plan 017)"],
      },
      {
        label: "Credentialed API fetch from sandbox origin",
        cells: ["not measured", "BLOCKED (Plan 017)"],
      },
    ],
  },
};
