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

---

## Creative studio tool-surface addendum

- Date: 2026-07-25
- Revision: `052be627518754f749ebab2d133fc5d23b112804`
- Scope: Kit's provider-visible tools, deferred content capabilities, draft lifecycle, shared
  Workbench operations, Library lifecycle, Press publishing, deterministic lore/regex analyzers,
  and future production, Doctor, Test Stage, and Table Read contracts
- Method: two independent read-only shards followed by conductor source verification
- Excluded: live model evaluation, a terminal journey, exhaustive per-format field comparison,
  implementation, security testing, and future engines that do not exist in `src/`

### Current verified inventory

Kit has seven always-on tools: `studio_list`, `studio_search`, `studio_read`, `docs_query`,
`capability_find`, `change_apply`, and `change_discard`. It discovers 27 deferred semantic draft
capabilities: 10 character, 5 lorebook, 4 persona, 3 preset, 3 pack, and 2 regex. Drafts compose
per target, refuse stale writes, save once, and verify by re-reading. Read-only model batches may
overlap, while any mutation batch serializes.

This is a credible editing foundation, but not a complete creative studio. The missing work is
concentrated in six boundaries rather than one hundred independent form controls.

### Findings

| Priority | Finding | Source-confirmed mechanism | Plan |
| --- | --- | --- | --- |
| P0 | Progressive discovery only understands existing-entity content edits | `ContentCapability` IDs and `capability_find` require a content kind and `{kind,id}` target; deferred non-content workflows have no reveal path | 09 |
| P0 | Large-piece reading is irrecoverably truncated | `renderEntity()` caps canonical JSON at 4,000 characters and exposes no path, offset, continuation, outline, or spill handle | 09 |
| P0 | Composed drafts cannot be fully reviewed | `CapabilityPreview.platformImpact` is dropped from `ChangeDraft`; the adapter returns only the latest operation and there is no draft list/show/validate tool | 09 |
| P1 | Kit cannot create, import, organize, delete, or publish pieces | The Web UI and CLI already expose canonical blank creation, duplicate/rename/delete, inspect, bundle save, format coverage, conversion, export, and Press planning; Kit exposes none of them | 10 |
| P1 | Shared semantic parity and deterministic diagnosis remain incomplete | Lore entry creation, duplication, triggers, placement, categories, and several preset surfaces remain UI-owned; pure lore, regex, pack, and preset analyzers have no read capability | 11 |
| P2 | Multi-piece work has no durable recovery model | Current drafts own one target and store writes are per file; the production history package and snapshot store exist only as a specification | 12 |

### Finding details

#### [ARCH-01] Generalize one progressive catalog

- Severity: HIGH
- Confidence: HIGH
- Evidence:
  - `src/entities/capabilities/types.ts`, `ContentCapability`: IDs are content-kind-prefixed and
    previews require an existing parsed entity.
  - `src/kit/tools/capability-find.ts`, `target`: every search, browse, and describe request requires
    an existing `{kind,id}`.
  - `src/kit/capabilities/runtime.ts`, `toolSnapshot`: only direct ordinary tools and revealed
    adapted content capabilities can enter a provider snapshot.
- Mechanism: lifecycle, conversion, Doctor, history, and publishing workflows cannot be deferred
  through the current catalog. Making each one direct would recreate the prompt overload ADR-010
  was written to prevent.
- Impact: Kit cannot grow to Studio parity without either multiplying direct schemas or creating a
  competing search router.
- Systemic boundary: provider-visible tool planning and exposure.
- Effort: M.
- Fix risk: MEDIUM because stable content IDs, generated Workbench imports, safety classification,
  and provider snapshots must remain compatible.
- Direction: introduce one discoverable descriptor union with explicit domains such as `content`,
  `studio`, `transfer`, and `diagnostics`. Keep `ContentCapability` as the pure entity-edit subtype.
  Extend the existing search/browse/describe entry point instead of adding another router.

