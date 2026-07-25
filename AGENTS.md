<div align="center">

<img src="docs/media/vaudeville-v.png" alt="" width="56">

<sub>· A CONEJA-CHIBI PRODUCTION ·</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hoplight-wordmark-dark.png">
  <img src="docs/media/hoplight-wordmark-light.png" alt="Hoplight" width="320">
</picture>

</div>

---
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
| 8 | [docs/decisions/](docs/decisions/ADR-001-runtime.md) | ADR-001 through ADR-009: the consequential choices and their reasoning. If you disagree with one, raise it in an issue rather than coding around it |

## 2. Specs: which ones govern your work

The `specs/` tree is the detailed contract for each area. Match your task to its specs before
starting; they answer most design questions so you don't have to guess.

| If you're touching... | Read these specs |
| --- | --- |
| Any format adapter | [specs/formats/canonical-model.md](specs/formats/canonical-model.md), [specs/formats/content-detection.md](specs/formats/content-detection.md), plus the format's own spec below |
| SillyTavern / CCv2 / CCv3 cards | [specs/formats/chara-card-v2.md](specs/formats/chara-card-v2.md), [specs/formats/chara-card-v3.md](specs/formats/chara-card-v3.md), [specs/formats/png-embedding.md](specs/formats/png-embedding.md), [specs/formats/charx.md](specs/formats/charx.md) |
| Lorebooks / world info | [specs/formats/st-worldinfo.md](specs/formats/st-worldinfo.md), [specs/formats/rolecall-lorebook.md](specs/formats/rolecall-lorebook.md), [specs/engine/lorebook-engine.md](specs/engine/lorebook-engine.md) |
| Presets | [specs/formats/st-preset.md](specs/formats/st-preset.md), [specs/formats/lumiverse-preset.md](specs/formats/lumiverse-preset.md) |
| Personas | [specs/formats/personas.md](specs/formats/personas.md), [specs/features/personas-system.md](specs/features/personas-system.md) |
| Regex sets | [specs/formats/regex-scripts.md](specs/formats/regex-scripts.md) |
| RoleCall | [specs/formats/rolecall-character.md](specs/formats/rolecall-character.md), [specs/formats/rolecall-lorebook.md](specs/formats/rolecall-lorebook.md) |
| Backyard | [specs/formats/backyard.md](specs/formats/backyard.md) |
| Import of multi-piece files | [specs/formats/bundle-import.md](specs/formats/bundle-import.md) |
| Lumiverse data archives (.lvbak) | [specs/formats/lumiverse-archive.md](specs/formats/lumiverse-archive.md), [specs/formats/bundle-import.md](specs/formats/bundle-import.md), [specs/formats/lumiverse-preset.md](specs/formats/lumiverse-preset.md) |
| Macros | [specs/engine/macro-engine.md](specs/engine/macro-engine.md) |
| Token estimates | [specs/engine/token-counting.md](specs/engine/token-counting.md) |
| Prompt assembly | [specs/engine/prompt-assembly.md](specs/engine/prompt-assembly.md) |
| Future-milestone features (Script Doctor, Table Read, the agent, productions...) | The matching file under [specs/features/](specs/features/) and [specs/engine/](specs/engine/); these are design contracts even though the code doesn't exist yet |

Working on a format adapter? Also read [docs/FORMAT-SUPPORT.md](docs/FORMAT-SUPPORT.md), the
relevant page under [docs/reference/formats/](docs/reference/formats/README.md), and start from
`src/formats/_template/`.

## 3. Project rules

These apply to every change. Work that breaks one will be sent back, so read them before
starting.

1. **Hub and spoke only.** Every format maps to and from the canonical model
   (`src/core/canonical.ts`). Never write a format-to-format conversion.
2. **Never modify escrowed originals.** The parsed source snapshot and unmapped source fields are
   stored inside the saved piece. Code must not drop, rewrite, or reformat that escrow. Same-format
   round trips satisfy the semantic Round-Trip Law; byte identity is required only where the format
   spec explicitly declares a byte-level tier and fixtures prove it.
3. **Imported scripts stay sealed.** Lua, macros, and regex payloads are data at every import and
   conversion boundary. Execution is only user-invoked inside the Lua or regex test bench: Lua runs
   in wasmoon and regex runs in a terminable worker, both on the isolated sandbox origin described by
   [ADR-009](docs/decisions/ADR-009-sandbox-origin.md). Do not add another execution path.
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
9. **Docs move with the code.** A change to any surface updates its page under
   `docs/reference/` in the same commit, truth-based, never aspirational.
10. **Changes carry proof.** Bug fixes and features include tests or documented verification in the
    PR or handoff. Commit messages need no special trailer. Don't bypass hooks.
11. **UI collapse is container-based.** Panels adapt via `@container` queries on the pane they
    live in, never viewport media queries.

## 4. Gates: run before you claim anything is done

```bash
bun run verify:ci     # the complete Bun/TypeScript wall: everything below, in order
```

Or individually while iterating:

| Command | What it checks |
| --- | --- |
| `bun run typecheck` | tsc, strict, no emit |
| `bun run test` | ~2,000 tests: engine, codecs, round-trip law, store, server, UI cores |
| `bun run test:node-core` | bundle the public core and execute its smoke test in Node |
| `bun run scan:lines` | 500-line file cap |
| `bun run scan:colors:check` | no hardcoded colors outside the token sheet |
| `bun run scan:emdash` | no em dashes in prose |
| `bun run scan:headers` | every authored TS/TSX file opens with a purpose docblock |
| `bun run scan:emoji` | no emoji pictographs in authored TS/TSX code |
| `bun run scan:links` | no dead markdown links |
| `bun run lint:ui` | eslint on the React shell, zero warnings |
| `bun run catalog:check` | docs/reference/components.md matches the component folders |
| `bun run matrix:check` | docs/FORMAT-SUPPORT.md matches the live format registry |
| `bun run license:audit` | no copyleft/restricted dependencies |

Pre-commit runs fast checks against staged files. Pre-push runs the full typecheck and supported test
suite. CI remains authoritative: its required `test` check runs `verify:ci` and independently vets,
tests, and builds the Go sidecar with the version pinned in `sidecar/go.mod`. The Go gate stays outside
`verify:ci` so contributors working outside the remote-access sidecar do not need a Go toolchain.

If a gate fails, fix the cause. Don't modify the gate.

## 5. Verification standard

- Red test first, then green: a bug fix starts with a test that fails without it.
- UI work gets verified live in the running studio (`bun run dev`, loopback), not by reading the
  code and hoping. Server-side changes need the dev server restarted before checking.
- Claims about behavior are labeled honestly: code-read, unit-proven, or live-proven. Only the
  last one counts as done for user-facing behavior.

## 6. Repo layout

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

## 7. Security posture

Read [SECURITY.md](SECURITY.md). If your change touches the server, paths, parsing, archives, or
anything sandbox-adjacent, the relevant tests (`src/ui/server.test.ts`, `src/studio/path-policy.test.ts`,
`src/sandbox/`) must grow with it.
