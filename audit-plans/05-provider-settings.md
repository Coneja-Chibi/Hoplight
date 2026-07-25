# Plan 05: Make provider settings transactional and cross-platform

## Status

The non-security UI and state-synchronization work was implemented and regression-tested on
2026-07-25. Passphrase, vault-integrity, and other security-related work remains intentionally
deferred at the user's request.

## Outcome

Provider setup works with DPAPI or passphrase storage, every async operation has visible progress and
recovery, and the provider/model shown in App always matches the configuration used for the turn.

## Root cause

Settings launches async intents without a state machine, error boundary, or mutation serialization.
It never requests the unlock required by the non-Windows backend. App refreshes provider display
after save but not activation/removal. Model discovery results are not keyed strongly enough to the
edited credential signature, and reducer paste handling treats option fields as model fields.

## Files and symbols

- `src/kit/render/settings/settings-screen.tsx`
- `src/kit/render/settings/model.ts`
- `src/kit/render/settings/content-form.tsx`
- `src/kit/render/settings/content-providers.tsx`
- `src/kit/render/app.tsx`
- `src/kit/providers/vault.ts`
- `src/kit/providers/adapters.ts`
- `src/kit/providers/config.ts`
- `src/kit/providers/known-context.ts`
- `src/kit/keystore/registry.ts`
- `src/kit/keystore/backends/passphrase.ts`
- Existing provider/settings/keystore tests and new rendered integration tests
- `docs/reference/kit/providers.md` (new)

## Target design

Model Settings as explicit `loading`, `ready`, `mutating`, `needs-unlock`, and `error` states.
Serialize vault mutations and retain form input across retry. Provide passphrase create/unlock,
wrong-passphrase retry, and cancel without retaining plaintext beyond the settings session. Return a
single successful-mutation callback carrying the new active provider state. Key model-discovery
results to the complete credential/options signature and invalidate them synchronously on edits.

## Data and compatibility

Preserve existing DPAPI and passphrase envelopes. Distinguish a missing vault from present invalid
data; never replace unreadable existing bytes as if they were an empty vault. If discovered context
metadata or connection labels are persisted, version the provider config and load older configs with
documented defaults.

## Implementation steps

1. Add RED rendered tests for forced passphrase backend create/reopen, wrong passphrase, cancel,
   vault read/write rejection, double Enter, activation/removal refresh, and mutation overlap.
2. Introduce the explicit Settings operation state machine and one serialized intent runner with
   `try/catch/finally`. Keep the form and selection stable on recoverable errors.
3. Add passphrase create/unlock UI and thread `Unlock` through every vault operation. Clear unlock
   material when Settings unmounts.
4. Make vault reads distinguish `ENOENT` from invalid envelopes/payloads. Block writes until an
   explicit recovery path, and prove original bytes remain untouched on failure.
5. Notify App after save, set-active, and remove. Refresh the displayed provider once and use the
   same resolved config for playbill, ledger, context meter, and the next turn.
6. Invalidate model results synchronously when key, base URL, or options change. Add typed empty/error
   outcomes and retry for the same signature.
7. Make paste a no-op on option chips. Persist discovered context and add a user-visible connection
   label if those product contracts remain approved.
8. Document backend selection, unlock lifetime, retry/error behavior, labels, and model discovery.

## Test plan

- Passphrase vault create, save, reopen, wrong-passphrase retry, and cancel.
- Every rejected async operation becomes visible and retryable, with no unhandled rejection.
- Rapid conflicting keys execute at most one vault mutation at a time.
- Activate/remove updates App and the next turn/ledger to the same provider identity.
- Credential/option edits make the old model list unselectable immediately.
- Empty discovery, unauthorized, transient failure, malformed response, and retry success differ.
- Pasting on every option field leaves model/config unchanged.
- Existing valid vault fixtures remain readable; invalid existing bytes are never overwritten.

## Done when

Windows and forced-passphrase integration tests pass, provider identity is consistent across Settings
and App, failure journeys are live-proven, and `bun run verify:ci` passes.

## Stop and rollback

Stop if cross-platform secret handling requires a new backend or envelope format; write an ADR and
migration plan first. Never roll back only the reader or writer side of a vault-format change.
