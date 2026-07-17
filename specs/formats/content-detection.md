# Spec: Content Type Detection

**Package:** `packages/formats` · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/png-embedding.md, specs/formats/chara-card-v2.md, specs/formats/chara-card-v3.md,
specs/formats/rolecall-character.md, specs/formats/st-worldinfo.md, specs/formats/st-preset.md,
specs/formats/personas.md, specs/formats/regex-scripts.md
**VAUDEVILLE reference:** `apps/rc/src/lib/imports/content-detector.ts`,
`apps/rc/src/lib/library/json-parsers.ts`, `apps/rc/src/lib/library/png-parser.ts`
(all read-only reference; see docs/05-EXTRACTION-MAP.md)

## Purpose

Before any codec can parse a file, something has to decide which codec to hand it
to. Content detection is that triage step: given a file's name, bytes, and (for
JSON) parsed structure, decide which canonical content type it most likely is
(`character`, `persona`, `preset`, `lorebook`, `regex`, `chat`, `unknown`) with a
confidence level and a human-readable reason. This runs ahead of parsing in three
places: the CLI's `vaud inspect`/`vaud import` auto-detect path, the bundle importer
classifying files inside a mixed ZIP (see `bundle-import.md`), and any future studio
drag-and-drop surface. Detection never parses a file with a format-specific codec to
decide its type; it uses cheap structural/keyword heuristics so misdetection is fast
to fix and cheap to test against the fixture corpus. Detection is advisory: codecs
still validate on their own terms, and a detection result of `unknown` or a wrong
guess must never cause data loss, only a routing failure the user can override.

## Behavior

### Overview: three detectors, one dispatcher

VAUDEVILLE's `content-detector.ts` implements three independent detection
functions plus a dispatcher, and this package ports the same shape:

1. `detectPngType(buffer)` — PNG files. Fast tEXt-chunk keyword scan, falling back
   to a structural check on the fully parsed character-card JSON.
2. `detectJsonTypeEnhanced(data)` — parsed JSON objects. Delegates the structural
   decision to `detectJsonType(data)` (from `json-parsers.ts`) and wraps it with a
   confidence/reason envelope.
3. `detectJsonLType(text)` — JSONL chat exports. Line-based structural check,
   including SillyTavern's two-line "hybrid" chat export shape (metadata header +
   message lines).
4. `detectFileType(file)` — the dispatcher. Branches purely on file extension
   (`.png` / `.json` / `.jsonl`) and calls the matching detector above. Extensions
   not in that set return `unknown` immediately; content is never sniffed without
   an extension hint in the ported model (see Non-goals).

All four functions return the same shape:

```ts
interface DetectionResult {
  type: DetectedType;                         // 'character' | 'persona' | 'preset'
                                               // | 'lorebook' | 'regex' | 'chat' | 'unknown'
  confidence: 'high' | 'medium' | 'low';
  reason: string;                             // human-readable, shown in CLI reports
}
```

Naming note: this union is deliberately NOT the same type as `core`'s canonical
`ContentType` (the `type` discriminator on the `Entity<T>` envelope in
canonical-model.md). Core's `ContentType` enumerates canonical *entities*
(`character`, `lorebook`, `preset`, `persona`, `regex`, `production`); detection's
`DetectedType` adds `chat` and `unknown` (neither of which is a canonical entity)
and omits `production` (never a detected import). Defining a second type with the
same name in `packages/formats` would collide with the one imported from `core` and
let a `'chat'`/`'unknown'` value silently type-check against a canonical field, so
this module names its own union `DetectedType`. It does not import core's
`ContentType`.

(VAUDEVILLE's `ContentType` union does not include `'regex'` — `apps/rc/src/lib/imports/content-detector.ts:18`
only has `'character' | 'persona' | 'preset' | 'lorebook' | 'chat' | 'unknown'`, even
though `json-parsers.ts`'s `LibraryItemType` union does include `'regex'`
(`json-parsers.ts:252`) and `detectJsonType` can return it. This package's
`ContentType` MUST include `'regex'` — dropping it silently downgrades any detected
regex-script JSON to `'unknown'` through `detectJsonTypeEnhanced`'s missing branch.
This is a bug in the VAUDEVILLE reference, not a fact to reproduce; see Edge case 1.)

### `detectPngType` — the fast latin1 chunk scan

