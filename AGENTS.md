# AGENTS.md

Instructions for AI agents (and new humans) working in this repo. Read this whole file before
writing any code.

## 1. Read first, in this order

| # | File | Why it's required |
| --- | --- | --- |
| 1 | [docs/01-VISION.md](docs/01-VISION.md) | What this product is and is not |
| 2 | [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | The canonical model and how adapters hang off it |
| 3 | [docs/03-CONVENTIONS.md](docs/03-CONVENTIONS.md) | Code style and the rules the hooks enforce |
| 4 | [CONTRIBUTING.md](CONTRIBUTING.md) | Ground rules, including AI-model disclosure on PRs |
| 5 | [docs/reference/components.md](docs/reference/components.md) | **Before building ANY UI control.** If a control exists, you reuse it |
| 6 | [docs/reference/ui.md](docs/reference/ui.md) | Every studio surface, documented truthfully |
| 7 | [docs/reference/architecture.md](docs/reference/architecture.md) | The reference map of the source tree |
| 8 | [docs/decisions/](docs/decisions/ADR-001-runtime.md) | ADR-001 through ADR-009; do not relitigate a decided ADR |

Working on a format adapter? Also read [docs/FORMAT-SUPPORT.md](docs/FORMAT-SUPPORT.md), the
relevant page under [docs/reference/formats/](docs/reference/formats/README.md), and
`src/formats/_template/`.

## 2. Hard rules

Violating any of these gets the work rejected, no matter how good it otherwise is.

1. **Hub and spoke only.** Every format maps to and from the canonical model
   (`src/core/canonical.ts`). Never write a format-to-format conversion.
2. **Escrow is sacred.** The original imported file rides inside the saved piece. Nothing you
   write may drop, rewrite, or "clean up" escrowed originals. Same-format round trips stay
   byte-honest; CI has a suite that checks.
3. **Scripts never execute.** Lua, macros, regex payloads, anything executable inside a card is
   sealed data. The single exception (the test bench) runs in the wasmoon VM on the isolated
   sandbox origin per [ADR-009](docs/decisions/ADR-009-sandbox-origin.md); do not add a second
   exception.
4. **Folders are the schema.** Apps, format adapters, settings sections, deck views, wizard
   steps, and tours are drop-in folders. Never register anything in a central list when a
   drop-in folder is possible.
5. **No hardcoded colors.** Every color comes from `src/ui/theme/tokens.css`. A genuine one-off
   needs a `hardcode-ok` comment on the same line. The guard blocks everything else.
6. **500 lines per file, maximum.** Split by concept, don't grandfather. The guard blocks it.
7. **One concept per file; shared logic extracted exactly once** (into `_shared/`). Duplication
   is a bug.
8. **Fail closed.** Untrusted input is parsed once into a known type; anything unreadable is
   rejected at the boundary. Detectors return empty on bad input instead of throwing.
9. **No em dashes in prose.** Docs, UI copy, commit messages, comments. The prose gate blocks
   them. No emojis in app UI copy either (README is the exception).
10. **Docs move with the code.** A change to any surface updates its page under
    `docs/reference/` in the same commit, truth-based, never aspirational.
11. **Commits carry proof.** Every commit needs a test or a `Verified:` line describing how the
    change was actually checked. The hook enforces this. Never bypass hooks (`--no-verify` is
    forbidden).
12. **UI collapse is container-based.** Panels adapt via `@container` queries on the pane they
    live in, never viewport media queries.

## 3. Gates: run before you claim anything is done

```bash
bun run verify:ci     # the whole wall: everything below, in order
```

Or individually while iterating:

| Command | What it checks |
| --- | --- |
| `bun run typecheck` | tsc, strict, no emit |
| `bun run test` | ~1,950 tests: engine, codecs, round-trip law, store, server, UI cores |
| `bun run scan:lines` | 500-line file cap |
| `bun run scan:colors:check` | no hardcoded colors outside the token sheet |
| `bun run scan:emdash` | no em dashes in prose |
| `bun run scan:links` | no dead markdown links |
| `bun run lint:ui` | eslint on the React shell, zero warnings |
| `bun run catalog:check` | docs/reference/components.md matches the component folders |
| `bun run matrix:check` | docs/FORMAT-SUPPORT.md matches the live format registry |
| `bun run license:audit` | no copyleft/restricted dependencies |

A red gate is a stop sign, not a suggestion. Fix the cause; never weaken the gate.

## 4. Verification standard

- Red test first, then green: a bug fix starts with a test that fails without it.
- UI work gets verified live in the running studio (`bun run dev`, loopback), not by reading the
  code and hoping. Server-side changes need the dev server restarted before checking.
- Claims about behavior are labeled honestly: code-read, unit-proven, or live-proven. Only the
  last one counts as done for user-facing behavior.

## 5. Repo layout, thirty seconds

```
src/core        engine: canonical model, detection, coverage, lore/regex/macro
src/entities    per-kind canonical schemas
src/formats     one drop-in folder per platform (+ _template, _shared, _fixtures)
src/studio      local-first storage: atomic writes, path containment
src/sandbox     sealed-script analysis; wasmoon test bench
src/ui          loopback server + React studio (shell/, apps/, components/)
src/cli.ts      the same engine, argv-shaped
scripts/hooks   the gate implementations
docs/           the truth; reference/ is per-surface, decisions/ are ADRs
specs/          engine and feature specs for planned milestones
samples/        real platform files the tests chew on
```

## 6. Security posture

Read [SECURITY.md](SECURITY.md). If your change touches the server, paths, parsing, archives, or
anything sandbox-adjacent, the relevant tests (`src/ui/server.test.ts`, `src/studio/path-policy.test.ts`,
`src/sandbox/`) must grow with it.
