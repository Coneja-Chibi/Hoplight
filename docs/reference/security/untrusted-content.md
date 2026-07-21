---
id: reference/security/untrusted-content
title: Cards and files as untrusted input
audience: dev
summary: Cards, PNGs, and zip containers are parsed once into the canonical model without ever executing a card-authored script, and a cross-format conversion carries only the portable body, so one app's scripts and payloads never reach another app's file.
tags: [security, untrusted-input, parsing, escrow, behavior-scripts, cross-format]
related:
  - reference/security/README
  - reference/security/script-sandbox
  - reference/concepts/escrow-and-roundtrip
  - reference/architecture
  - reference/entities/character
  - reference/formats/risu
---

# Cards and files as untrusted input

A character card, a standalone lorebook, a regex set, and the zip containers that wrap them (`.charx`,
`.byaf`, `.risum`) are all author-controlled content the user opens, never content hoplight fetches itself.
This is layer 1 of the threat model (`docs/reference/security/README.md`, "Parse, not execute"). The
guarantee this page documents: every one of those files is read by exactly one tolerant parser into the
canonical model, nothing on that path evaluates a script, and a cross-format conversion carries only the
portable body, so a script or payload authored for one app is never written into another app's file.

That guarantee has a boundary, and this page stays inside it. Getting a card's content past the door
(import, inspect, convert, export) is one question; what happens if an operator deliberately runs a
script is a different, later action with its own isolation, resource budgets, and honestly-stated
proof gaps, covered in full on
[script-sandbox.md](script-sandbox.md). This page states only that running a script is never automatic.
The general lossless/contained-loss mechanics of the escrow envelope are
[escrow-and-roundtrip.md](../concepts/escrow-and-roundtrip.md)'s job; this page is the security-specific
slice of that same mechanism, focused on what happens to authored scripts specifically.

@fig door

## Parsed once, into a known type

Every reader on the import path is a total function over untrusted bytes: parse into a known shape, or
fail to a known empty value. None of them throw on bad input and none of them evaluate what they read.

- **JSON.** `readCardJson`, `readJsonAny`, and `readJsonObject` (`src/formats/_shared/card-io.ts:9-21`,
  `:28-36`, `:43-53`) each wrap `JSON.parse` in a `try`/`catch` and return `null` on anything that does
  not parse or does not match the expected shape (object vs. any value). There is no fallback to `eval`
  or a lenient parser; a malformed file becomes `null`, not a thrown exception the caller has to guess
  about.
- **PNG chunks.** `extractCharacterJson` only reads `tEXt`/`iTXt` chunks after confirming the 8-byte PNG
  signature; `safeExtract` catches a corrupt chunk stream and returns `[]` instead of throwing
  (`src/formats/_shared/png.ts:14-33`, `:52-65`). A V3 card's `ccv3` chunk is preferred over its `chara`
  V2-subset chunk so a card is never silently downgraded (`png.ts:44-51`).
- **Zip containers.** `.charx`, `.byaf`, and `.risum` bundles go through `unzipBounded`, which checks
  compressed size, per-entry size, entry count, and aggregate inflated size before inflation where
  fflate's filter allows, then rechecks actual lengths after (`src/core/archive.ts:66-118`). Card
  containers cap at 96 MiB archive / 512 entries / 64 MiB per entry / 96 MiB aggregate
  (`archive.ts:30-36`); any breach throws `ArchiveLimitError` rather than silently truncating or
  dropping a required entry (`archive.ts:8-14`). The full decompression-bomb table lives in
  `docs/reference/security/README.md`, "Decompression caps on archives"; this page only needs the fact
  that inflation is capped before a card's JSON is ever read out of it.
- **The `.risum` module container.** `openRisumModule` decodes a Risu module's binary format into typed
  records (regex rows, lorebook rows, trigger rows, script bodies as plain strings) and returns `null` on
  any decode failure, never throwing (`src/formats/risu/open-module.ts:1-4, 26-48`). The module type's own
  doc comment states the same boundary the JSON readers keep: "Nothing here executes script bodies"
  (`src/formats/risu/rpack/module.ts:1-4`). The raw module bytes are always kept alongside the decoded
  view for lossless export, so a failed structural decode never loses the source file
  (`src/formats/risu/index.ts:115-128`).

## Two script surfaces, neither runs on import

A card can carry two different kinds of authored script, and hoplight treats both the same way at the door:
classified as data, never evaluated, until an operator explicitly stages one.