Source: `apps/rc/src/lib/imports/content-detector.ts:32-102`.

1. Decode the entire PNG buffer as a `latin1` string (`Buffer.from(buffer).toString('latin1')`).
   latin1 is a 1-byte-per-char decode with no multi-byte collation and no decode
   errors on arbitrary binary, so this is safe to run over a full image blob purely
   to substring-search it — it is not used to recover text content, only to locate
   byte sequences.
2. Test, in this exact order, for the literal substrings (the trailing sequence is
   a literal backslash-u-zero-zero-zero-zero escape in the source, i.e. an actual
   NUL byte, written here as `<NUL>` for clarity):
   - `'ccv3<NUL>'` -> `{ type: 'character', confidence: 'high', reason: 'Found ccv3 (V3 character card) keyword in PNG metadata' }`
   - `'chara<NUL>'` -> `{ type: 'character', confidence: 'high', reason: 'Found chara (character card) keyword in PNG metadata' }`
   - `'persona<NUL>'` -> `{ type: 'persona', confidence: 'high', reason: 'Found persona keyword in PNG metadata (RoleOut format)' }`
   The trailing NUL is load-bearing: a PNG tEXt/zTXt/iTXt chunk is encoded as
   `keyword + 0x00 + text`, so `keyword<NUL>` only matches an actual chunk keyword
   boundary, never a substring occurring inside the base64 payload or decoded card
   text. (Null bytes cannot occur inside a base64-encoded payload's latin1 decode,
   since the base64 alphabet is a 65-character ASCII subset with no code point 0;
   the only null bytes in the raw chunk bytes are the keyword/text separators.)
   See Edge case 2 for why `'persona<NUL>'` also matches the `rcpersona` keyword.
3. If none of the three matched, fall back to a full structural parse via
   `parseCharacterCard(buffer)` (`png-parser.ts`, ported by `png-embedding.md`):
   - If parsing fails or `data` is null: `{ type: 'unknown', confidence: 'low', reason: 'PNG does not contain recognized metadata' }`.
   - If parsing succeeds and `rawJson` has both a `title` and a `content` key at
     the top level: `{ type: 'persona', confidence: 'medium', reason: 'PNG contains persona-like structure (title + content)' }`.
     This is the RoleOut legacy persona shape (`personas.md`), which historically
     shipped under bespoke or malformed chunk keywords that the fast scan cannot
     catch.
   - Otherwise: `{ type: 'character', confidence: 'medium', reason: 'PNG contains valid character card data' }`.
4. Any exception during the whole function (extraction failure, invalid PNG
   signature, JSON parse error inside `parseCharacterCard`) is caught and returned
   as `{ type: 'unknown', confidence: 'low', reason: 'Failed to parse PNG: <message>' }`.

Rationale for keyword-first with fallback, and for the exact ordering (`ccv3` before
`chara` before `persona`): a PNG can carry multiple tEXt chunks (e.g. a card
re-exported by a tool that preserves an old `chara` chunk alongside a new `ccv3`
one); V3 must win because it is the more complete/current representation
(`png-parser.ts:11,58,73` documents the same precedence for the actual data read,
not just detection: "ccv3 takes precedence if both exist"). Checking `chara` before
`persona` prevents a card whose *content* happens to contain the word "persona" in
its description text from being misrouted — see Edge case 2 / historical bug.

### `detectJsonTypeEnhanced` / `detectJsonType` — structural JSON detection

Source: `content-detector.ts:107-155` wraps `json-parsers.ts:261` (`detectJsonType`).

`detectJsonTypeEnhanced(data)`:
1. If `data` is not a non-array object, return `{ type: 'unknown', confidence: 'low', reason: 'Invalid JSON structure (not an object)' }` immediately — this rejects bare arrays and primitives before the structural checks run.
2. Otherwise call `detectJsonType(data)` and wrap its result in a `DetectionResult` with `confidence: 'high'` for every recognized type and `confidence: 'low'` for `'unknown'`. The reason strings are fixed per type (see field table below) and do not vary with which sub-check matched.

`detectJsonType(data)` (`json-parsers.ts:261-268`) tries five structural
predicates **in a fixed priority order** and returns the type of the first one
that matches:

