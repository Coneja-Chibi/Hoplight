# Spec: PNG tEXt Embedding

**Package:** `packages/formats` (module: `formats/png`) · **Milestone:** M0 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md, specs/formats/chara-card-v2.md, specs/formats/chara-card-v3.md, specs/formats/rolecall-character.md, specs/formats/personas.md
**VAUDEVILLE reference:** apps/rc/src/lib/library/png-parser.ts, apps/rc/src/lib/formats/png/writer.ts, apps/rc/src/lib/imports/content-detector.ts, apps/rc/src/lib/exports/persona-export.ts

## Purpose

Character cards, RoleCall personas, and legacy RoleOut personas are commonly
distributed as a single PNG image (the card's portrait) with the actual data
embedded inside a PNG `tEXt` metadata chunk, base64-encoded. This spec defines
how Vaudeville Studios reads that embedded data out of an arbitrary PNG file
and how it writes data back into a PNG while preserving everything else about
the image. This module is the transport layer only: it produces a raw JSON
string (or `null`) from a PNG buffer, and it writes a raw JSON string into a
PNG buffer under a given chunk keyword. It does not itself parse chara_card
V2/V3 JSON, rcpersona JSON, or RoleOut JSON into canonical models: that is
the job of the codec that calls this module (chara-card-v2.md,
chara-card-v3.md, rolecall-character.md, personas.md) and of
content-detection.md, which decides which codec to hand the extracted string
to.

## Behavior

### PNG chunk primer (grounding, not invented)

A PNG file is a signature (8 bytes) followed by a sequence of chunks, each
`length(4) + type(4) + data(length) + CRC(4)`. A `tEXt` chunk's `data` is
`keyword` + `0x00` + `text`, where both `keyword` (1-79 bytes) and `text` are
Latin-1 (ISO-8859-1). Because embedded character/persona JSON is UTF-8 and
routinely exceeds Latin-1's range, every producer in this ecosystem (ST,
Chub, RoleCall) base64-encodes the JSON string before writing it as the
`text` field, so the on-wire bytes are always ASCII and therefore valid
Latin-1 [SRC: W3C PNG spec, tEXt; VAUD png-chunk-text@1.0.0 encode.js
throws "Only Latin-1 characters are permitted... consider base64 encoding"].
`tEXt` chunks are ancillary (lowercase first letter) and may appear anywhere
between `IHDR` and `IEND`; order among ancillary chunks is not significant to
PNG itself, but this format family always keeps the character-data chunk
somewhere before `IEND` [SRC: writer.ts:78-87 inserts before IEND].

### Read path: locating and extracting the embedded string

Ground truth: `apps/rc/src/lib/library/png-parser.ts` `readCharacterData()`
(:62-127) and `parseCharacterCard()` (:148-284).

1. Validate the PNG signature (8 magic bytes) before doing anything else
   [SRC: png-parser.ts:51-54, isPNG()].
2. Extract all chunks (`png-chunks-extract`) and filter to `name === 'tEXt'`
   only. `iTXt` and `zTXt` chunks are NOT read on this path, even though they
   are legal PNG text-chunk types [SRC: png-parser.ts:65-67, filter is
   `chunk.name === "tEXt"` with no iTXt/zTXt branch].
3. Decode each `tEXt` chunk's raw bytes into `{ keyword, text }` via
   `png-chunk-text`'s `decode()`. That decoder walks bytes until the first
   `0x00` to get `keyword`, then treats everything after as `text`, and
   THROWS if it encounters a second `0x00` inside what it now considers text
   [SRC: VAUD node_modules/.pnpm/png-chunk-text@1.0.0/.../decode.js:12-27,
   verified by reading the installed dependency]. This decoder is only
   correct for genuine `tEXt` chunks; see Edge case 6.
