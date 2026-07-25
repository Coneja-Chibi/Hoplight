# Plan 01: Make turn submission exclusive, cancelable, and lossless

## Status

Implemented and regression-tested on 2026-07-25.

## Outcome

Exactly one provider turn may own the UI at a time. A rejected submit remains in the composer,
Escape cancels the active turn, and already streamed assistant text remains visible if the turn is
cancelled or fails.

## Root cause

`busy` is React render state, not a synchronous lock. `Composer` clears before it knows whether App
accepted the value. App has no turn-scoped `AbortController`, and the turn reducer only lands
thought/tool state before replacing live typing with idle.

## Files and symbols

- `src/kit/render/app.tsx`: `withTurn`, `submit`, App keyboard handler
- `src/kit/render/primitives/composer/composer.tsx`: `ComposerProps.onSubmit`, `submit`
- `src/kit/session.ts`: `Session.runTurn`, `createSession`
- `src/kit/providers/chat.ts`: `makeChat`
- `src/kit/render/turn-events.ts`: `quiesce`, error/stopped handling, `settleTurn`
- `src/kit/render/notify/use-notify.ts`: discovery and busy-edge delivery
- `src/kit/render/app.test.tsx`
- `src/kit/render/turn-events.test.ts` or a new focused reducer test
- `docs/reference/kit/turns.md` (new truthful Kit behavior page)

## Target design

Create one App-owned turn controller with a synchronous ownership token and a turn-scoped abort
controller. Submission returns an explicit accepted/rejected result. All turn-producing paths,
including `/test`, acquire the same controller. Cancellation is represented as a normal terminal
outcome, distinct from provider failure. Landing a terminal event first commits any nonempty live
typing as partial assistant output.

## Implementation steps

1. Add RED App tests with a deferred Session for same-tick double Enter, Enter after the busy frame,
   and `/test` while busy. Assert only one turn starts and rejected text remains editable.
2. Change the Composer callback contract to return acceptance synchronously. Commit recall and clear
   text/cards only after acceptance. Keep the textarea available for editing while a turn runs.
3. Replace the render-state guard with a synchronous turn token/ref. Release it in `finally`, and
   ignore completion from an obsolete token.
4. Thread an App-created `AbortSignal` through `Session.runTurn` to `makeChat`. Bind Escape only while
   a turn owns the controller, abort once, and show a stable cancelled outcome.
5. Add RED reducer tests for delta then error, delta then stopped, and delta then cancellation. Land
   nonempty live typing before the terminal row, without duplicating text when `say` already landed.
6. Add delayed and rejected notification-discovery tests. Queue the busy-to-idle title restoration
   or dispatch the built-in title channel directly so a fast turn cannot leave "working" behind.
7. Document submission, cancellation, partial-output, notification, and retry behavior.

Verify after every step with the focused reducer/App tests. Then run `bun test src/kit` and
`bun run typecheck`.

## Test plan

- Two Enter events in one event-loop turn start one Session call.
- A busy-frame Enter keeps the exact draft and paste cards.
- A turn-producing command cannot bypass the lock.
- Escape aborts once, settles the UI, and enables the next submit.
- An error after deltas preserves those deltas and adds the error row.
- A normal completed `say` does not duplicate streamed text.
- Late events from an aborted/obsolete turn cannot modify the current turn.
- Immediate busy true-to-false with delayed/rejected discovery restores the terminal title once.

## Done when

The focused tests fail on the audited implementation and pass after the change; the full Kit suite,
typecheck, and `bun run verify:ci` pass; a live terminal journey demonstrates submit, cancel, partial
output, and immediate retry.

## Stop and rollback

Stop if the provider SDK cannot accept a caller signal without changing its public contract; record
the exact adapter and isolate it behind a compatibility shim. Roll back by reverting the controller
and callback contract together, never only one side.