```
1. isPersona(data)      -> 'persona'
2. isCharacter(data)     -> 'character'
3. isLorebook(data)      -> 'lorebook'
4. isRegexScript(data)   -> 'regex'
5. isPreset(data)        -> 'preset'
   (none matched)        -> 'unknown'
```

The order is deliberate and documented in the source comment
(`json-parsers.ts:256-260`):
- `persona` is checked before `character` because the RC "loose" persona shape
  (`{ name, details: {...} }` with no `first_mes`/`mes_example`/`personality`) would
  otherwise be caught by the V1 character heuristic (`name` + one of
  `description`/`personality`/`scenario`), since `details` objects in the wild
  sometimes carry a `description`-shaped field. Checking persona first prevents
  that false positive.
- `character` is checked before `lorebook` to avoid V1 character JSON (flat
  `{ name, description, ... }` with no `entries` key) ever reaching the lorebook
  check — this is defensive; a V1 character has no `entries` field so it would not
  match `isLorebook` anyway, but the ordering keeps the guarantee explicit as the
  predicates evolve.
- `regex` is checked before `preset` because a SillyTavern regex-script wrapper
  object (`{ data: [...] }`) does not collide with `isPreset`'s checks, but a bare
  array of regex rule objects could otherwise be miscategorized if a future preset
  predicate loosened to accept arrays; checking regex first is the safety margin.

Each predicate, from `json-parsers.ts`:

| Predicate | Match rule | Source |
|---|---|---|
| `isPersona` | `obj.spec === 'rolecall_persona'` with `obj.data` an object whose `name` is a string (RC native), OR `obj.name` is a string AND `obj.details` is an object containing at least one of `signatureColor`/`colors`/`traits`/`appearance` AND none of `obj.first_mes`/`obj.mes_example`/`obj.personality` are present (loose format) | `json-parsers.ts:221-246` |
| `isCharacter` | `obj.spec === 'chara_card_v3'` or `'chara_card_v2'` with `obj.data.name` a string, OR (V1) `obj.name` is a string and at least one of `obj.description`/`obj.personality`/`obj.scenario` is present | `json-parsers.ts:60-84` |
| `isLorebook` | `obj.entries` is present and is an object (array or keyed-object form both pass; no check that any entry has content) | `json-parsers.ts:117-129` |
| `isRegexScript` | wrapped form `{ data: [...] }` where every element has a string `findPattern`/`scriptName`/`name`; OR a bare non-empty array where every element has one of those same three string fields; OR a single object with `findPattern` or `scriptName` string, or both `name` and `findPattern` strings | `json-parsers.ts:174-212` |
| `isPreset` | `Array.isArray(obj.prompts)` OR any of `temperature`/`top_p`/`top_k`/`frequency_penalty`/`presence_penalty` is a number | `json-parsers.ts:93-108` |

Note `isLorebook` (used directly by `detectJsonType`) is a structural presence
check only — it does not require any entry to have content. `parseLorebook`
(also in `json-parsers.ts:134-165`, not part of detection) applies the stricter
"at least one entry has content" rule at parse time, which can reject a file that
detection already classified as `lorebook`. Detection and parse validity are
different questions; see Edge case 5.

### `detectJsonLType` — JSONL chat detection

Source: `content-detector.ts:160-222`.

1. Split on `\n`, trim, drop empty lines. Empty file -> `unknown`/`low`/`'Empty JSONL file'`.
2. Parse line 0. Determine if it is an ST "hybrid" metadata header: an object
   containing `user_name` or `character_name`, and containing **neither** `mes`
   nor `content`. (`isHybridHeader`, `content-detector.ts:177-182`.)
3. If it is a hybrid header and there is a line 1, parse line 1 as the message
   line to test; otherwise test line 0 itself.
4. The tested message line qualifies as chat if it is an object containing at
   least one of `mes`/`message`/`content` AND at least one of `name`/`role`/`is_user`.
   -> `{ type: 'chat', confidence: 'high', reason: '...' }` (reason text differs
   between the hybrid and non-hybrid path, see source).
5. If the message line did not qualify but line 0 WAS a hybrid header (i.e. a
   header with no messages after it, or whose second line doesn't look like a
   message), it is still classified `chat` at `confidence: 'medium'`,
   reason `'JSONL contains ST chat metadata header with no messages'` — this is a
   legal degenerate export (an empty chat) and must not be dropped from bulk
   imports.
