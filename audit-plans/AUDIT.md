# Hoplight Kit UI and Interaction Audit

## Status

- Date: 2026-07-24
- Revision: `d7c4817cfcebf81869ab83bf1042e7e54acc4bb0`
- Working state: current dirty `Backstage` Kit tree, behind `origin/Backstage` by three commits
- Scope: non-security terminal UI, interaction state, command reachability, sessions, provider setup
- Excluded: security review, live provider calls, source implementation, and the user's existing edits
- Implementation update: Plans 01-04 and the non-security portion of Plan 05 were completed and
  regression-tested on 2026-07-25. Security-related Plan 05 items remain deferred by user request.
- Architecture addendum: [Plan 06](06-kit-content-tool-lifecycle.md) covers the non-security content
  capability catalog and tool loop required before Kit can reach Web UI editing parity. Its evidence
  is recorded in
  [PROFESSIONAL-TOOLFLOW-REFERENCE.md](PROFESSIONAL-TOOLFLOW-REFERENCE.md).

## Executive summary

The Kit core tests are healthy, but the application-level state machines are not covered at the
same depth. The most severe faults lose unsent input, allow two turns to overlap, discard partial
stream output, and expose session/provider state that disagrees with the operation actually run.
Several complete-looking surfaces are unreachable or cannot keep a selected row visible.

`bun test src/kit --timeout 120000` passed 307 tests and `bun run typecheck` passed. Those results
do not invalidate the findings below: the failures were reproduced through the rendered OpenTUI
keyboard path or through the exact pure reducer boundary. Existing render tests also emit repeated
React `act(...)` warnings, which makes their async ordering coverage less trustworthy.

## Prioritized findings

| Priority | Finding | Proof | Plan |
| --- | --- | --- | --- |
| Critical | Same-tick submits can start concurrent turns; a submit after busy paints is silently cleared and discarded | Live-proven; `app.tsx:82-131`, `composer.tsx:72-82` | 01 |
| High | Escape does not interrupt a running turn despite the provider accepting an `AbortSignal` | Live-proven; `app.tsx:134-147`, `session.ts:58`, `chat.ts:34-43` | 01 |
| High | Streamed answer text disappears when the stream errors before a final `say` event | Reducer-proven; `turn-events.ts:72-73,81-89,120-139` | 01 |
| High | Down Arrow on an ordinary draft replaces it with the empty recall stash | Live-proven; `composer.tsx:92-96`, `recall.ts:34-38` | 02 |
| High | Ctrl+F unmounts Composer and destroys its draft, paste cards, and recall history | Live-proven; `app.tsx:174-228`, `composer.tsx:53-57` | 02 |
| High | The sixth paste card is silently dropped, cards cannot be removed, and the byte cap slices UTF-16 code units | Live/reducer-proven; `composer.tsx:110-123`, `paste-card.tsx:11-12`, `paste-classify.ts:18-32` | 02 |
| High | Search results have no bounded scrolling or active-row visibility, so the query header and selection disappear | Live-proven at 68x16; `search-card.tsx:100-133` | 03 |
| High | Resume and rewind lists can activate invisible rows; rapid rewind keys can fork a different turn from the highlighted row | Live-proven at 50x10; session render surfaces | 03 |
| Medium | Rewind initially targets a no-op and omits the supported pre-first-turn branch point | Code/live-proven; `rewind-rail.tsx:30`, `projection.ts:46` | 03 |
| Medium | Help advertises transcript navigation that is not wired; the tested full-screen help/navigation subsystem is unreachable | Code-proven; `keymap.ts:23-31`, `app.tsx:70-73,134-147` | 03 |
| Medium | Common terminal sizes merge chrome labels, clip prose, or hide the opening content | Live-proven at 30x12 and 80x24; playbill/status/banner/scrollback | 03 |
| Medium | UTF-16 slicing tears emoji and other grapheme clusters in titles, previews, rename, and live thought tails | Reducer/code-proven; session model/projection and thought box | 03 |
| High | Session commands, persistence, resume, rewind, and export are a dead feature island | Code/runtime-proven; `commands/discover.ts:18-33`, `sessions/commands`, `app.tsx` | 04 |
| Medium | Unknown slash commands, including misspelled session commands, are sent to the provider as ordinary prompts | Live-proven; `command.ts:42-53`, `app.tsx:110-132` | 04 |
| Medium | Session export filenames collide and overwrite; embedded backtick fences can corrupt Markdown exports | Reducer/code-proven; `sessions/transcript.ts`, `sessions/store.ts:167` | 04 |
| High | Switching or removing the active provider leaves the playbill and egress ledger naming the old provider | Code-proven; `settings-screen.tsx:93-110`, `app.tsx:59-61,92-100,154-158` | 05 |
| High | Provider setup cannot create or reopen the passphrase vault used on non-Windows systems | Code-path proven; keystore registry/backends and Settings calls without `Unlock` | 05 |
| High | A malformed existing provider vault is treated as empty and can be replaced on the next save | Code-proven; `providers/vault.ts:25-26,71-106` | 05 |
| High | Settings async failures become an unhandled rejection or permanent loading screen, and mutations can overlap | Code-proven; `settings-screen.tsx:82-86,93-111,159-177` | 05 |
| Medium | Editing credentials leaves models from the previous endpoint selectable during debounce | Reducer-proven; `settings-screen.tsx:144-156`, `model.ts:252-280` | 05 |
| Medium | Model discovery collapses empty and failed requests into the same non-retryable "check the key" state | Code-proven; `providers/adapters.ts:23-35`, `model.ts:30-37` | 05 |
| Medium | Discovered context size is displayed but discarded when the provider is saved | Reducer-proven; `models.ts:11-15`, `model.ts:164-170` | 05 |
| Medium | Pasting on an option chip appends clipboard text to the hidden model ID | Reducer-proven; `model.ts:318-332` | 05 |
| Medium | Multiple saved connections for the same provider render with indistinguishable names | Code-proven; `model.ts:111-119,164-170`, `content-providers.tsx:24-41` | 05 |
| Medium | A fast first turn can leave the terminal title stuck on "working" while notification discovery is pending | Code-path proven; `render/notify/use-notify.ts:31-54` | 01 |