**Declarative trigger rows** (Risu's `triggerscript`: condition/effect pairs like "if a variable equals
X, set another variable") are read into `TriggerScript[]`, a plain array of `{ event, conditions,
effects }` records (`src/entities/character/schema.ts:282-289`). `classifyCondition` and `classifyEffect`
only sort a row into a known or advanced shape for the editor; the module's own header states "Nothing
here executes anything; rows are data" (`src/entities/character/behavior.ts:1-7, 41-51, 80-91`). The one
place these rows are actually interpreted is `runDataTriggers`, and it is a hand-written, pure TypeScript
evaluator: string/number comparisons, a from-scratch `calc::` arithmetic parser, and `setvar` effects that
mutate a plain object. Its own header is explicit that it "NEVER executes card content - no eval, no
Function, no wasmoon" (`src/sandbox/triggers/run-data-trigger.ts:1-13`), and an `impersonate` or `command`
effect row is only ever recorded as a text line for the console log, never dispatched anywhere
(`run-data-trigger.ts:277-297`). This interpreter itself only runs when an operator clicks Run in the
Workshop Test Bench (`runDataBench`, wired to `onRunRules` at
`src/ui/apps/workbench/workshop/view.tsx:118-123, 227`); nothing on the import, convert, or export path
calls it.

**Real Lua** (Risu's `virtualscript`, `triggerlua` script effects, and a packaged `.risum` module's script
bodies) is carried as opaque text or bytes on the canonical body and in escrow. The `CharacterBehavior`
type's own doc comment states the hard line for this whole surface: "the converter/editor NEVER executes
any of this. No eval, no require, no DOM injection" (`src/entities/character/schema.ts:291-296`). The
only place this text is ever handed to a real Lua VM is the same Workshop Test Bench, wired to an explicit
`onRunPackage` click (`view.tsx:125-135, 228`), which hands the code to `runLuaSandboxed` to run inside an
isolated Worker. That worker's isolation, resource budgets, and wire protocol are their own subject with
their own honest proof gaps: see [script-sandbox.md](script-sandbox.md). This page's claim stops at the
boundary: execution never happens on import, never happens during a format conversion, and never happens
without the operator opening the Test Bench and clicking Run.

A card can also request Risu's low-level script API (`lowLevelAccess`). hoplight surfaces that request as a
boolean, `privileged` (`schema.ts:312-314`, "a warning marker for the UI and a sandbox gating input, never
an execution trigger"), read off the card on import (`src/formats/risu/index.ts:73-78`) and rendered to
the operator as "It asks for deep access - we do not grant that" (`src/ui/receipt.ts:88`). Denial is
structural, not a flag check: no file under `src/sandbox/` reads `privileged` or `lowLevelAccess` at all,
and the sandbox's host bridge simply never implements network, filesystem, or app access for any script,
whatever it requests (`src/sandbox/lua/risu-api.ts:1-8`, "deny-by-absence"). The full treatment of that
flag is [script-sandbox.md](script-sandbox.md#the-privileged-flag-a-warning-not-a-trigger).

## Escrow never blind-copies scripts across formats

Every canonical entity keeps a lossless twin of the file it was imported from, keyed by source format id,
and a cross-format conversion hands the target adapter only the canonical body, never that twin
(`docs/reference/architecture.md:56-72`; full mechanics in
[escrow-and-roundtrip.md](../concepts/escrow-and-roundtrip.md)). For authored scripts specifically, that guarantee
holds through two distinct mechanisms, and both matter: the raw twin is structurally withheld, and the
in-body copy is withheld by the fact that no other format's adapter ever reads it back off the body.

**The body carries scripts, but only the RisuAI adapter ever emits them.** `applyRisuToBody` lifts
Risu's `triggerscript`, `virtualscript`, `backgroundHTML`/`backgroundCSS`, `defaultVariables`, and
`lowLevelAccess` rows straight onto the canonical entity's `body.behavior` field
(`src/formats/risu/risu-fields.ts:88-135`, applied at `risu-fields.ts:148`), and `convertFile` hands a
target adapter exactly that body for any same-kind conversion (`src/convert.ts:96-115`). So a converted
entity genuinely does carry the source card's scripts in memory; they are not sealed away before the
target adapter runs. The guarantee is narrower and verified: `body.behavior` is read by exactly one
character format adapter in the whole tree, `src/formats/risu/risu-fields.ts`. Every other adapter's
`fromCanonical` (SillyTavern, RoleCall, Agnai, Backyard, BYAF, Lumiverse, Pygmalion) never looks at that
field, so converting a Risu card to any of them carries the portable identity, persona, greeting, and
lore fields, while the trigger rows, virtual script, background markup, and privileged flag sit unread on
the in-memory entity and are never written to that adapter's wire.

That is a declared claim, not an accident. Only `src/formats/risu/coverage.ts` lists `"behavior"` among
what it carries on the wire (`coverage.ts:33`), annotated "scripts ride as DATA (regex/trigger/virtual);
never executed here" (`coverage.ts:38`). Every other format's coverage declaration omits it. The
export-honesty layer turns that gap into a statement the operator actually sees instead of a silent drop:
`buildExportHonesty` computes `carriesBehavior` straight from the target's own coverage claim
(`src/ui/components/export-dialog/honesty.ts:345`) and, for any target that does not claim it, pushes an
explicit line naming exactly what will not travel: "`<target>` does not carry Hoplight behavior scripts.
Trigger rules, regex, virtual script, and backdrop HTML will not travel." (`honesty.ts:374-379`), plus a
separate line when a packaged `.risum` module is present: "The card package (module scripts, module lore,
module regex) will be dropped." (`honesty.ts:380-384`). The import side states the mirror fact up front:
a card with any trigger, regex, virtual, or background content gets the receipt line "It carries scripts.
They are saved as text and will never run unless you put them on the test stage." (`src/ui/receipt.ts:83-87`).

**The raw twin never crosses at all.** One layer further out, `original` is keyed per source-format id,
and a target adapter only ever reads its own key, `original.<its own id>`. On a fresh cross-format
conversion that key is empty on the entity, so the target full-encodes from the canonical body alone; the
source card's raw payload, including its own extension blocks and a `.risum` module's raw bytes, never
reaches the output file (`architecture.md:64-72`; `convert.ts:96-115`). This is the escrow half of the
guarantee, independent of the coverage/honesty mechanism above: even if a future format adapter started
reading `body.behavior`, it still could not reach a Risu card's raw module bytes, because those live only
under `original.risu`, a key that adapter never opens.

## What this page does not claim

- **Regex execution safety.** A card-embedded regex script is carried as a plain `{ find, replace }` data
  row and is never compiled or applied on import; `schema.ts:272-280` states applying one "is a regex
  replace, never an eval." Whether a specific pattern can hang the thread when it later runs is a
  different, runtime question with its own defense: see
  [regex-safety.md](regex-safety.md).
- **Sandbox isolation completeness.** This page states that script execution requires an explicit
  operator action; it makes no claim about the isolation of that execution once staged. Origin separation
  for the Test Bench worker is implemented and tested at the Bun HTTP/handler layer only. The packaged
  WebView2 host is not yet measured, and per ADR-009 that acceptance is BLOCKED (Plan 017)
  (`docs/decisions/ADR-009-sandbox-origin.md:80-90, 100-112`). Do not read anything on this page as
  "fully isolated" or "cannot be exploited"; see [script-sandbox.md](script-sandbox.md) for the full,
  honest account.
- **Decompression-bomb tuning.** The exact archive size caps and their rationale live in
  `src/core/archive.ts` and are catalogued in `docs/reference/security/README.md`; this page only relies
  on the fact that they are enforced before a card's JSON is ever read out of a zip container.

## Source of truth

| Concern | File |
| --- | --- |
| Tolerant JSON reading (card/lorebook input) | `src/formats/_shared/card-io.ts` |
| Tolerant PNG chunk reading | `src/formats/_shared/png.ts` |
| Bounded zip inflate, archive limits | `src/core/archive.ts` |
| `.risum` module structural decode | `src/formats/risu/open-module.ts`, `src/formats/risu/rpack/module.ts` |
| Trigger row classification (data, not execution) | `src/entities/character/behavior.ts` |
| `TriggerScript` / `CharacterBehavior` / `privileged` types | `src/entities/character/schema.ts` |
| Pure-TypeScript trigger interpreter (no eval) | `src/sandbox/triggers/run-data-trigger.ts` |
| Risu import: `hasExecutableContent`, `isPrivileged`, module decode | `src/formats/risu/index.ts` |
| Risu scripts lifted onto the canonical body | `src/formats/risu/risu-fields.ts` |
| Risu's declared wire coverage (`"behavior"`) | `src/formats/risu/coverage.ts` |
| Only the canonical body crosses a conversion | `src/convert.ts` |
| Escrow envelope, per-format keying | `src/core/canonical.ts` |
| Export-honesty drop/keep lines | `src/ui/components/export-dialog/honesty.ts` |
| Import receipt copy | `src/ui/receipt.ts` |
| Explicit Test-Bench run wiring (no auto-run) | `src/ui/apps/workbench/workshop/view.tsx` |
| Deny-by-absence host bridge | `src/sandbox/lua/risu-api.ts` |