6. Otherwise `unknown`/`low`/`'JSONL does not match chat export format'`.
7. Any JSON parse exception on line 0 (or line 1, when read) is caught and
   returned as `unknown`/`low`/`'Failed to parse JSONL: <message>'`.

### `detectFileType` — the dispatcher

Source: `content-detector.ts:227-251`.

Branches on the lowercased filename's extension only, in this order:
`.png` -> `detectPngType` (reads the file as `ArrayBuffer`); `.json` ->
`JSON.parse` the file text then `detectJsonTypeEnhanced` (a JSON parse error here
is NOT caught inside `detectFileType` in the VAUDEVILLE source — it throws to the
caller; see Edge case 3); `.jsonl` -> `detectJsonLType` on the raw text. Any other
extension (including no extension, `.charx`, `.zip`) returns
`{ type: 'unknown', confidence: 'low', reason: 'Unsupported file extension: <ext>' }`
without inspecting content at all.

### Priority ordering, summarized

Two independent priority orders exist and must not be conflated:

1. **Extension routing** (`detectFileType`): `.png` / `.json` / `.jsonl` are the
   only recognized extensions; there is no content-sniffing fallback for
   unrecognized or missing extensions (see Non-goals — `.charx` is a zip and is out
   of scope for this file-level dispatcher; `bundle-import.md` owns zip
   classification).
2. **Structural priority within JSON** (`detectJsonType`): `persona` >
   `character` > `lorebook` > `regex` > `preset`. This order exists specifically to
   resolve ambiguous JSON shapes that satisfy more than one predicate; it is not
   an importance ranking, it is a disambiguation order and must be preserved
   exactly on port (reordering it reintroduces the false positives the comments at
   `json-parsers.ts:256-260` describe).

PNG detection has its own three-way keyword priority (`ccv3` > `chara` > `persona`),
independent of the JSON structural order, documented above.

### Documented misdetection regression cases (must become fixtures)

Both are called out directly in the VAUDEVILLE source comments and must be ported
as permanent fixtures per `escrow-and-roundtrip.md`'s fixture corpus rule ("every
past misdetection/parsing bug becomes a permanent fixture").

