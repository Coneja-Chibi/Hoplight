# ADR-004: Code reuse — extract and adapt from VAUDEVILLE

**Status:** accepted (Chi, 2026-07-02)

## Decision

Lift the format/engine code Chi already wrote for RoleCall out of the VAUDEVILLE
monorepo into this project, and evolve it freely here. Chi owns the copyright on
both sides; there is no legal conflict, and the AGPL choice (ADR-002) does not bind
the copyright holder.

What gets extracted (full file-level map in `docs/05-EXTRACTION-MAP.md`):

- `packages/presets-core` -> `packages/presets` (ST preset parse/serialize +
  Lumiverse converter). Already dependency-clean by design.
- `packages/lorebook` -> `packages/lore` (types, validation, format detection,
  parser/serializer, diff engine, regex-utils) — regex-utils moves to `regexkit`.
- `apps/rc/src/lib/library/png-parser.ts` + `lib/formats/png/writer.ts` +
  `lib/formats/character/*` + `lib/imports/content-detector.ts` +
  `lib/library/json-parsers.ts` -> `packages/formats`.
- `apps/rc/src/lib/macros/tokenizer.ts` (+ registry/types subset) -> `packages/macros`.
- `apps/rc/src/lib/regex/builder-core.ts` -> `packages/regexkit`.

What does NOT get extracted: anything touching Supabase, RC's DB models, RC UI
components, the Orison implementation itself (its *lessons* are in ADR-006 and
`02-ARCHITECTURE.md`; its code is RC-entangled).

## Rules for extraction tickets

1. Copy, then adapt: strip `@/` app imports, replace RC types with `core` types,
   keep the original algorithm intact on the first pass.
2. Port the tests too. VAUDEVILLE's characterization corpora (macro tests, lorebook
   round-trip tests) are more valuable than the code.
3. Every extracted module gets a header noting origin (`Extracted from VAUDEVILLE
   <path> @ <date>`), because the two lineages WILL drift and future-Chi needs to
   know they're cousins, not mirrors.
4. Direction of flow is one-way (VAUDEVILLE -> here). If a bug is fixed here that
   exists there, note it in a `BACKPORTS.md` for Chi.
