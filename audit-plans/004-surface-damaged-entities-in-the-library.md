# Plan 004: Surface damaged entities in the library

> Executor contract: Read the entire plan. Follow steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition.
> Report deviations instead of silently improvising.

## Status

- Priority: P4
- Category: UX/data
- Effort: M
- Risk: LOW-MEDIUM (touches the store contract and its OPFS twin)
- Depends on: none
- Planned at: commit `80451e6`, 2026-07-24 (revised same day after adversarial review)
- Finding: UX-01 in AUDIT.md

## Outcome

A studio entity file that exists on disk but cannot be read (corrupt JSON, schema rejection, kind
or id mismatch) is visible in the library as a damaged item with its filename and a plain-language
reason, instead of silently disappearing. Healthy entities keep rendering exactly as today.

## Why this matters

Hoplight's pillar is local-first: the files are the user's. Today `StudioStore.list()` swallows
every per-file failure (`src/studio/store.ts:111-113` `catch { continue; }`), `read()` collapses
all causes into `StudioReadError("corrupt entity file")` (store.ts:124-146), and the character
schema requires all eight body groups (`src/entities/runtime-schema.ts:37-102`), so a hand-edited
or partially synced file fails whole-cloth. The user sees their card missing with no signal that
the bytes still exist and are recoverable. Doctrine says storage and validation failures are
reported honestly; fail closed must not mean fail invisibly.

## Proven root cause

Code-read, mechanism certain: the skip happens in `list()` at store.ts:111-113 (read failures) and
at store.ts:89-93 (ids failing `assertSafeStudioId` are skipped by design; `.tmp-*` orphans land
here and MUST stay hidden). Nothing upstream (`/api/studio/list`, `src/ui/server.ts:326-332`) or
downstream (library app) ever learns a file was skipped.

## Current architecture and authority

- Authority for listings: `StudioStore.list(kind?)` returning `EntitySummary[]`
  (src/studio/store.ts:23-32, 78-117).
- Contract consumed through `StudioStoreLike` (`src/studio/contracts.ts`) by the server routes and
  by the OPFS pocket twin (`src/studio/opfs/`, P1c work "the OPFS StudioFs twin"). The twin shares
  `StudioStore` over a different `StudioFs` backend, so changes to `list()` itself cover both; the
  contract file changes only if the method signature grows.
- UI: `/api/studio/list` -> library app (`src/ui/apps/library/index.tsx`, views under
  `src/ui/apps/library/views/`).
- Reuse rule: shared controls come from `docs/reference/components.md`; the catalog has no
  generic notice component, and apps (Settings) hand-roll local notice classes, so app-local is
  the established pattern here.

## Target architecture

New invariant: `list()` accounts for every `.json` file in a kind directory: each becomes either a
summary or a damage record. Additive API, no breaking change:

- `src/studio/store.ts`: add

```ts
export interface DamagedEntry {
  kind: string;
  /** filename stem; the file is <kind>/<id>.json */
  id: string;
  /** stable, user-safe cause */
  reason: "unreadable-json" | "schema-mismatch" | "kind-mismatch" | "id-mismatch";
}
```

  `list()` keeps its signature and behavior. Add a sibling
  `listDamaged(kind?: string): Promise<DamagedEntry[]>` that walks the same directories and
  classifies failures. To avoid double-reading in the common healthy case, extract the per-file
  read-and-classify into a private helper both methods share; `read()` itself must distinguish the
  four causes internally (today it throws one opaque message for all; widen `StudioReadError` with
  an optional `cause` field rather than new error classes). Public `read()` behavior for callers
  is unchanged.
- `src/studio/contracts.ts`: add `listDamaged` to `StudioStoreLike`.
- `src/ui/server.ts`: `/api/studio/list` response stays `EntitySummary[]`; add
  `/api/studio/damaged?kind=` returning `DamagedEntry[]` beside it (same auth path as list; it is
  already inside the /api gate).
- Library app: on shelf load, fetch damaged alongside list; when non-empty, render one notice
  band reading "N file(s) in your studio folder could not be read", expandable to filename +
  reason + the studio folder path already exposed by `/api/version` (`studioDir`). Component
  reality check (corrected after adversarial review): the shared catalog has NO generic
  notice/banner component; the only cataloged notice (`WorkshopNotice`,
  docs/reference/components.md, src/ui/apps/workbench/workshop/notice.tsx) is workbench-local,
  and Settings hand-rolls local classes (`warnNote` in
  src/ui/apps/settings/sections/updates-dialogs.tsx, `statusNote` in about.tsx). Follow that
  established app-local pattern: build the band as a small element inside the library app with
  its own CSS-module classes on theme tokens. Do NOT add a folder under src/ui/components/
  (catalog:check stays untouched) and do NOT import another app's notice across app boundaries.
  No repair actions in this plan; visibility only.
- `.tmp-*` and other unsafe-id files stay excluded (they are not user entities); only files whose
  id passes `assertSafeStudioId` but whose CONTENT fails become damage records.