1. **Substring-anywhere-in-blob bug.** An earlier version of `detectPngType`
   tested `text.includes('persona')` and `text.includes('chara')` against the
   *entire* latin1-decoded PNG buffer, not just chunk keywords, and checked
   `persona` before `chara`. A character card whose description/personality text
   merely contained the word "persona" anywhere (common: "she has a bubbly
   persona") was misdetected as a `persona` file instead of `character`, because
   the substring existed somewhere in the ~1.5MB decoded blob (the base64 payload
   decoded to text that contains the word) regardless of chunk keyword. Documented
   at `content-detector.ts:38-44`. The current code fixes this two ways at once:
   requiring the trailing NUL keyword terminator, AND checking `chara`/`ccv3`
   before `persona`. **Fixture needed:** a character-card PNG (`chara` or `ccv3`
   keyword) whose `description` or `personality` field contains the literal word
   "persona" — must detect as `character`, `high` confidence.
2. **Ordering bug (persona before chara).** Same source comment,
   `content-detector.ts:39`: independent of the substring bug, checking `persona`
   before `chara` at all is wrong once a card can carry both a `persona`-adjacent
   *and* a `chara` keyword-bearing chunk (or once the substring bug above is in
   play) — V3/V2 character detection must win. **Fixture needed:** covered by the
   ccv3-before-chara-before-persona ordering test already implied above; add one
   PNG with both a `chara` and a `persona`-adjacent chunk if such a real export
   exists, else a synthetic fixture with `notes.md` stating it's synthetic per
   the corpus rules.
3. **`apps/plot`'s content-detector.ts still has the unfixed bug.** VAUDEVILLE's
   sibling app `apps/plot/src/lib/imports/content-detector.ts` was not patched
   with the RC fix: it still checks `text.includes('persona')` /
   `text.includes('chara')` (no null terminator, whole-buffer substring) and
   checks `persona` before `ccv3`/`chara`
   (`apps/plot/src/lib/imports/content-detector.ts:37-62`). This package must NOT
   port the `apps/plot` behavior; `apps/rc`'s is the corrected, ground-truth
   version. Noted here only so a future audit doesn't "fix" this spec back toward
   the buggy variant by cross-referencing the wrong app.

## Public API sketch

```ts
// packages/formats/src/detection/types.ts

export type ContentType =
  | 'character'
  | 'persona'
  | 'preset'
  | 'lorebook'
  | 'regex'
  | 'chat'
  | 'unknown';

export type Confidence = 'high' | 'medium' | 'low';

export interface DetectionResult {
  type: ContentType;
  confidence: Confidence;
  reason: string;
}

// packages/formats/src/detection/png.ts
export function detectPngType(buffer: ArrayBuffer): Promise<DetectionResult>;

// packages/formats/src/detection/json.ts

// Structural type-only classifier (no confidence wrapper). Mirrors
// json-parsers.ts detectJsonType exactly, including priority order and the
// 'regex' branch that VAUDEVILLE's DetectionResult union currently omits.
export type StructuralJsonType =
  | 'persona' | 'character' | 'lorebook' | 'regex' | 'preset' | 'unknown';
export function detectJsonType(data: unknown): StructuralJsonType;

export function detectJsonTypeEnhanced(data: unknown): DetectionResult;

// packages/formats/src/detection/jsonl.ts
export function detectJsonLType(text: string): DetectionResult;

// packages/formats/src/detection/dispatch.ts

// file: an abstraction over {name: string, arrayBuffer(): Promise<ArrayBuffer>,
// text(): Promise<string>} so this works over both browser File and Node
// filesystem reads without an app-specific File type. CLI callers pass a small
// adapter wrapping a Buffer/path read.
export interface DetectableFile {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export function detectFileType(file: DetectableFile): Promise<DetectionResult>;
```

## Edge cases & failure modes

1. **`ContentType` must include `'regex'`.** VAUDEVILLE's `content-detector.ts`
   `ContentType` union (`:18`) omits `'regex'` even though `detectJsonType` can
   return it (via `isRegexScript`), and `detectJsonTypeEnhanced` (`:107-155`) has
   no `if (type === 'regex')` branch — a regex-script JSON silently falls through
   every `if` to the final `unknown`/`low` return. This package's port MUST add
   the `regex` branch and the union member. Required behavior: a regex-script
   JSON detects as `{ type: 'regex', confidence: 'high', reason: '...' }`.
2. **`'persona<NUL>'` also matches the `rcpersona` keyword.** The keyword `rcpersona`
   ends in the literal substring `persona`, so `text.includes('persona ')`
   is true for an `rcpersona<NUL>...` chunk exactly as it is for a `persona<NUL>...`
   chunk. This is not flagged as a bug in the source and the outcome is actually
   correct (both keywords are persona-family), but it means the fast-scan branch
   never actually distinguishes RC-native (`rcpersona`) from RoleOut-legacy
   (`persona`) at the detection layer — that distinction is only made later, at
   parse time, by the codec (see `personas.md`, `png-embedding.md`). Required
   behavior: preserve this coincidental match; do not "fix" it into an exact
   per-keyword check without confirming with `personas.md`'s parse-time handling
   first, since downstream code may rely on both routing to the same detector
   branch.
3. **`detectFileType` does not catch `JSON.parse` failures for `.json` files.**
   In the VAUDEVILLE source, `JSON.parse(text)` inside the `.json` branch of
   `detectFileType` (`content-detector.ts:237`) is unguarded — a malformed JSON
   file throws out of `detectFileType` itself rather than returning
   `{ type: 'unknown', ... }`. Required behavior for the port: OPEN QUESTION —
   decide whether `detectFileType` should catch this and downgrade to
   `unknown`/`low`/`'Invalid JSON: <message>'` (matching the JSONL detector's own
   internal try/catch pattern), or whether callers (CLI, bundle importer) are
   expected to catch the throw themselves. The CLI's error/report surface
   (`cli-converter.md`) should settle this; until then, callers must wrap
   `detectFileType` in try/catch defensively.
4. **PNG structural fallback only recognizes the RoleOut `title`+`content` shape,
   not the RC-native `rolecall_persona` shape.** If an `rcpersona`-keyword PNG
   somehow fails the fast scan (it should not, per Edge case 2, but a chunk
   encoding oddity — e.g. a `zTXt`/`iTXt` chunk instead of `tEXt`, which the fast
   latin1 scan does not decompress — is possible) and falls through to the
   structural check, `parseCharacterCard`'s `rawJson` for an `rolecall_persona`
   payload is `{ spec: 'rolecall_persona', data: {...} }`, which has neither a
   top-level `title` nor a top-level `content` key. It falls through to the
   generic `character`/`medium` branch instead of `persona`. Required behavior:
   OPEN QUESTION — should the structural fallback also test
   `rawJson.spec === 'rolecall_persona'`? This is a real gap in the VAUDEVILLE
   source (not documented as intentional); flag for the reviewer rather than
   silently fixing, since the PNG codec's own zTXt/iTXt support is unconfirmed
   (`png-embedding.md` should state whether compressed text chunks are read at
   all — if they are never read, this edge case cannot occur in practice and the
   gap is moot).
5. **Detection says `lorebook`; parsing can still reject it.** `isLorebook`
   (used by `detectJsonType`) only checks that `entries` exists and is an object;
   `parseLorebook` additionally requires at least one entry with a `content`
   field. A JSON file with `{ entries: {} }` or `{ entries: { "0": {} } }`
   (no content anywhere) detects as `lorebook`/`high` but fails to parse.
   Required behavior: this is by design — detection answers "which codec should
   try this file," parsing answers "is it valid." The CLI/report layer must
   surface the parse failure distinctly from a detection failure (`cli-converter.md`).
6. **Empty/whitespace-only `.jsonl` file.** Returns `unknown`/`low`/`'Empty JSONL
   file'` per step 1 of `detectJsonLType`. Not an error.
7. **JSONL hybrid header with a non-message second line.** If line 0 is a hybrid
   header and line 1 exists but does not look like a message (fails the
   `mes`/`message`/`content` + `name`/`role`/`is_user` test), the result is
   `unknown`/`low`, NOT the degenerate `chat`/`medium` case — the degenerate case
   only fires when there IS no line 1 (`lines.length > 1` gates which line is
   tested; when false, line 0 itself, the header, is re-tested against the
   message predicate and fails, but `isHybridHeader` is still true so step 5's
   condition is met). Re-derive carefully on port: the medium-confidence
   "header with no messages" path is reached only through the `isHybridHeader &&
   !qualifiesAsChat` fallthrough, not through a separate line-count check standing
   alone. Fixture required to pin this down: a two-line JSONL where line 0 is a
   valid header and line 1 is JSON but not message-shaped (e.g. `{}`) — expected
   result per current source logic: `unknown`/`low` (line 1 was tested and
   failed; `isHybridHeader` remains true but line 1 existing means step 5's
   "if (isHybridHeader)" branch is unreachable only when messageLine already
   returned true — re-trace against source before asserting; OPEN QUESTION for the
   reviewer to verify against `content-detector.ts:184-208` directly, this spec
   author traced it by hand and flags residual uncertainty).
8. **`.charx` files.** Not handled by `detectFileType` at all in VAUDEVILLE (no
   `.charx` branch); falls to the generic `Unsupported file extension` unknown
   result. `charx.md` and `bundle-import.md` own zip-based detection separately;
   this spec's `detectFileType` is not the entry point for `.charx` files. See
   Non-goals.
9. **Case sensitivity.** `detectFileType` lowercases the filename before the
   extension check (`name.toLowerCase()`), so `CARD.PNG` and `card.png` both
   route correctly. PNG keyword matching (`ccv3`, `chara`, `persona`) is
   case-sensitive and matches the literal lowercase keywords only — the PNG tEXt
   keyword spec itself does not mandate lowercase, but every known exporter
   (SillyTavern, RoleCall) writes these lowercase; a keyword like `Chara` would
   fall through to the structural fallback. OPEN QUESTION: has any real exporter
   been observed writing a differently-cased keyword? If not, no fixture is
   needed and this is documented behavior, not a gap.
10. **Ambiguous JSON matching multiple predicates.** Because `detectJsonType`
    short-circuits on the first predicate that matches, any JSON object that
    happens to satisfy two predicates (e.g. a preset-shaped object that also has
    a spurious top-level `entries` array) silently resolves to whichever
    predicate is earlier in the fixed order. This is intentional per the source
    comments, but every such real-world collision found in the fixture corpus
    should get a fixture + `notes.md` explaining which predicates it satisfies
    and why the winning one is correct.

## Test plan

Fixtures live under `fixtures/detection/` (new corpus subtree; distinct from
per-codec `fixtures/<format>/` since detection fixtures test the triage step, not
round-trip parse/serialize).

- `fixtures/detection/png/ccv3-and-chara-both-present.png` — dual-chunk card;
  expect `character`/`high` via ccv3 branch (Behavior, PNG step 2).
- `fixtures/detection/png/chara-only.png`, `ccv3-only.png`, `persona-only.png`,
  `rcpersona-only.png` — one keyword each; expect `character`/`high`,
  `character`/`high`, `persona`/`high`, `persona`/`high` respectively (rcpersona
  via the coincidental substring match, Edge case 2).
- `fixtures/detection/png/misdetect-persona-substring.png` — Regression case 1:
  a `chara`-keyword card whose `description` field contains the literal word
  "persona"; expect `character`/`high`.
- `fixtures/detection/png/roleout-legacy-no-keyword.png` — a card with a
  non-standard/unrecognized chunk keyword carrying RoleOut `{title, content}`
  JSON; expect `persona`/`medium` via structural fallback.
- `fixtures/detection/png/corrupt-not-a-png.png` — a `.png`-named file that
  isn't a valid PNG signature; expect `unknown`/`low`, reason starts with
  `'Failed to parse PNG:'`.
- `fixtures/detection/json/persona-native.json`, `persona-loose.json`,
  `character-v1.json`, `character-v2.json`, `character-v3.json`,
  `lorebook-st.json`, `lorebook-empty-entries.json` (Edge case 5),
  `regex-wrapped.json`, `regex-bare-array.json`, `regex-single.json`,
  `preset-prompts.json`, `preset-samplers-only.json`, `unknown-bare-array.json`
  (top-level array; expect `unknown`/`low` via the `Array.isArray` guard),
  `unknown-empty-object.json`.
- `fixtures/detection/json/ambiguous-persona-vs-v1-character.json` — the
  specific collision `isPersona`'s ordering exists to prevent (Behavior,
  structural priority section); expect `persona`/`high`.
