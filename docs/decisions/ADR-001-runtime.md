# ADR-001: Runtime — Bun + TypeScript, Node-compatible core

**Status:** accepted

## Decision

TypeScript everywhere. Bun is the toolchain: dev runtime, test runner (`bun test`),
bundler, and `bun build --compile` produces the single-file executables that are our
primary distribution. Core packages (`core`, `formats`, `lore`, `presets`, `macros`,
`regexkit`, `assembly`) must not use Bun-only APIs: they stay runnable under Node so
they can be published to npm and embedded by other tools. `apps/*` and `agent`/`ai`
may use Bun APIs where they matter (spawn, file IO speed, compile).

## Why

- The #1 stated distribution goal is "one file, no install pain" (the anti-ST-setup
  answer). `bun build --compile` is the most direct path on all three OSes.
- TypeScript because the entire extraction surface from VAUDEVILLE is TS, and because
  zod schemas double as both validation and documentation for implementing agents.
- Node-compat core keeps the npm/embedding door open and de-risks Bun (if Bun ever
  stalls, only apps need porting).

## Consequences

- CI runs core package tests under BOTH Bun and Node.
- A lint rule bans `bun:*` imports inside `packages/` except an allowlist
  (`ai`, `agent`).
