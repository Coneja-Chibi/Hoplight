# Plan 02: Preserve drafts and make paste behavior truthful

## Status

Implemented and regression-tested on 2026-07-25.

## Outcome

Navigation, search, and paste operations never silently destroy unsent text. Every pending paste is
visible, removable, and bounded by its real encoded byte size.

## Root cause

Composer owns draft, recall, and cards in component-local state, so App view replacement destroys
them. Down Arrow enters recall even when recall is inactive. Paste handling prevents the native
event before checking capacity, slices code units instead of encoded bytes, and exposes no removal.

## Files and symbols

- `src/kit/render/primitives/composer/composer.tsx`
- `src/kit/render/primitives/composer/recall.ts`
- `src/kit/render/primitives/composer/paste-classify.ts`
- `src/kit/render/primitives/composer/paste-card.tsx`
- `src/kit/render/app.tsx`
- Existing composer unit tests plus a new rendered Composer interaction test
- `src/kit/render/app.test.tsx`
- `docs/reference/kit/composer.md` (new)

## Target design

Use an App-owned `ComposerDraft` containing text, cards, and recall state, or keep the Composer
mounted across overlays while preserving focus. Recall only intercepts Down when a recalled entry is
active. Paste admission returns an explicit result; over-capacity paste remains inline or produces a
visible rejection. Truncation walks code points until the UTF-8 encoded byte budget is satisfied.
Each card has a stable ID and a working remove action.

## Implementation steps

1. Add RED live component tests for Down on ordinary single-line and multiline drafts, Ctrl+F
   open/close, recall restoration, and pending-card survival.
2. Move durable draft ownership above conditional App views or preserve the Composer instance.
   Restore composer focus after search closes.
3. Change recall-next behavior so inactive recall permits native Down and preserves live text.
4. Add RED tests for six large pastes, individual removal, and multibyte input at and above the
   200,000-byte limit.
5. Implement byte-accurate truncation without splitting a surrogate pair. Check card capacity before
   consuming paste, and expose a visible refusal or a documented replacement policy.
6. Wire `PasteCard.onRemove` to remove only the selected stable card.
7. Document recall boundaries, overlay persistence, card capacity, removal, and truncation.

## Test plan

- Down never alters an ordinary draft.
- Up/Down traverses committed history and restores the exact stashed draft.
- Ctrl+F round-trip preserves text, multiline position, recall, and cards.
- The sixth paste is either visibly rejected or represented in submitted content.
- Reported bytes equal `TextEncoder.encode(card.text).length`.
- Multibyte truncation is within the cap and produces valid Unicode.
- Removing one card leaves all other cards and text unchanged.

## Done when

RED/GREEN tests cover each destructive path, the rendered terminal proves state restoration and card
removal, and `bun run verify:ci` passes.

## Stop and rollback

Stop if lifting state would create two draft authorities. Select one owner before proceeding.
Rollback App and Composer state ownership as one unit to avoid split-brain drafts.