## Systemic themes

1. Application state is split between parent state, component-local refs, and async closures without
   one controller owning acceptance, cancellation, and completion.
2. List surfaces render all rows into a constrained terminal box without a shared active-row
   visibility contract.
3. Pure command/session/provider modules have tests, but production discovery and App wiring are
   not exercised end to end.
4. Settings models success paths but not loading, mutation, unlock, and retry as explicit states.

## Reproductions

### Turn submission

A deferred fake Session received `["first","second"]` when two Enter events arrived before React
committed `busy=true`. After the busy frame painted, a second Enter produced only `["first"]` and
the second draft was no longer visible.

### Partial stream

Applying a text delta `"partial answer"`, then an error, then `settleTurn` produced only:

```json
{"lines":[{"role":"error","text":"stream interrupted"}],"live":{"phase":"idle"}}
```

### Paste byte cap

`classifyPaste("é".repeat(200001))` returned a card reporting 200,000 bytes while its retained text
encoded to 400,000 UTF-8 bytes.

### Narrow list navigation

At 68x16, enough search results removed the search header and moving Down did not bring the active
row into view. At 50x10, a 20-session resume list could open `s15` while that row was invisible.

## Verification run

- `bun test src/kit --timeout 120000`: 307 pass, 0 fail
- `bun run typecheck`: pass
- Focused composer/command/navigation tests: pass, with React `act(...)` warnings
- Safe OpenTUI stdin probes: turn race, busy draft loss, Down draft loss, Ctrl+F state loss,
  search visibility, paste overflow, session list visibility
- Pure reducer probes: partial stream loss, Unicode byte-cap mismatch, stale provider model list,
  option-field paste corruption

## Blind spots

- No mouse, IME, accessibility, or terminal-family matrix was run.
- No real provider credentials or provider network requests were used.
- The passphrase failure is proven from backend selection and call signatures, but was not executed
  on a Linux or macOS host.
- The working tree was already dirty, so executor plans must rebase against the owner's changes and
  must not assume the audited revision is a clean patch base.
