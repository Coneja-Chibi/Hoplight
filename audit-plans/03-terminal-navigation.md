# Plan 03: Give every terminal list a visible, scrollable selection

## Status

Implemented and regression-tested on 2026-07-25.

## Outcome

Search, resume, rewind, help, and transcript navigation keep their header and active row visible at
supported terminal sizes. Help describes only bindings that production actually registers.

## Root cause

List surfaces render unbounded columns inside constrained boxes and maintain selection independently
from scroll position. Multiple tested navigation primitives are not imported by the production App,
while the live SearchCard implements a separate incomplete path.

## Files and symbols

- `src/kit/render/primitives/nav/search-card.tsx`
- `src/kit/render/primitives/nav/search-bar.tsx` and obsolete-path decision
- `src/kit/render/primitives/nav/use-scroll-seam.ts`
- `src/kit/render/primitives/nav/help-screen.tsx`
- `src/kit/render/primitives/nav/keymap.ts`
- `src/kit/render/primitives/scrollback.tsx`
- `src/kit/render/primitives/playbill.tsx`
- `src/kit/render/primitives/status-bar.tsx`
- `src/kit/render/primitives/opening-banner.tsx`
- `src/kit/render/primitives/thought-box.tsx`
- `src/kit/sessions/render/resume-playbill.tsx`
- `src/kit/sessions/render/rewind-rail.tsx`
- `src/kit/sessions/session-model.ts`
- `src/kit/sessions/projection.ts`
- `src/kit/render/app.tsx`
- Existing nav/session smoke tests plus new constrained-size integration tests
- `docs/reference/kit/navigation.md` (new)

## Target design

Provide one reusable bounded terminal-list primitive: a non-shrinking header, scrollable body,
stable active ID, and `ensureVisible(activeId)` after selection or resize. Use it for search, resume,
and rewind. Derive help entries from registered App actions rather than a parallel aspirational
keymap. Delete or adopt the obsolete SearchBar path instead of keeping two search architectures.
Define compact/standard/wide chrome behavior and use one grapheme-safe display truncation helper.

## Implementation steps

1. Add RED rendered tests at 50x10, 60x10, 68x16, and 80x24 with at least 100 rows. Assert header
   visibility, active-row visibility, stable selection after resize, and Enter acting on that row.
2. Extract the bounded-list/active-row contract and apply it to SearchCard.
3. Apply the same contract to resume and rewind. Replace stale index refs with one reducer state so
   highlight and the selected action use the same snapshot. Include a pre-first-turn target and
   suppress no-op rewind/fork actions.
4. Choose the live search/help architecture. Remove dead primitives or wire them fully; do not leave
   tests for unreachable production surfaces.
5. Register transcript paging/home/end actions in App and Scrollback, or remove them from help.
6. Define dimension-driven chrome modes. Intentionally truncate competing labels, permit prose to
   wrap, and keep actionable opening content visible at 30x12 through 120x40.
7. Centralize grapheme-safe truncation/backspace for session titles, previews, rename, and thought
   tails. Cover astral, combining, flag, CJK, and ZWJ inputs.
8. Add production reachability tests that start from App keyboard/command input rather than mounting
   leaf components directly.
9. Document supported bindings and narrow-size behavior.

## Test plan

- One hundred hits never hide the query field.
- Repeated Down always makes the new active row visible.
- Enter opens the exact visible resume session.
- Rapid rewind navigation and fork operate on the highlighted turn.
- Resize preserves active identity and makes it visible again.
- Every help binding has a production handler and observable effect.
- No obsolete search/help implementation remains reachable only from tests.
- Chrome labels remain separated and actionable copy remains readable at the size matrix.
- Display caps and backspace never emit unpaired surrogates or torn grapheme clusters.

## Done when

All constrained-size journeys are live-proven, no selection can act offscreen, help and registered
actions match, and `bun run verify:ci` passes.

## Stop and rollback

Stop if OpenTUI cannot programmatically scroll a tagged row in the supported version. Implement a
windowed slice keyed by active index instead. Roll back the shared primitive and all consumers
together if their selection contracts diverge.