- `fixtures/detection/jsonl/chat-plain.jsonl`, `chat-hybrid-header.jsonl`,
  `chat-hybrid-header-no-messages.jsonl` (degenerate case), `chat-hybrid-header-second-line-not-message.jsonl`
  (Edge case 7, resolve the OPEN QUESTION there first), `empty.jsonl`,
  `malformed.jsonl` (invalid JSON on line 0; expect `unknown`/`low`, reason
  starts with `'Failed to parse JSONL:'`).
- `fixtures/detection/dispatch/unsupported-extension.charx`,
  `unsupported-extension.zip`, `no-extension` — all expect
  `unknown`/`low`/`'Unsupported file extension: ...'` (or the appropriate
  message for a file with no extension at all — OPEN QUESTION: what does
  `name.split('.').pop()` return for a file with no dot, and does the message
  read sensibly? Verify against the ported `detectFileType` implementation
  directly since VAUDEVILLE's `.split('.').pop()` on `"README"` returns
  `"README"` itself, not empty string, giving a slightly odd but not wrong
  message).

Round-Trip Law applicability: none. Detection has no serialize direction; it is
not subject to the Round-Trip Law. Each detection fixture instead asserts a fixed
expected `DetectionResult` (`type`, `confidence`, and either the exact `reason`
string or a documented prefix match, per fixture).