#### [DATA-01] Make large reads navigable and recoverable

- Severity: HIGH
- Confidence: HIGH
- Evidence:
  - `src/kit/tools/_shared/format.ts`, `BODY_CAP`: bodies are sliced at 4,000 characters.
  - `src/kit/tools/read.ts`, `studio_read`: input accepts only kind and id and describes the result
    as the full canonical content.
  - `specs/engine/agent-loop.md` requires bounded spill handles for oversized results.
- Mechanism: content after the first 4,000 characters is absent from the observation, and the model
  receives no continuation token or structural path by which to recover it.
- Impact: a large lorebook, preset, or media manifest cannot be inspected reliably before editing.
- Systemic boundary: Kit read results and session-local result storage.
- Effort: M to L.
- Fix risk: MEDIUM because result lifetime, output budgets, and weak-model navigation need explicit
  contracts.
- Direction: give `studio_read` outline, path, offset, and limit actions, then add bounded spill
  handles with stat, read, and search. Never expose arbitrary filesystem paths.

#### [CORRECTNESS-01] Preserve and query the complete draft

- Severity: HIGH
- Confidence: HIGH
- Evidence:
  - `src/entities/capabilities/types.ts`, `CapabilityPreview`: includes changes, warnings, and
    platform impact.
  - `src/kit/changes/types.ts`, `ChangeDraft`: retains changes and warnings but no platform impact.
  - `src/kit/capabilities/adapter.ts`: returns only the latest operation's changes.
  - `src/kit/tools/`: apply and discard are the only draft controls.
- Mechanism: composition retains a proposed entity but discards part of each preview's explanation,
  and there is no provider operation to inspect the full accumulated proposal.
- Impact: a user or model can be asked to approve a multi-step draft without a complete composed
  diff or platform-loss report.
- Systemic boundary: session-local change ownership.
- Effort: M.
- Fix risk: MEDIUM; operation rollback requires deterministic replay of later operations.
- Direction: preserve platform impact and add a compact `change_query` workflow with list, show, and
  validate. Defer per-operation rollback until replay semantics are proven.

#### [PARITY-01] Expose lifecycle and publishing without bypassing the engine

- Severity: HIGH
- Confidence: HIGH
- Evidence:
  - `src/ui/app-contract.ts` and `src/ui/api.ts`: save, delete, bundle save, inspect, export, formats,
    and coverage are already first-class app services.
  - `src/ui/apps/library/new-in-deck-button.tsx`: five canonical kinds have create flows.
  - `src/ui/apps/library/delete-flow.tsx`: duplicate, rename, and delete are implemented.
  - `src/ui/server-engine.ts`: inspect and export use the same adapters and bundle layer as the CLI.
  - `src/ui/apps/press/`: target planning, readiness, riders, skips, and export receipts are pure or
    already orchestrated.
- Mechanism: engine and UI paths exist, but Kit's provider belt exposes only read and edit-existing
  operations.
- Impact: Kit can edit a shelf item but cannot carry a creator through ingest, organization, and
  publishing.
- Systemic boundary: lifecycle and transfer orchestration over canonical engines.
- Effort: L.
- Fix risk: HIGH because deletion, external paths, archives, binary output, overwrite policy, and
  partial bundles require truthful receipts.
- Direction: implement deferred workflow capabilities with inspect or plan separated from gated
  apply. Use bounded path handles and existing format reports; never add a raw filesystem tool.

#### [PARITY-02] Finish semantic parity and add deterministic read capabilities

- Severity: MEDIUM
- Confidence: HIGH
- Evidence:
  - `docs/reference/kit/tools.md`: lore create, duplicate, trigger, placement, and broad bulk work
    are explicitly absent.
  - `src/entities/lorebook/capabilities/entries.ts`: the entry patch is limited to title, content,
    note, enabled, and constant.
  - `src/ui/apps/workbench/lore/session.ts`: add and duplicate are still UI-owned.
  - `src/core/lore/inspect.ts`, `src/core/regex/inspect.ts`, `src/core/media/pack-health.ts`, and
    `src/core/preset/build.ts`: deterministic analyzers already exist.
  - `src/kit/capabilities/adapter.ts`: every semantic capability is forced into the draft lane even
    though the contract declares a read effect.
