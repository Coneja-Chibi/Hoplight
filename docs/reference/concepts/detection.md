---
id: reference/concepts/detection
title: Detection and the registry
audience: dev
summary: How vaud sniffs a file's format from its content, scores each adapter's confidence, keeps the single best match above a threshold, and stops any detector from claiming another entity kind's files.
tags: [concept, detection, registry, adapter, confidence, cross-kind]
related: [reference/architecture, reference/formats/sillytavern, reference/entities/character, reference/entities/lorebook]
---

# Detection and the registry

vaud never trusts a file extension to say what a file is. It sniffs the content: every adapter inspects
the bytes or the decoded text and returns a confidence, and the registry keeps the single highest score
above a threshold. This page explains that one pass, the confidence gradient that makes a specific format
outrank a generic one, and the firewall that stops a character reader from claiming a lorebook.

For the hub-and-spoke model this detection feeds, see [architecture.md](../architecture.md). For one
format's detect paths in full, see [formats/sillytavern.md](../formats/sillytavern.md).

@fig pass

## Content, not extension

An adapter is handed an `AdapterInput`: `bytes` for binary formats, `text` for JSON, and an optional
`filename` (`src/core/adapter.ts:8-13`). A file read fills `bytes` always and decodes `text` only when the
extension is `.json` or `.txt` and the bytes are valid UTF-8 (`src/cli.ts:25-39`); the studio does the same
on an upload (`src/ui/server-engine.ts:57`). The extension only decides whether to attempt a text decode,
never which adapter wins.

That split is why binary formats detect on `bytes` and JSON formats on `text`. A PNG card is recognized by
its embedded `chara` or `ccv3` text chunk, a Risu `.charx` by the zip magic, a Backyard `.byaf` by its
archive bytes, while a `.json` card is recognized by its parsed shape. A detector that needs text returns
`0` when only bytes are present (`src/formats/vaud-json/index.ts:29`). The physical wrapper
is sniffed separately by `sniffContainer`, on magic bytes then a text fallback
(`src/entities/character/provenance.ts:142-160`).

## The registry pass

`src/core/registry.ts` is the pure, in-memory adapter table. `detect()` walks every registered adapter,
calls its `detect(input)`, and tracks the highest score; it returns that adapter only if the score clears
`DETECT_THRESHOLD`, otherwise `undefined` (`src/core/registry.ts:30-41`). The threshold is `0.5`
(`src/core/registry.ts:10`), inclusive: a score of exactly `0.5` clears.

- **One pass, one winner.** Every adapter is scored against the same input; the best above the floor wins.
  No format-to-format probing, no extension lookup.
- **No match is a real outcome.** When nothing clears `0.5`, `detect()` returns `undefined` and the caller
  reports the file as unrecognized rather than guessing (`src/cli.ts:185-192`, `src/cli.ts:322-326`).
- **Selection is strict-greater, so scores are spread on purpose.** The comparison is `s > score`, so an
  equal later score never displaces an earlier one; the confidence ladder below is chosen distinct enough
  that detection never depends on registration order.

Detection is the first step of every top-level operation: `vaud convert`, `vaud inspect`, `vaud validate`,
and `vaud label` all resolve the source with `registry.detect(input)` before doing anything else
(`src/cli.ts:185`, `src/cli.ts:241`, `src/cli.ts:286`, `src/cli.ts:322`), and so does the studio's inspect
endpoint (`src/ui/server-engine.ts:58`).

## Confidence scores

`detect()` returns a number in the range `0` to `1`: `0` means "not mine", higher means more certain
(`src/core/adapter.ts:43-44`). The scores are hand-chosen so a more specific reader outranks a generic one
that shares the same wire shape. Three patterns cover it:

- **Specific outranks generic on the same shape.** SillyTavern is the generic Tavern reader and scores
  `0.9` on a recognizable card. RoleCall shares the CCv3 wire shape but claims `1.0` only on a card carrying
  an `extensions.rolecall` block, so it wins detection for its own cards; on a plain CCv3 card RoleCall
  returns `0` and the generic `sillytavern` reader takes it at `0.9` (`src/core/detection.test.ts:28-37`,
  `src/formats/rolecall/rolecall.test.ts:64-66`). This is the load-bearing gradient, and the final narrowing
  in the figure above.
