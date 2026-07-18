// ─────────────────────────────────────────────────────────────
// safe-rendering.js - figure data for docs/reference/security/
// safe-rendering.md, keyed by figure id (flat map: the page drops a
// figure in with a line like `@fig boundaries`; this is the data
// behind that id). Edit the shape/labels here; edit the words in
// the .md. Grounded in src/ui/_shared/{render-markup,render-policy}.ts,
// src/ui/components/sealed-html-preview/{index,backdrop-css}.ts,
// src/ui/server-security.ts, and docs/decisions/ADR-009-sandbox-origin.md.
// ─────────────────────────────────────────────────────────────

export default {
  boundaries: {
    type: "matrix",
    fig: "fig 01",
    title: "two surfaces, enforced where, proven where",
    caption:
      "Prose fields and the card backdrop preview run different DOMPurify configs because they sit " +
      "behind different boundaries: prose fields have only the ambient app CSP, the backdrop preview " +
      "adds a sandboxed srcdoc iframe with its own scoped CSP. Every row is verified at the string or " +
      "jsdom level; none is verified against a live browser or the packaged WebView2 host.",
    cols: ["Enforced by", "Proven where"],
    rows: [
      {
        label: "Prose fields (description, greeting, notes)",
        cells: [
          "DOMPurify tag/attribute strip + ambient app CSP (script-src self, no unsafe-inline; connect-src self)",
          "jsdom DOM assertions (render-markup.test.ts) + HTTP header assertion (server.test.ts)",
        ],
      },
      {
        label: "Backdrop HTML (behavior.backgroundHTML)",
        cells: [
          "DOMPurify tag/attribute strip + sandboxed srcdoc iframe (sandbox empty, no allow-same-origin) + scoped CSP",
          "jsdom DOM + srcdoc string assertions (sealed-html-preview.test.ts)",
        ],
      },
      {
        label: "Backdrop CSS (behavior.backgroundCSS)",
        cells: [
          "Regex strip (import, remote url(), font-face, expression, close-style breakout) + the same scoped CSP",
          "Unit tests on regex output only; not a CSS parser by the module's own comment",
        ],
      },
      {
        label: "Packaged WebView2 host",
        cells: [
          "Same sandboxed-iframe and CSP code path ships as-is, no packaged-specific handling",
          "Not measured for this component; ADR-009 records the analogous gap for the Lua-worker origin boundary, Plan 017 BLOCKED",
        ],
      },
    ],
  },
};
