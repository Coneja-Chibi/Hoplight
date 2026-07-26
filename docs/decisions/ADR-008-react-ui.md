# ADR-008: React UI layer for structural rendering safety

**Status:** accepted · 2026-07-05
**Supersedes:** ADR-007's "decide per chat surface later." ADR-007's engine rule is carried
forward unchanged and hardened here.

## Context

Two constraints crystallized after ADR-007:

1. Hoplight renders untrusted card text and extension fields. Direct DOM construction makes
   HTML-sink safety depend on every caller following convention. React escapes text by default,
   while repository gates can ban the small set of explicit escape hatches.
2. The roadmap's chat/agent surfaces (M4 Table Read, packages/agent, Studio app) plus the
   per-surface agent-context plan require UI state to be serializable data an agent can
   read and act through. Closure-held vanilla DOM state is agent-opaque; store-driven
   React state is the pattern comparable production apps (Marinara Engine, the Lumiverse
   frontend) ship.

## Decision

- The UI layer is React 19 + TSX, transpiled natively by Bun (no Vite, no Next), bundled
  into the same single exe.
- State is Zustand: one shell store plus one store per app surface. Navigation is
  state-driven; there is NO URL router.
- Styling is CSS Modules over the existing token system. NO Tailwind.
- The UI converts WHOLE - shell and every app folder - one idiom, no permanent mixed
  zone. Until the conversion lands, the vanilla surfaces remain the behavioral spec.
- The app contract v2 is a React component export plus manifest, including an
  `agentSurface` descriptor (state selector + offered actions) so every surface,
  first-party or drop-in, is agent-readable by construction.
- ENGINE RULE (unchanged, hardened): the converter, canonical model, engines, and every
  `*-core.ts` stay pure framework-less TS. A renderer import in that layer is a guardrail
  violation, not a style choice.
- Dependency posture: react, react-dom, and zustand are direct dependencies covered by the
  repository's license audit. New dependencies follow normal review; no special commit trailer is
  enforced.
- `dangerouslySetInnerHTML` and raw HTML-injection sinks are banned by the repo gates
  outside an explicit sanctioned allowlist.

## Consequences

- Editor slice 1 and the current shell are rebuilt in React during the conversion; their
  behavior and their pure cores (tested) are the spec, so the rewrite is bounded.
- Ordinary text rendering is escaped by default; repository gates separately enforce the raw-HTML
  escape-hatch ban.
- React's established tooling and contributor familiarity reduce the cost of maintaining the UI.
- The framework-churn risk (React major versions) is accepted and bounded: the engine
  layer is immune, and surfaces are isolated per app folder.