4. Search the decoded chunks for a matching keyword, case-insensitively
   (`chunk.keyword.toLowerCase() === "..."`), in this exact precedence order,
   returning on first match:
   1. `ccv3`: chara_card_v3 JSON (base64)
   2. `chara`: chara_card_v2 JSON (base64)
   3. `rcpersona`: RoleCall native persona JSON (base64)
   4. `persona`: legacy RoleOut persona JSON (base64)
   [SRC: png-parser.ts:74-124, four sequential `find()` calls in this order].
5. Base64-decode the matched chunk's `text` to a UTF-8 string. Node path uses
   `Buffer.from(text, 'base64').toString('utf8')`; browser path manually
   walks `atob()` output into bytes and decodes with `TextDecoder('utf-8')`
   [SRC: png-parser.ts:80-84, 132-142, decodeBase64ToUtf8()]. Both are
   correct, equivalent UTF-8-safe base64 decoders; only the runtime differs.
6. If no `tEXt` chunk exists at all, throw `"PNG metadata does not contain
   any text chunks."` If chunks exist but none matches any of the four
   keywords, throw `"PNG metadata does not contain any character data."`
   [SRC: png-parser.ts:69-71, 126].
7. `parseCharacterCard()` wraps step 1-6, then `JSON.parse()`s the result and
   branches on shape to decide what was actually found: `spec ===
   "chara_card_v2" | "chara_card_v3"` with a `data` object (V2/V3 card);
   `spec === "rolecall_persona"` with a `data` object (rcpersona, compiling
   `sections.*` into flattened `personality` text when `content` is empty);
   `name` + `title` + `content` present at top level (RoleOut legacy
   persona); `name` + (`description` or `personality`) present at top level
   with no `spec` (bare V1 flat character JSON); otherwise unrecognized
   [SRC: png-parser.ts:174-275]. This branching is reproduced faithfully by
   content-detection.md and the individual format codecs; this spec's own
   public API stops at "give me the raw JSON string for keyword K" plus a
   convenience "give me whichever keyword wins": shape interpretation
   belongs to the calling codec, not to this module.

Note: this module's job ends at "extract the JSON string." The shape
dispatch in step 7 is VAUDEVILLE's own layering choice (parser does both);
Vaudeville Studios' `formats/png` module exposes only the chunk-level
primitives (list keywords present, get raw string for a keyword, get
highest-precedence match) and lets each format codec (`formats/chara-card`,
`formats/rolecall-character`, `formats/personas`) own its own JSON shape
dispatch, per the dependency rule `core <- formats <- everything`.

### Write path: embedding and chunk preservation

Ground truth: `apps/rc/src/lib/formats/png/writer.ts` `embedCharacterData()`
(:53-91), `embedDualCharacterData()` (:103-142), and
`apps/rc/src/lib/exports/persona-export.ts` `embedPersonaInPNG()` (:65-94).

1. Extract all existing chunks from the source PNG.
2. Remove any existing `tEXt` or `iTXt` chunk whose keyword (after attempting
   to decode it) is exactly `chara` or `ccv3`: i.e. strip prior character
   data before writing new data, so a re-exported card never carries two
   competing `chara`/`ccv3` chunks [SRC: writer.ts:62-70, 112-120]. Decode
   failures during this filter are treated as "keep the chunk" (`catch {
   return true }`): a chunk that can't be decoded is assumed unrelated and
   left alone, not stripped. All other chunks (IHDR, IDAT, palette, other
   metadata, prior `rcpersona`/`persona` chunks, unrelated `tEXt` entries)
   pass through untouched. This is the "chunk preservation on write"
   guarantee: only the specific character-data keyword(s) being replaced are
   touched; the image data and every other ancillary chunk survive byte for
   byte.
3. Base64-encode the JSON string for embedding. The writer's browser-safe
   path is `btoa(unescape(encodeURIComponent(json)))` [SRC: writer.ts:73,
   123-124]; `persona-export.ts`'s Node path is
   `Buffer.from(json, 'utf8').toString('base64')` [SRC: persona-export.ts:76].
   Both are correct UTF-8-safe base64 encodings of the same string; Vaudeville
   Studios (Bun/Node runtime, per ADR-001) should standardize on the Buffer
   form since there is no browser DOM in the CLI/engine.
