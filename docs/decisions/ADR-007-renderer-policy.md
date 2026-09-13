# ADR-007: Renderer policy (shell vanilla, per-app freedom, chat surfaces re-evaluated at spec time)

**Status:** accepted · 2026-07-05
**Context owners:** the shell (`src/ui/`), every app folder, the future Table Read and agent surfaces

## Context

The shell and the current surfaces (Library, Workbench editor, Press, Settings, setup) are
hand-built vanilla TS + DOM: no framework, five runtime dependencies, one compiled exe
(ADR-001, ADR-003). The roadmap ALSO promises chat-shaped surfaces: the M4 Table Read
(a conversational interview engine) and the agent system (`packages/agent`, REPL, test chat),
with a Studio rendering surface later (M6). Chat runtimes are the classic React-shaped
problem (streaming state, live lists), and comparable ecosystem apps (RoleCall, Marinara
Engine, Lumiverse's frontend) all render chat with React 19.

Two facts keep this from being a stack war:

1. The Table Read spec locks its engine as UI-agnostic: "zero rendering code," one event
   protocol driven identically by the CLI and the Studio app. The agent packages follow the
   same rule (docs/02-ARCHITECTURE: the studio may not own private engine capabilities).
   Renderer choice therefore never touches engine design.
2. The app contract (`manifest` + `mount(ctx)`) is renderer-agnostic. An app folder may
   bundle its own rendering library internally; the shell neither knows nor cares.

## Decision

- The SHELL and the editor/shelf-class surfaces stay vanilla TS + DOM. Their state
  complexity is form/card-shaped and does not justify a framework runtime.
- Every app folder has RENDERER FREEDOM: bundling a framework inside one app is an add,
  not a rewrite, and requires no shell change.
- When the Table Read surface and the agent/chat surface reach implementation, their spec
  MUST include a renderer assessment against these criteria, with React explicitly on the
  table for that surface:
  - sustained streaming updates across many live regions at once,
  - long virtualized lists (message history at scale),
  - deep interactive state webs (many components reacting to shared live state),
  - concrete component-ecosystem needs (e.g. an editor widget that would be vendored).
  If two or more criteria hold, the default for THAT surface is React (Bun transpiles TSX
  natively; the bundle bakes into the exe like any app). If not, vanilla, with the event
  protocol keeping a later swap cheap.
- Engines never acquire a renderer dependency under any outcome.

## Consequences

- No restart scenario exists: every layer built to date (converter, canonical model,
  engines, shell, editors, tokens/CSS) serves both renderer outcomes unchanged.
- The repo may eventually carry two rendering idioms, isolated per app folder. That cost
  is accepted and bounded by folders-as-schema.
- This ADR is the standing answer to "should Studios be React": the question is only ever
  asked per-surface, with written criteria, at the moment the surface is specced.
