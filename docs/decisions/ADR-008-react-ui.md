# ADR-008: React UI layer under the vibecoding constraint (supersedes ADR-007's deferral)

**Status:** accepted · 2026-07-05
**Supersedes:** ADR-007's "decide per chat surface later." ADR-007's engine rule is carried
forward unchanged and hardened here.

## Context

Two constraints crystallized after ADR-007:

1. This codebase is primarily AI-authored ("vibecoded"), and the 2025 evidence on
   AI-generated code is specific: XSS is the dominant AI failure class (~86% of relevant
   samples fail XSS defenses; 2.74x human rate), and models are measurably most fluent in
   the largest-corpus UI framework (React). An auto-escaping renderer closes the top
   vulnerability class structurally instead of by convention.
2. The roadmap's chat/agent surfaces (M4 Table Read, packages/agent, Studio app) plus the
   per-surface agent-context plan require UI state to be serializable data an agent can
   read and act through. Closure-held vanilla DOM state is agent-opaque; store-driven
   React state is the pattern both local reference apps (Marinara Engine, Lumiverse
   frontend) ship in production.

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
- Dependency posture: react, react-dom, zustand join the vetted set. Every further
  dependency addition must be declared in the commit message (mechanically gated).
- `dangerouslySetInnerHTML` and raw HTML-injection sinks are banned by the repo gates
  outside an explicit sanctioned allowlist.

## Consequences

- Editor slice 1 and the current shell are rebuilt in React during the conversion; their
  behavior and their pure cores (tested) are the spec, so the rewrite is bounded.
- The XSS class is closed by default rendering behavior; the gates enforce the escape
  hatch ban and the dependency ledger.
- Agent fluency and OSS contributor familiarity align with the codebase's authoring mode.
- The framework-churn risk (React major versions) is accepted and bounded: the engine
  layer is immune, and surfaces are isolated per app folder.