## Files

### Modify
- `src/studio/store.ts`: `DamagedEntry`, `listDamaged`, shared read-classify helper, widened
  `StudioReadError` cause.
- `src/studio/errors.ts`: optional `cause` on `StudioReadError` (constructor default keeps the
  current message; existing `isStudioReadError` untouched).
- `src/studio/contracts.ts`: `listDamaged` on `StudioStoreLike`.
- `src/ui/server.ts`: the `/api/studio/damaged` route.
- `src/ui/apps/library/index.tsx` (and the view module the executor finds owns the shelf header):
  the notice band.
- `src/studio/store.test.ts` and `src/ui/server.test.ts`: coverage below.

### Do not touch
- `src/entities/runtime-schema.ts`: loosening the schema is NOT this plan; strictness is the
  parse-don't-validate boundary working as designed.
- `src/studio/atomic-file.ts`, save paths, delete paths.
- Any format adapter.

## API and compatibility

New endpoint only; existing `/api/studio/list` byte-identical for healthy studios. The OPFS twin
gains `listDamaged` through the shared class; if the twin overrides `list`-adjacent behavior in
its own file, mirror the classification there (executor: check `src/studio/opfs/` before coding;
at planning time the twin injects a `StudioFs` backend and reuses `StudioStore`, so no twin edit
is expected).

## UI and user journey

Entry: open Library with a damaged file present. State: notice band above the shelf, count plus
expandable rows (filename, reason text, studio folder path). Empty state: band absent. Recovery
guidance copy: "The file is still on disk; it was not changed. Restore it from a backup or remove
it to clear this notice." Accessibility: the band is a semantic region with a heading, keyboard
expandable, theme tokens only (no hardcoded colors). Refresh: band recomputes on every shelf
load; no client cache.

## Implementation steps

### Step 1: RED (store)

In `src/studio/store.test.ts` (follow that file's existing exemplar: real temp dirs via mkdtemp;
the fake handle tree lives only in src/studio/opfs/fs.test.ts if an in-memory variant is ever
needed): seed a kind dir with one healthy entity, one truncated JSON file,
one schema-failing file (drop the `examples` group), one kind-mismatched file. Assert:
`list()` returns exactly the healthy one (current behavior, must stay green) and
`listDamaged()` returns the three with reasons `unreadable-json`, `schema-mismatch`,
`kind-mismatch`. The `listDamaged` assertions FAIL now (method absent): honest RED.

### Step 2: GREEN (store)

Implement per target architecture. Verify: `bun test src/studio` -> new tests pass, all existing
store tests untouched and green.

### Step 3: Route

Add `/api/studio/damaged`; test in `src/ui/server.test.ts` beside the existing `/api/studio/list`
tests (same auth fixture): healthy-only studio returns `[]`; seeded-damage studio returns the
records; the route refuses the same unauthenticated requests list refuses (copy the existing
list-route negative test).

### Step 4: Library band

Implement the app-local band per the target architecture (library-owned markup + CSS-module
classes on theme tokens; no shared component). Live journey (mandatory, per repo law UI is
live-proven): `bun run dev`, drop a truncated `.json` into the studio character folder, reload
Library, see the band with count 1 and the filename; remove the file, reload, band gone. Record
both observations in the PR.

### Step 5: Broad checks

`bun run typecheck`; `bun run test`; `bun run lint:ui`; `bun run catalog:check` (must be clean:
no new component folder was added); full `bun run verify:ci`.

## Test plan

Steps 1-4 name every case. Regression net: full store suite, server suite, library UI tests.
Assertion quality rule: the damaged-reason assertions must match exact reason strings, not just
array length.

## Documentation and operations

Update `docs/reference/ui.md` Library section (truth-based: describe the band and when it shows)
and `docs/reference/entities/` storage page if it documents list behavior, in the same commit.

## Done criteria

- Step 4 live journey observed and reported with both states.
- A studio with zero damage renders byte-identical list responses (server test asserts `[]` and
  the band absent).
- `bun run verify:ci` passes.
- No new component folder; catalog:check green.
- Independent review returns SHIPPABLE.

## STOP conditions

- The OPFS twin turns out to reimplement `list()` separately: stop and extend the plan to cover it
  explicitly rather than shipping a desktop-only truth.
- The band turns out to need a shared component after all (a second app wants it): report;
  promoting app-local UI into the shared catalog is its own reviewed change, out of scope here.
- Any existing store/server test needs weakening.

## Rollback and recovery

Additive endpoint and UI band: single revert. No stored data is written or migrated; damaged files
are never modified, moved, or deleted by this feature.

## Maintenance notes

- Future schema-version bumps make `schema-mismatch` the common reason; the band is the user-facing
  tripwire for that day (pairs with the switch system's storage-shape tripwire).
- Reviewer trap: resist auto-repair or auto-quarantine here; visibility first, mutation never
  (this plan), repair as its own reviewed feature if ever.