4. Build a new `tEXt` chunk via `png-chunk-text`'s `encode(keyword, base64Data)`.
   Because the payload is base64 (ASCII-only), it always satisfies the
   encoder's Latin-1 and no-embedded-null constraints [SRC: png-chunk-text
   encode.js:7-13, 20-36].
5. Locate the `IEND` chunk and splice the new chunk in immediately before it
   (append at the end if `IEND` is somehow missing, which "shouldn't happen
   with a valid PNG" per the source comment) [SRC: writer.ts:79-87]. `IEND`
   itself is never touched and remains the last chunk.
6. Single-format write (`embedCharacterData`) writes one keyword (default
   `'chara'`, caller may pass `'ccv3'`). Dual write (`embedDualCharacterData`)
   writes BOTH a `ccv3` chunk (V3 JSON) and a `chara` chunk (V2-shaped
   backfill JSON) in one pass, `ccv3` inserted before `chara`, both before
   `IEND`, "per V3 spec: applications MAY backfill V2 in 'chara' chunk" [SRC:
   writer.ts:93-142]. Vaudeville Studios' V3 codec should default to dual
   write for maximum reader compatibility (this is a codec-level policy
   choice, not a fact this module invents: see chara-card-v3.md).
7. Persona export (`embedPersonaInPNG`) is structurally the same
   extract-modify-splice-reencode sequence but does NOT strip any existing
   chunk first (no filter step): it always appends a fresh `rcpersona`
   chunk without checking for or removing a prior one [SRC:
   persona-export.ts:69-93, no filter/removal logic present]. Re-exporting a
   persona PNG through this path can therefore leave a stale, previously
   embedded `rcpersona` chunk behind alongside the new one, unlike the
   character-card write path. See Edge case 5.
8. Re-encode all chunks back into a PNG byte stream (`png-chunks-encode`).

### Keyword precedence summary

| Precedence | Keyword | Owner format | Payload |
|---|---|---|---|
| 1 (highest) | `ccv3` | chara_card_v3 | base64(UTF-8 JSON), `{spec:"chara_card_v3",...}` |
| 2 | `chara` | chara_card_v2 (or V3 backfill) | base64(UTF-8 JSON), `{spec:"chara_card_v2",...}` or bare V1 flat JSON |
| 3 | `rcpersona` | RoleCall native persona | base64(UTF-8 JSON), `{spec:"rolecall_persona",...}` |
| 4 (lowest) | `persona` | RoleOut legacy persona | base64(UTF-8 JSON), flat `{name,title,content,...}` |

Precedence applies only to the READ path's "what does this PNG represent"
decision when more than one keyword is present in the same file (uncommon
but legal: e.g. a card re-exported by a tool that backfills without
stripping, or a file that started as a persona and was later also stamped as
a character card). It is not a merge order; only the single highest-precedence
match's payload is returned. [SRC: png-parser.ts:74-124]

### The two documented misdetection traps

Ground truth: `apps/rc/src/lib/imports/content-detector.ts` `detectPngType()`
(:32-102), comment block at :37-44.

Both traps concern the FAST PATH: before doing a full chunk-decode, the
detector does a cheap substring scan over the whole PNG buffer reinterpreted
as Latin-1 (`Buffer.from(buffer).toString('latin1')`), looking for
`'ccv3 '`, `'chara '`, `'persona '` in that order [SRC:
content-detector.ts:35, 45-67]. Both traps are historical bugs that were
fixed and must be preserved as permanent fixtures (per
escrow-and-roundtrip.md's fixture corpus rules):

1. **Wrong check order.** The `persona\0` substring check used to run BEFORE
   the `chara\0` check. Any file that happened to contain both substrings (or
   where a scanning implementation short-circuited on the first hit checked)
   could be misclassified as a persona when it was actually a character
   card. Fixed by checking character keywords (`ccv3`, `chara`) strictly
   before `persona`. [SRC: content-detector.ts:38-39 comment: "`persona` was
   checked BEFORE `chara`"]
2. **Unanchored substring match.** The scan used to match the word
   `"persona"` appearing ANYWHERE in the up-to-1.5MB binary blob, including
   inside the base64-encoded IMAGE data or inside ordinary character-card
   prose (a card whose `description` or `first_mes` field merely contains
   the English word "persona": very common in RP text) rather than the
   literal PNG chunk keyword. Fixed by requiring the match include the
   trailing null terminator (`'persona '`) that only appears at a true
   chunk-keyword boundary, not a substring occurring inside chunk `text`
   payload bytes reinterpreted as Latin-1. [SRC: content-detector.ts:39-44
   comment: "it matched the word anywhere in the 1.5MB binary... Check the
   exact chunk keywords"]

Both checks still operate on a raw Latin-1 reinterpretation of the whole
file rather than a real chunk parse, so they remain a heuristic fast path,
not a substitute for structural parsing: the detector explicitly falls
through to a full `parseCharacterCard()` structural parse when no keyword
substring hits, and downgrades confidence to `'medium'` for that path [SRC:
content-detector.ts:69-94]. This module (`formats/png`) should expose the
correct, structural check directly (real chunk keyword equality after
decode, not substring-with-null-guard) so that content-detection.md's
heuristic fast path is optional performance, never the only correctness
guarantee. The two historical bugs above are about the OLD heuristic, not
about this module's structural read path (which was always correct: it
decodes real chunks and compares `keyword.toLowerCase()` for exact
equality, not substring).

### Chunk preservation on write

Restated precisely for the capabilities/round-trip discussion: writing
character data to a PNG must be format-preserving for everything except the
specific character-data keyword(s) being replaced. Concretely:

- Image chunks (`IHDR`, `PLTE`, `IDAT`, `IEND`) are never modified.
- Ancillary metadata chunks unrelated to character/persona data (e.g. `tIME`,
  `pHYs`, application-specific `tEXt` entries with other keywords) pass
  through unchanged.
- Only `tEXt`/`iTXt` chunks whose decoded keyword equals the keyword(s) being
  written are removed before the new chunk is inserted (character-card write
  path only: see Edge case 5 for the persona-export path's different,
  non-stripping behavior).
- Chunk order for everything except the newly inserted chunk(s) is preserved
  relative to itself; the new chunk(s) are inserted immediately before
  `IEND`. PNG does not mandate a specific order among ancillary chunks
  [SRC: W3C PNG spec], so this is not a round-trip hazard for the Round-Trip
  Law's "semantic" byte-identity level, but it does mean this module's
  byte-identity level is `semantic`, not `byte` (see Test plan).

## Public API sketch

```ts
// packages/formats/src/png/index.ts

/** One decoded PNG tEXt chunk. */
export interface PngTextChunk {
  keyword: string; // as decoded, original case preserved
  text: string;    // raw chunk text (base64 payload, still encoded)
}

/** The four known character/persona keywords, in read precedence order. */
export const KNOWN_KEYWORDS = ['ccv3', 'chara', 'rcpersona', 'persona'] as const;
export type KnownKeyword = (typeof KNOWN_KEYWORDS)[number];

/** Validate PNG signature without a full chunk parse. */
export function isPng(buffer: Uint8Array | ArrayBuffer): boolean;

/** Decode every tEXt chunk present. Does not attempt iTXt/zTXt (see edge case 6). */
export function readTextChunks(buffer: Uint8Array | ArrayBuffer): PngTextChunk[];

/**
 * Find the highest-precedence known keyword present and return its decoded
 * (base64-decoded, UTF-8) payload string, or null if none of the four
 * keywords is present. Case-insensitive keyword match. Throws only on
 * malformed PNG structure, never on "no character data found" (returns null).
 */
export function extractEmbeddedJson(buffer: Uint8Array | ArrayBuffer): {
  keyword: KnownKeyword;
  json: string;
} | null;

/** Get the raw (base64-decoded) payload for one specific keyword, or null. */
export function extractByKeyword(
  buffer: Uint8Array | ArrayBuffer,
  keyword: string
): string | null;

export interface EmbedOptions {
  /** Keyword(s) to strip before inserting new data. Defaults to [keyword]. */
  replaceKeywords?: string[];
}

/**
 * Return a new PNG buffer with `json` embedded (base64-encoded) under
 * `keyword`, having first removed any existing tEXt/iTXt chunk whose
 * decoded keyword is in `options.replaceKeywords` (default: just the target
 * keyword). All other chunks pass through unmodified; the new chunk is
 * inserted immediately before IEND.
 */
export function embedJson(
  buffer: Uint8Array | ArrayBuffer,
  keyword: string,
  json: string,
  options?: EmbedOptions
): Uint8Array;

/**
 * Convenience for V3 export: write both `ccv3` (v3Json) and `chara`
 * (v2BackfillJson) in one pass, replacing any prior ccv3/chara chunks.
 */
export function embedDualCharacterData(
  buffer: Uint8Array | ArrayBuffer,
  v3Json: string,
  v2BackfillJson: string
): Uint8Array;

/** True if buffer is a valid PNG and contains at least one known keyword. */
export function hasEmbeddedCharacterData(buffer: Uint8Array | ArrayBuffer): boolean;
```

Callers in `formats/chara-card`, `formats/rolecall-character`,
`formats/personas`, and content-detection.md's PNG path all sit on top of
this module; none of them re-implement chunk extraction/embedding.

## Edge cases & failure modes

1. **No tEXt chunks at all.** `readTextChunks` returns `[]`;
   `extractEmbeddedJson` returns `null` rather than throwing (this differs
   from VAUDEVILLE's `readCharacterData`, which throws: Vaudeville Studios'
   module-level API should prefer `null` for "absent" and reserve thrown
   errors for structurally invalid PNGs, matching the `capabilities`/report
   philosophy in escrow-and-roundtrip.md where "not found" is a normal,
   reportable outcome, not an exception). Codecs that need the throwing
   behavior can throw themselves when they receive `null` unexpectedly.
2. **tEXt chunks exist but none match a known keyword.** `extractEmbeddedJson`
   returns `null`; `readTextChunks` still returns the unrecognized chunks so
   a caller (e.g. content-detection.md) can inspect them for its own
   heuristics.
3. **Multiple known keywords present in one file** (e.g. both `ccv3` and
   `persona`, or a stale `rcpersona` left behind by edge case 5). Precedence
   order (`ccv3 > chara > rcpersona > persona`) decides which one
   `extractEmbeddedJson` returns; `readTextChunks` still surfaces all of
   them for a caller that wants to warn about the ambiguity.
4. **Invalid base64 or invalid UTF-8 in a matched chunk's `text`.** Node/Bun's
   `Buffer.from(x, 'base64')` decode (the standardized path per this spec's
   API sketch) is lenient: it silently skips characters outside the base64
   alphabet rather than throwing. If the decoded bytes are not valid UTF-8,
   `Buffer`'s UTF-8 decode substitutes the Unicode replacement character
   rather than throwing. The subsequent `JSON.parse()` in the calling codec
   is what actually catches a truly corrupt payload, by throwing a JSON
   syntax error. This module does not validate JSON shape.
5. **Persona export overwrite does not strip prior `rcpersona` chunk.**
   `embedPersonaInPNG` (persona-export.ts) always appends a new `rcpersona`
   chunk without removing an existing one first, unlike
   `embedCharacterData`/`embedDualCharacterData` which explicitly filter out
   prior `chara`/`ccv3` chunks first. A PNG round-tripped through this path
   twice ends up with two `rcpersona` tEXt chunks. The read path
   (`readCharacterData`'s `find()`) returns the FIRST match in chunk-array
   order, so the visible payload after a second export depends on where in
   the chunk list the new one was spliced (before IEND) versus where the
   stale one sits: in practice the stale (older, earlier-positioned) chunk
   wins the `find()`, not the newly written one. Vaudeville Studios' write
   path must always strip-then-insert for every known keyword, including
   `rcpersona` and `persona`, to avoid reproducing this bug.
6. **iTXt chunks are structurally mishandled if ever decoded as tEXt.** The
   read path (`readCharacterData`) never looks at `iTXt` chunks at all,
   only `tEXt`. The write path's chunk-removal filter DOES check `chunk.name
   === 'iTXt'` as a candidate to strip, and calls the same `decodeTextChunk`
   (built for `tEXt`'s simple `keyword\0text` layout) on it. A real `iTXt`
   chunk's data layout is `keyword \0 compression-flag(1) compression-method(1)
   language-tag \0 translated-keyword \0 text`; feeding that to a
   tEXt-shaped decoder means the decoder reads `keyword` correctly (up to
   the first `\0`), then treats the compression-flag byte as the start of
   `text`: if that byte is `0x00` (uncompressed, the common case), the
   decoder immediately throws `"Invalid NULL character found... not
   permitted in tEXt content"` [verified by reading installed
   png-chunk-text@1.0.0 decode.js]. That throw is caught by the filter's
   `try/catch` and treated as "keep this chunk, it's not chara/ccv3": so in
   practice a real `iTXt` character-data chunk (which no producer in this
   ecosystem currently writes, but which is PNG-legal) would never be
   correctly stripped, matched, or read as character data by any code path
   in this spec's ground truth. Vaudeville Studios' module should either (a)
   implement genuine iTXt parsing for keyword equality checks (without
   attempting to decompress compressed iTXt text, which is out of scope) or
   (b) explicitly document iTXt as unsupported and never claim `name ===
   'iTXt'` matches are inspected. OPEN QUESTION: should Vaudeville Studios
   add real iTXt read support in M0/M1, or explicitly scope PNG embedding to
   tEXt-only and document iTXt PNGs as an unsupported (not misdetected)
   input? No VAUDEVILLE producer writes iTXt for character data, so there is
   no fixture-corpus pressure to fix this immediately, but a correctly
   scoped module should not silently mis-attempt it either.
7. **Missing `IEND` chunk.** VAUDEVILLE falls back to appending the new
   chunk at the very end of the chunk list rather than before a (nonexistent)
   IEND [SRC: writer.ts:84-87, "shouldn't happen with valid PNG"]. Since a
   PNG without `IEND` is not a valid PNG to begin with, Vaudeville Studios
   should validate PNG structure (require IEND present) before attempting
   embed, and fail the operation with a clear error rather than silently
   producing a still-invalid PNG.
8. **Non-PNG input.** `isPng`/signature check fails first; the module
   returns a typed error/`null`, never attempts chunk extraction on garbage
   bytes. VAUDEVILLE's `parseCharacterCard` returns `{valid:false, error:
   "Not a valid PNG file"}` for this case [SRC: png-parser.ts:150-153].
9. **Keyword casing.** Read-side keyword comparison is
   `toLowerCase() === "ccv3"` etc., so a producer that wrote `CCV3` or `Chara`
   is still recognized. Write-side always writes the canonical lowercase
   keyword. A PNG containing keyword variants in mixed case for more than
   one of the four known keywords is covered by edge case 3 (precedence).
10. **Empty payload / empty `text`.** A `tEXt` chunk with keyword `chara` and
    zero-length `text` decodes to an empty string, which base64-decodes to
    an empty string, which fails `JSON.parse()` in the calling codec. This
    module surfaces the empty string as-is (not `null`) since the keyword
    WAS present; "present but unparseable" is the calling codec's error to
    raise, per this module's read/write-only scope.
11. **Bare V1 flat character JSON with no `spec` field, under the `chara`
    keyword.** Legal and must round-trip: this module has no opinion on JSON
    shape, so it passes the string through unchanged; chara-card-v2.md's
    codec is responsible for recognizing the V1 flat shape as a degenerate
    input it upgrades to V2 canonical form (see png-parser.ts:250-272 for
    VAUDEVILLE's precedent of doing this inline, which Vaudeville Studios
    splits out into the calling codec instead of this module).

## Test plan

Byte-identity level: **semantic**. Chunk order among ancillary chunks is not
guaranteed byte-identical across a parse/serialize round trip (the target
keyword's chunk is always reinserted immediately before `IEND`, which may
differ from its original position), but the canonical entity, escrow, and
the full set of non-replaced chunks (by content) must be identical.

Fixtures required (`fixtures/png-embedding/**`):

- `chara-v2-only.png`: single `chara` tEXt chunk, standard V2 JSON.
  Exercises the base read/write path and keyword precedence baseline.
- `chara-v3-only.png`: single `ccv3` tEXt chunk, V3 JSON. Exercises
  precedence winning over an absent `chara`.
- `chara-v2-and-v3-dual.png`: both `ccv3` and `chara` present (V3 export
  with V2 backfill). Exercises precedence (`ccv3` wins) and
  `embedDualCharacterData` write round trip.
- `rcpersona-only.png`: single `rcpersona` chunk. Exercises precedence
  falling through past absent ccv3/chara.
- `roleout-persona-legacy.png`: single `persona` chunk, flat
  `{name,title,content}` JSON. Exercises lowest-precedence fallback and the
  RoleOut legacy shape.
- `misdetect-persona-word-in-prose.png`: a valid `chara`-keyword V2 card
  whose `first_mes` or `description` field contains the literal word
  "persona". Regression fixture for misdetection trap 2; must classify as
  `character`, never `persona`.
- `misdetect-persona-before-chara.png`: a PNG with both `chara` and
  `persona` tEXt chunks present. Regression fixture for misdetection trap 1;
  must classify as `character` (chara/ccv3 checked first), matching read
  precedence.
- `stale-rcpersona-double-export.png`: a persona PNG that has been through
  two export cycles without stripping, producing two `rcpersona` chunks.
  Regression fixture for edge case 5; documents current (buggy) VAUDEVILLE
  behavior and asserts Vaudeville Studios' writer does NOT reproduce it (this
  is a case where Vaudeville Studios intentionally improves on VAUDEVILLE;
  note the divergence explicitly in the fixture's `notes.md`).
- `no-text-chunks.png`: plain PNG, zero tEXt chunks. Exercises "absent"
  path (`extractEmbeddedJson` returns `null`, no throw).
- `unrelated-tEXt-chunks.png`: PNG with `tEXt` chunks for unrelated
  keywords (e.g. `Comment`, `Software`) plus a `chara` chunk. Exercises
  chunk-preservation-on-write (unrelated chunks survive byte-identical) and
  that `readTextChunks` surfaces the unrelated ones too.
- `missing-iend.png` (synthetic, malformed): exercises edge case 7's
  validation-and-reject behavior.
- `non-png-file.png` (actually a JPEG or arbitrary bytes with `.png`
  extension): exercises edge case 8.
- `itxt-character-data.png` (synthetic): a card whose data is embedded as a
  real, structurally correct `iTXt` chunk instead of `tEXt`. Exercises
  whichever resolution of edge case 6 / OPEN QUESTION 1 Vaudeville Studios
  chooses (either correctly read, or cleanly reported as unsupported: must
  NOT throw an unrelated internal error).

Round-Trip Law applicability: full. For every character/persona PNG fixture,
`embedJson(buffer, keyword, extractEmbeddedJson(buffer).json)` applied back
onto the ORIGINAL buffer must, when re-extracted, yield a JSON string that
parses to a deep-equal object, and every other chunk (by content, not
position) must be byte-identical to the original.

Property/unit tests beyond fixtures:

- Base64 round trip is UTF-8 safe for non-Latin1 content (emoji, CJK text,
  combining marks) in the embedded JSON.
- Keyword matching is case-insensitive on read, canonical-lowercase on
  write.
- Writing never touches `IHDR`/`IDAT`/`PLTE`/`IEND` bytes.
- Writing the same keyword twice in sequence (simulating a re-export) never
  leaves more than one chunk for that keyword.
- `extractEmbeddedJson` on a 0-byte or truncated PNG fails cleanly (no
  uncaught exception escaping as something other than the module's declared
  error type).

## Non-goals

- This module does not parse or validate the JSON payload shape (V1/V2/V3
  card, rcpersona, RoleOut): that is chara-card-v2.md, chara-card-v3.md,
  rolecall-character.md, and personas.md.
- This module does not decide WHICH content type a PNG represents for
  import routing purposes beyond exposing the raw precedence match:
  content-detection.md owns the fast-path heuristic and the full detection
  policy (including the JSON-structure fallback for PNGs with no recognized
  keyword at all).
- No support for `zTXt` (compressed text chunk) read or write. No
  VAUDEVILLE producer or consumer in the ground truth uses it for
  character/persona data. OPEN QUESTION: confirm no external tool in the
  target ecosystem (ST, Chub, Backyard, Risu) ships character data in
  `zTXt` before ruling this out permanently; if one does, it needs its own
  edge case and fixture.
- No image-content handling (resizing, re-encoding pixel data, thumbnail
  generation). This module treats the pixel chunks as an opaque pass-through
  payload.
- No support for embedding data in formats other than PNG tEXt (e.g. WEBP
  metadata): out of scope for this spec.

## Sources consulted

- `<RoleCall>\apps\rc\src\lib\library\png-parser.ts`
  (read path: signature check :51-54, `readCharacterData` :62-127 including
  keyword precedence order :74-124, `parseCharacterCard` shape dispatch
  :148-284, `decodeBase64ToUtf8` :132-142)
- `<RoleCall>\apps\rc\src\lib\formats\png\writer.ts`
  (write path: `embedCharacterData` :53-91, `embedDualCharacterData`
  :103-142, `extractCharacterData` :151-175, `getCharacterVersion`
  :188-209)
- `<RoleCall>\apps\rc\src\lib\imports\content-detector.ts`
  (`detectPngType` :32-102, misdetection-trap comment :37-44, fast-path
  substring scan :45-67)
- `<RoleCall>\apps\rc\src\lib\exports\persona-export.ts`
  (`embedPersonaInPNG` :65-94, no prior-chunk stripping: basis for edge
  case 5; base64 via Node `Buffer` :76)
- `<RoleCall>\node_modules\.pnpm\png-chunk-text@1.0.0\node_modules\png-chunk-text\decode.js`
  and `encode.js` (installed dependency source, read directly: basis for
  the Latin-1/no-embedded-null constraints and the iTXt-mishandling edge
  case)
- W3C PNG Specification, tEXt chunk section (https://www.w3.org/TR/png/#11tEXt)
 : fetched for chunk field layout, keyword length limit (1-79 bytes),
  Latin-1 encoding requirement, and ancillary-chunk case-sensitivity
  convention.
- `docs/02-ARCHITECTURE.md`: package layout and
  dependency rule (`core <- formats <- everything`), BYOK/local-first
  framing, ADR-001 (Bun/Node runtime: basis for preferring the Buffer-based
  base64 path over the browser `btoa` path in the API sketch).
- `specs/formats/canonical-model.md`, `specs/formats/escrow-and-roundtrip.md`
 : escrow envelope shape, Round-Trip Law and byte-identity levels, fixture
  corpus rules (including the explicit instruction to port the two PNG
  misdetection cases as permanent fixtures).
- `templates/SPEC-TEMPLATE.md`: section structure followed by this file.