Property/unit tests beyond fixtures:
- Priority-order test: construct a synthetic object satisfying two predicates
  simultaneously for every adjacent pair in the priority chain
  (persona-vs-character, character-vs-lorebook, lorebook-vs-regex,
  regex-vs-preset) and assert the earlier one wins, pinning the order itself
  against regression independent of any single fixture file.
- `detectFileType` extension case-insensitivity test (`CARD.PNG`, `Card.Json`).
- Exception-safety test: feed `detectPngType` a truncated/corrupt buffer and
  assert it returns a `DetectionResult`, never throws.

## Non-goals

- Does not classify `.charx` (zip) files — that is `charx.md`'s and
  `bundle-import.md`'s job (zip-first classification, then per-entry detection
  using this module's JSON/PNG detectors on the extracted members).
- Does not classify Backyard `.json` exports as a distinct detected type; Backyard
  cards currently pass through the same `isCharacter`-family structural checks as
  any other character JSON at the VAUDEVILLE ground truth (no Backyard-specific
  predicate exists in `json-parsers.ts`). `backyard.md` owns whether that needs a
  dedicated predicate; if so, that predicate is an addition to this spec's
  priority chain, not a silent behavior change.
- Does not validate content beyond the structural shape needed to distinguish
  types — full validation is the codec's job at parse time (Edge case 5).