- Mechanism: editor semantics and useful analysis remain split between pure core, entity
  capabilities, and UI reducers. Kit cannot call the built analyzers through the same catalog.
- Impact: professional users can author or diagnose details in the Web UI that Kit cannot reach.
- Systemic boundary: pure entity capabilities and read-effect adaptation.
- Effort: L for lorebook and built analyzers; XL for every canonical field family.
- Fix risk: MEDIUM because platform representability and escrow restrictions must stay explicit.
- Direction: first make the adapter honor read effects. Add coherent read capabilities for health,
  readiness, token/build traces, and comparisons. Then close lorebook and preset semantic gaps one
  area at a time, sharing reducers with the Workbench.

#### [DIRECTION-01] Do not fake history-backed batch work

- Severity: MEDIUM
- Confidence: HIGH
- Evidence:
  - `src/kit/changes/session.ts`: one active draft is indexed by one exact target.
  - `src/studio/store.ts`: compare-and-save is atomic for one entity, not a multi-entity
    transaction.
  - `specs/engine/productions-and-history.md`: the production manifest, object store, snapshot,
    restore, and recovery package are future work and have no `src/productions` implementation.
- Mechanism: a multi-piece apply over current per-file saves can partially commit without one
  durable snapshot or recovery boundary.
- Impact: broad creative refactors could be reported as one action even when only a subset saved.
- Systemic boundary: production storage and history, then batch orchestration.
- Effort: XL.
- Fix risk: HIGH because partial writes, stale revisions, restore safety, and identity references
  cross several files.
- Direction: build the production history engine first. Batch tools then resolve an immutable
  selector to a frozen target set, preview every item, declare all-or-nothing versus partial policy,
  take one recovery snapshot, and report per-item outcomes.

### Product-direction ledger

These are valuable, but not current tool-wrapper work:

- Script Doctor: deterministic and treatment contracts are specified, but the Doctor content
  engine is not implemented. Existing lore and regex analyzers can ship first.
- Test Stage: lore and regex traces exist today; full prompt assembly, live audition, and isolated
  A/B sessions remain future engine work.
- Table Read: this is a core differentiator and should surface as a resumable session workflow, not
  dozens of field tools. Its interview engine does not yet exist.
- Production graph and history: prerequisite for honest restore and safe studio-wide batch changes.

### Rejected candidates

- One provider tool per form control.
- Advertising every deferred schema every turn.
- A raw JSON patch tool.
- Arbitrary shell or filesystem access.
- Agent tools for tabs, split panes, focus, or Library checkmarks.
- Direct mutation of escrow without a typed semantic home.
- Automatic execution of imported Lua or regex behavior.
- A vector database for docs or tool search.
- Cloud collaboration or accounts; the product is explicitly local-first and file-social.

### Recommended dependency graph

```text
09 runtime discovery + read traversal + draft query
  |\
  | +--> 11 deterministic diagnostics + semantic parity
  |
  +----> 10 lifecycle + transfer + publishing
            |
            +--> 12 production history + batch orchestration

Future Doctor, Test Stage, and Table Read tools start only after their engines exist.
```

### Verification performed and limitations

- Two independent read-only audits covered the capability, Kit tool, change, loop, Library,
  Workbench, Press, CLI, server-engine, core analyzer, architecture, and feature-spec surfaces.
- The conductor re-opened every source boundary used in the findings.
- No live Kit journey or model-selection evaluation was run.
- No implementation or source mutation was performed as part of this addendum.
- Line evidence is tied to the dirty local `Backstage` worktree at the revision above.
