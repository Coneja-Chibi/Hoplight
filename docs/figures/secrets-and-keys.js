// ─────────────────────────────────────────────────────────────
// secrets-and-keys.js - figure data for
// docs/reference/security/secrets-and-keys.md, keyed by figure id
// (drop a figure in with a line like `@fig defenses`; this is the
// data behind that id). Edit the shape/labels here; edit the words
// in the .md.
// Grounded in src/ui/server-security.ts (checkApiRequest, the
// Host/Origin/token gate), src/ui/sandbox-host.ts (the distinct
// sandbox origin), docs/decisions/ADR-009-sandbox-origin.md (what
// is and is not measured), and specs/engine/key-vault.md (the
// still-unbuilt BYOK vault). The right column is the honesty column:
// where each layer is actually proven.
// ─────────────────────────────────────────────────────────────

export default {
  defenses: {
    type: "matrix",
    fig: "fig 01",
    title: "each layer, and where it is proven",
    caption:
      "The loopback server layers are shipping code with automated Bun tests. The two highlighted " +
      "rows are the honest gaps: the key vault is a draft M2 spec with no code yet, and packaged " +
      "WebView2 origin isolation is unmeasured (Plan 017 BLOCKED). Nothing here is claimed fully " +
      "isolated.",
    cols: ["Enforced by", "Proven where"],
    rows: [
      { label: "Loopback bind", cells: ["Bun.serve on 127.0.0.1 only", "Bun test"] },
      { label: "Host gate (/api/*)", cells: ["exact host:port, or a loopback alias on the same port", "Bun test"] },
      { label: "Mutation gate (POST)", cells: ["loopback Origin, plus a per-launch bearer via timingSafeEqual", "Bun test"] },
      { label: "Read gate (GET/HEAD)", cells: ["Host, plus Sec-Fetch-Site is not cross-site (no token)", "Bun test"] },
      { label: "Body caps", cells: ["streamed cap, 64MB inspect / 32MB JSON", "Bun test"] },
      { label: "Sandbox origin", cells: ["second ephemeral loopback listener, distinct origin", "Bun HTTP layer only"] },
      { label: "Packaged WebView isolation", cells: [{ v: "WebView2 runtime", hi: true }, { v: "NOT MEASURED, Plan 017 BLOCKED", hi: true }] },
      { label: "Key vault storage", cells: [{ v: "OS keychain, else AES-256-GCM file", hi: true }, { v: "SPEC only, M2, unbuilt", hi: true }] },
    ],
  },
};