- Does not content-sniff files with no recognized extension. There is no magic-byte
  fallback for extensionless or wrongly-extensioned files; `detectFileType` trusts
  the extension for dispatch, and only the PNG branch additionally verifies the
  actual PNG signature once dispatched.
- Does not resolve which codec version (V2 vs V3, ST vs Agnai world info variant)
  applies — that finer-grained version detection lives in each codec's own spec
  (`chara-card-v3.md`, `st-worldinfo.md`).
- Does not attempt to detect mime type from HTTP headers or similar transport-level
  metadata; input is always a named file/buffer.

## Sources consulted

- `<RoleCall>\apps\rc\src\lib\imports\content-detector.ts`
  (full file, 252 lines) — `detectPngType` :32-102, `detectJsonTypeEnhanced` :107-155,
  `detectJsonLType` :160-222, `detectFileType` :227-251, misdetection comment :38-44,
  hybrid-header comment :171-175, `ContentType` union :18.
- `<RoleCall>\apps\rc\src\lib\library\json-parsers.ts`
  (full file, 295 lines) — `isPersona` :221-246, `isCharacter` :60-84, `isLorebook`
  :117-129, `parseLorebook` :134-165, `isRegexScript` :174-212, `isPreset` :93-108,
  `detectJsonType` :261-268 and its priority-order comment :256-260,
  `LibraryItemType` union :252.
- `<RoleCall>\apps\rc\src\lib\library\png-parser.ts` —
  `readCharacterData` chunk-priority comment :10-12, :57-58, :73-126;
  `parseCharacterCard` V2/V3 branch :174-182, RC-native persona branch :184-223,
  RoleOut legacy branch :225-247.
- `<RoleCall>\apps\plot\src\lib\imports\content-detector.ts`
  (full file, 219 lines) — cited only to document that it retains the unfixed
  substring/ordering bug (:37-62) that `apps/rc`'s version fixed; not used as
  ground truth for behavior.
- `docs\05-EXTRACTION-MAP.md:44-45` —
  confirms the two ground-truth files and line anchors for this spec's brief.
- `docs\06-PRODUCTION-BIBLE.md:52` —
  the brief this spec was written against.
- `specs\formats\canonical-model.md`,
  `escrow-and-roundtrip.md` — shared conventions (Entity envelope, escrow rules,
  fixture corpus rules) referenced above.
- `templates\SPEC-TEMPLATE.md` — structure followed.

## OPEN QUESTIONs (collected)

- OPEN QUESTION (Edge case 3): should the ported `detectFileType` catch JSON parse
  errors internally (returning `unknown`/`low`) or leave that to callers, as
  VAUDEVILLE currently does implicitly by not catching?
- OPEN QUESTION (Edge case 4): should the PNG structural fallback also recognize
  `rawJson.spec === 'rolecall_persona'` as a persona signal, given the RoleOut
  `title`+`content` shape it currently checks does not match RC-native persona
  JSON? Depends on whether `png-embedding.md` confirms zTXt/iTXt chunks (the only
  realistic way this fallback path is reached for an rcpersona card) are read at
  all.
- OPEN QUESTION (Edge case 7): confirm by direct trace against
  `content-detector.ts:184-208` (or the ported equivalent) exactly which branch a
  two-line JSONL with a valid hybrid header and a non-message-shaped second line
  resolves to; this spec's hand-trace flags residual uncertainty.
- OPEN QUESTION (Test plan, dispatch fixtures): confirm the exact `reason` string
  produced by `detectFileType` for a file with no extension at all (behavior of
  `name.split('.').pop()` on a dot-less filename), and whether that message reads
  sensibly enough to keep verbatim or should be special-cased.
- OPEN QUESTION (Non-goals / Backyard): does `backyard.md` require a dedicated
  `isBackyardCharacter` structural predicate distinct from the generic
  `isCharacter` chain, or is Backyard JSON already distinguishable by an existing
  predicate? Resolve when `backyard.md` is written and update this spec's
  priority-chain table if a new predicate is added.