- **A weaker signal still scores in-band.** Backyard scores `0.9` on its own legacy card but only `0.55` on
  a bare `{ persona }` object, which barely clears the floor, and `0` on another format's shape
  (`src/formats/backyard/backyard.test.ts:26-32`). A low-but-positive score is a deliberate "I can read
  this, weakly", not a bug.
- **A sub-threshold floor is a soft no.** The native `vaud-json` reader returns `1` for a real canonical
  entity but `0.1` for any other parseable JSON (`src/formats/vaud-json/index.ts:32`). The `0.1` never
  clears `0.5`, so it cannot win; it only expresses "this is at least JSON" without claiming the file.

The per-adapter scores are owned by each format page, not repeated here; for the full roster see the
generated [FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md), and for one family's scores in prose see
[formats/sillytavern.md](../formats/sillytavern.md), "Detection".

## Not detection: the origin labeler

`vaud label` runs a second, separate scoring pass and reports its own `confidence`. Do not conflate it with
`detect()`. After detection has already chosen the format, `labelCard` guesses which app most likely
authored the card by testing app-namespaced extension blocks, and returns the winning rule's weight as a
`0` to `1` confidence (`src/entities/character/provenance.ts:120-140`, `src/cli.ts:286-289`). That weight
answers "where is this card from", a heuristic; `detect()`'s confidence answers "which adapter reads this
file", the routing decision. They are different numbers from different passes.

## The cross-kind firewall

Character, lorebook, persona, and regex adapters all live in one registry and are scored in one `detect()`
pass. So a detector must return `0` on another kind's files, or it would steal them. This is the cross-kind
firewall (`architecture.md`, "The cross-kind firewall").

The load-bearing case is the character-versus-lorebook collision. A SillyTavern worldbook is also
`{ name, ... }` JSON, so a naive V1-character path would false-positive on it. The SillyTavern character
reader's flat/v1 branch is therefore tightened to require a real character signal (`description`,
`personality`, `scenario`, `first_mes`, or `mes_example`), which a worldbook never carries, so the
worldbook routes to `sillytavern-lorebook` instead (`src/core/detection.test.ts:74-78`; the tightening rule
is documented in [formats/sillytavern.md](../formats/sillytavern.md), "Detection"). The same discipline
keeps Pygmalion, Backyard, Agnai, and the native `vaud-json` shapes from colliding
(`src/core/detection.test.ts:48-102`).

`src/core/detection.test.ts` is the firewall itself: it registers every format, then asserts each format's
own sample routes to exactly the right adapter. That is the property that keeps the engine modular. Dropping
in a new format folder is allowed to add a detector, but it must not silently steal detection from an
existing one, and this test is what proves it.

A second, complementary layer sits at the type level. `FormatAdapter` is a `kind`-discriminated union, and
`convertFile` narrows on `kind` before it ever calls `fromCanonical`, throwing on a cross-kind pair rather
than producing garbage (`src/core/adapter.ts:99-106`, `src/convert.ts:103-114`). Detection keeps the wrong
kind from being picked; the union keeps a wrong-kind call from being representable. See
[architecture.md](../architecture.md), "The adapter contract".

## Adding a format never edits detection

Each format folder owns its own `detect()`. The registry is pure and never enumerates formats; the loader
discovers every `src/formats/*/index.ts` and registers what it default-exports (`src/core/loader.ts:20-37`,
`architecture.md`, "Folders-as-schema"). To add a format you write its `detect` in the new folder and pick a
score that fits the gradient; no core file changes. The firewall test above is the safety net that catches a
score that reaches into another format's territory.

## Source of truth

| Concern | File |
| --- | --- |
| Registry table, `detect()`, `DETECT_THRESHOLD` | `src/core/registry.ts` |
| Adapter `detect` contract, kind-discriminated union | `src/core/adapter.ts` |
| Folders-as-schema loader (registration order) | `src/core/loader.ts` |
| Cross-kind firewall property test | `src/core/detection.test.ts` |
| Type-level kind guard on conversion | `src/convert.ts` |
| `AdapterInput` build, detect call sites | `src/cli.ts`, `src/ui/server-engine.ts` |
| Origin labeler (separate confidence pass) | `src/entities/character/provenance.ts` |
| Generated adapter roster | `docs/FORMAT-SUPPORT.md` |
