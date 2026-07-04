# Conventions

Binding for all code and docs in the product repo. Implementing agents: deviations
fail review.

## Code

- TypeScript strict mode. No `any` except at codec boundaries parsing untrusted
  input, and then immediately narrowed by a zod schema.
- zod schemas are the single source of truth for shapes; TS types derive via
  `z.infer`. No hand-written interface that duplicates a schema.
- Core packages: no Bun-only APIs (ADR-001), no side effects at import time, no
  singletons. Everything injectable and testable.
- Errors: typed error classes per package (`FormatError`, `CodecError`,
  `ProviderError`) with a `userMessage` field written for humans. Never throw strings.
- No emojis anywhere: code, comments, CLI output, docs, UI copy. Unicode ornaments
  (`+ - · ✦`) are the house glyphs. No em dashes in user-facing copy.
- File naming: kebab-case files, PascalCase types, camelCase values.

## Testing law

- Test runner: `bun test` (core packages must also pass under Node in CI).
- **The fixture corpus is sacred.** `fixtures/<format>/<case>/` holds a real input
  file + `expected.json` (canonical parse) + notes. New codec behavior requires a
  fixture demonstrating it. Never edit a fixture input to make a test pass.
- **The Round-Trip Law:** every codec has property-style tests asserting
  parse -> serialize(same format) is semantically identical for EVERY fixture of that
  format. CI-blocking from M0 onward.
- Regression firewall: capture a green baseline before any fix; a fix that turns any
  passing test red is rejected, no matter how right it feels.
- Deterministic tests only: no network, no clock, no randomness without a seed.

## CLI conventions

- Every command supports `--json` (machine-readable result to stdout, logs to stderr)
  and meaningful exit codes (0 ok, 1 user error, 2 internal error).
- Destructive operations require `--yes` or interactive confirmation.
- Output vocabulary is plain first, theatrical second: "converted 3 files" not
  "the curtain rises on 3 files." Flavor lives in the agent personas, not in
  scriptable command output.

## Git & repo

- Conventional commits (`feat(formats): ...`, `fix(lore): ...`).
- One ticket = one branch = one PR. PR description links the ticket file.
- CI gates: typecheck, lint, core tests under Bun + Node, round-trip suite,
  binary-build smoke test.

## Docs

- Every package has a README with: purpose, public API sketch, and its spec links.
- Specs are law; if implementation must diverge, the spec PR comes first.
