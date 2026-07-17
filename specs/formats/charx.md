# Spec: CharX Codec (.charx)

**Package:** `packages/formats` · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/chara-card-v3.md (forthcoming, CharacterCardV3 JSON shape this codec
wraps; the charx `card.json` payload IS a CCv3 document, so this spec does not
re-derive the field map, only what changes because the container is a zip)
**VAUDEVILLE reference:** none. Searched `<RoleCall>` for
`charx` and `risu` (case-insensitive, all `.ts`); zero implementation hits. The only
"risu" hit in the whole tree is an unrelated comment in
`packages/lorebook/src/parser.ts:505` about a field-name spelling variant
(`scanCharacterDescription` vs `matchCharacterDescription`), not charx-related. VAUD
has never implemented charx. This spec is written from the public spec and RisuAI
source/issue tracker; every VAUD-shaped claim below is marked as such.

## Purpose

`.charx` is RisuAI's zip-container serialization of a Character Card V3 (CCv3)
character. Where PNG embedding (see `specs/formats/png-embedding.md`) squeezes a
base64 CCv3 JSON blob into a single tEXt chunk with no room for real binary assets,
charx is a real archive: `card.json` at the root plus a conventional directory tree
for images, audio, video, 3D/Live2D models, fonts, and code, addressed from inside
the JSON via an `embeded://` URI scheme. This codec parses a `.charx` file into the
canonical `Character` entity (identical target shape to the PNG/JSON CCv2/CCv3
codecs) with its assets extracted to production-relative asset references, and
serializes canonical `Character` (+ referenced assets) back into a conformant
`.charx` archive. It exists so Studio users can round-trip cards exported from Risu
without losing embedded art, audio, or Risu module data, and so `vaud convert` can
turn a `.charx` into a `.png` card or a bare `card.json` and back.

## Behavior

### Container shape

A `.charx` file is a standard zip archive (per the public CCv3 spec, `SPEC_V3.md`,
"CHARX file format" section):

- **MUST** contain `card.json` at the zip root. This file's contents are a
  `CharacterCardV3` JSON object (`spec: "chara_card_v3"`, `spec_version: "3.0"`,
  `data: {...}`, see `chara-card-v3.md` for the full `data` field map, which this
  codec reuses unchanged).
- **MAY** contain additional application-specific JSON files at the zip root
  (frontends may stash non-CCv3 data there; RisuAI stashes Lua/regex/lorebook
  trigger-script data in a sibling `module.risum` file, see "Field map
  (charx-specific surface only)" and "Binary data in escrow" below).
- **SHOULD NOT** be encrypted.
- **SHOULD** only use ASCII file names and paths inside the archive (spec uses
  "SHOULD"/"SHOULD NOT" language, not "MUST", for these two, a `.charx` that
  violates them is still spec-legal and this codec MUST still attempt to parse it).

### Asset directory convention

Per spec, assets live under `assets/{type}/{kind}/` where `{kind}` is a media-type
bucket and `{type}` is the asset's semantic role (`icon`, `background`, `emotion`,
`user_icon`, `other`, or an app-specific string):

| Media | Directory |
|---|---|
| Images (png, avif, jpg, webp) | `assets/{type}/images/` |
| Audio (mp3, ogg, wav) | `assets/{type}/audio/` |
| Video (mp4, webm) | `assets/{type}/video/` |
| Live2D models | `assets/{type}/l2d/` |
| 3D models (mmd, obj) | `assets/{type}/3d/` |
| AI models (safetensors, ckpt, onnx) | `assets/{type}/ai/` |
| Fonts (otf, ttf) | `assets/{type}/fonts/` |
| Code (lua, js) | `assets/{type}/code/` |
| Anything else | `assets/{type}/other/` |

This directory convention is **advisory, not load-bearing** for parsing: the codec
MUST resolve assets by the `uri` string found in `data.assets[]` (and any
`embeded://` reference inside prompt-bearing text), not by re-deriving the path from
`type`/`ext`. Real-world exporters do not conform: RisuAI's own charx export writes
image assets to `assets/other/` instead of `assets/{type}/images/` (reported in
kwaroran/RisuAI#497; this spec does not assert the issue's current open/closed
status). The codec treats the
directory layout as an artifact of whatever the source app did, not a contract, and
is permissive on read.

### Asset URI scheme

`data.assets[]` entries (per CCv3, unchanged in charx) are:

```ts
interface CharXAsset {
  type: string;   // "icon" | "background" | "emotion" | "user_icon" | "other" | app-specific
  uri: string;    // see resolution rules below
  name: string;   // identifier, spec says MUST NOT be used for prompt engineering
  ext: string;    // lowercase file extension, no leading dot, e.g. "png"
}
```

`uri` resolution, in the order the spec defines the scheme:

1. `embeded://path/to/asset.png` (sic, spec's own spelling has one "d"; codec MUST
   accept only this exact scheme string, not `embedded://` with two d's, though the
   codec SHOULD tolerate the two-d typo on read as a defensive fallback and MUST
   normalize to the correct one-d spelling on write). Path is case-sensitive,
   `/`-separated, relative to the zip root, resolves to an entry inside the same
   `.charx` archive.
2. `ccdefault:`, a sentinel meaning "use the consuming application's own default
   asset for this slot," not a real reference. The codec preserves it as a literal
   string; it never resolves to bytes.
3. `http://` / `https://`, remote URL, left untouched (the codec does not fetch it).
4. `data:` base64 inline URL, decoded to bytes directly, no zip lookup.

### card.json is a straight CCv3 document

The `data` object inside `card.json` has no charx-specific fields. It is the same
`CharacterCardV3.data` shape documented in `chara-card-v3.md` (name, description,
personality, scenario, first_mes, mes_example, creator_notes, creator_notes_
multilingual, system_prompt, post_history_instructions, alternate_greetings, tags,
creator, character_version, extensions, character_book, assets, nickname, source,
group_only_greetings, creation_date, modification_date). This codec's field map is
therefore **delegation, not duplication**:

| Concern | Handled by |
|---|---|
| `data.*` field mapping to canonical `Character` | `chara-card-v3.md` codec (this codec calls into it after unzipping `card.json`) |
| `data.character_book` -> canonical `Lorebook` reference | `chara-card-v3.md` / `st-worldinfo.md` field maps |
| zip container, asset extraction/embedding, Risu module passthrough | this spec |

### Field map (charx-specific surface only)

| Source field | Canonical field | Native/Escrow/Dropped | Notes |
|---|---|---|---|
| `card.json` (`data.*`) | `Character.data.*` | native | delegates fully to chara-card-v3 codec; see that spec's table |
| `data.assets[].uri` (`embeded://...`) | `Character.data.presentation.assets[]`, a typed asset reference (exact field path and reference shape are PROVISIONAL: `canonical-model.md` "Open items" only commits to "binary assets stored beside the entity in productions; canonical model stores typed references," it does not fix a field path or reference shape yet; this spec assumes a `presentation.assets[]` array of typed refs and flags it OPEN QUESTION pending that resolution) | native | codec extracts the zip entry to the production's asset store and rewrites the canonical reference to point there; on serialize, writes bytes back under `assets/{type}/{kind}/` and re-emits `embeded://...` |
| `data.assets[].uri` (`ccdefault:`) | same asset slot, `ref.kind = "app-default"` | native | preserved as sentinel, never resolved to bytes |
| `data.assets[].uri` (`http(s)://` or `data:`) | same asset slot, `ref.kind = "remote"` / `"inline"` | native | left as-is; `data:` payload decoded to bytes for local caching only if the production requests it (OPEN QUESTION: whether the studio always materializes `data:` assets locally or leaves them lazy, no VAUD precedent, no spec mandate either way) |
| root-level extra JSON files (non-`card.json`) | n/a | escrow, keyed `escrow.charx.fields["<filename>"]` | raw bytes/JSON stored opaque; re-emitted byte-identical at that path on serialize to charx |
| `module.risum` (or any `.risum` file), RisuAI's binary-packed lorebook/regex/Lua-trigger-script module, stored as a sibling zip entry alongside `card.json`, never inlined into it | n/a | escrow, keyed `escrow.charx.fields["module.risum"]`, value is a base64 string of the raw bytes (JSON-safe; see "Binary data in escrow" below) | This is Risu's own extension mechanism, not part of the public CCv3/charx spec: RisuAI's exporter calls an internal `exportModule()` that RPack-encodes trigger scripts, regex scripts, and a duplicate lorebook into a `.risum` binary and drops the corresponding data from `card.json` to shrink it. The codec does NOT decode `.risum` (no documented open binary format was found; OPEN QUESTION: RPack encoding is undocumented publicly as of this writing). It is escrowed as an opaque blob and written back byte-identical on charx->charx round-trip. On charx->other-format conversion this data is `dropped` and reported, because there is no canonical home for Risu Lua trigger scripts. |
| `data.extensions.risuai.*` (any RisuAI-namespaced key inside the standard V2/V3 `extensions` object) | `Character.data.extensions.risuai.*` | escrow, under the standard `extensions` passthrough rule from `canonical-model.md` (`extensions` maps pass through untouched unless a codec claims them) | This spec could not enumerate RisuAI's actual `extensions.risuai.*` key set from available sources (public spec text and search results describe `module.risum` as the primary Risu-specific mechanism but do not document a stable `extensions.risuai` key list). OPEN QUESTION: enumerate RisuAI's concrete `extensions.risuai.*` keys (e.g. any inline lorebook/trigger fields RisuAI writes there instead of in `module.risum`) once a real sample export is available; until then this codec treats the whole `extensions` object as generic V2/V3 passthrough, no charx-specific handling beyond that. |
| zip entry order / compression method | n/a | not modeled | zip format itself has no canonical/escrow home; codec re-zips deterministically (see byte-identity below), does not attempt to preserve original zip member order or compression level |
| any zip entry not referenced by `card.json` and not a top-level JSON/`.risum` file | n/a | escrow, keyed by full in-archive path under `escrow.charx.fields["<path>"]` | orphaned assets (e.g. unused Live2D files) are still round-tripped, never silently deleted |

### Binary data in escrow

`Escrow.fields` is typed `Record<string, unknown>` in `escrow-and-roundtrip.md`,
which is JSON-shaped, not a binary container. This codec stores binary escrow
payloads (`module.risum`, orphaned zip-entry bytes) as base64-encoded strings under
their keyed path, never as raw `Uint8Array`, so the envelope stays JSON-safe and the
Round-Trip Law's deep-equal-escrow check works with plain structural equality. This
is a provisional convention for this codec pending a project-wide decision on binary
escrow in `escrow-and-roundtrip.md` (OPEN QUESTION: whether large binary escrow
payloads should instead live beside the entity in the production's asset store with
a lightweight pointer left in `escrow.fields`, matching how native assets are
handled, rather than inlined as base64 inside the JSON envelope itself; no such
convention is defined yet at the escrow-spec level).

### Precedence and detection

Detection of `.charx` vs other zip-based formats (bundle-import zips, etc.) is out
of scope for this spec, see `content-detection.md`. This codec's `detect()`
contract: given a zip archive, return a positive match only if a root-level
`card.json` entry exists and parses as JSON with `spec` starting with `"chara_card_"`
and `spec_version` present. A zip lacking `card.json` at the root is not a charx
file to this codec (it may still be a bundle zip handled elsewhere).

### Byte-identity level

`semantic`. Zip archives are not byte-for-byte reproducible across zip libraries
(compression level, local file header timestamps, central directory ordering all
vary), and this codec makes no attempt to match the byte layout of the source
archive. `serialize(parse(F))` must produce a `.charx` that re-parses to a
deep-equal canonical `Character` + deep-equal escrow, per the Round-Trip Law's base
guarantee. `card.json`'s JSON content SHOULD be canonical-json byte-identical when
no fields changed (stable key order), but the zip container around it is not held
to that bar.

## Public API sketch

```ts
// packages/formats/src/charx/index.ts

import type { Codec, ParseResult, SerializeResult, Character } from "@vaudeville/core";

export interface CharXAssetRef {
  type: string;                 // "icon" | "background" | "emotion" | "user_icon" | "other" | string
  ext: string;                  // lowercase, no leading dot
  name: string;
  kind: "embedded" | "app-default" | "remote" | "inline";
  // present only when kind === "embedded"; points into the production's asset
  // store after parse, or into the in-memory zip during serialize
  storedPath?: string;
  // present only when kind === "remote" | "inline"
  uri?: string;
}

export const charxCodec: Codec<Character> = {
  id: "charx",

  /** True only if the zip has a root card.json with a chara_card_* spec field. */
  detect(bytes: Uint8Array): boolean,

  /**
   * Unzips, delegates data.* mapping to the chara-card-v3 codec, extracts
   * embeded:// assets to the production asset store (or an in-memory staging
   * area if no production context is given), escrows module.risum and any
   * unrecognized root-level JSON/orphaned zip entries verbatim.
   */
  parse(bytes: Uint8Array, ctx: ParseContext): ParseResult<Character>,

  /**
   * Re-zips: writes card.json (delegating data.* serialization to the
   * chara-card-v3 codec), re-embeds asset bytes under assets/{type}/{kind}/,
   * rewrites embeded:// URIs to match, merges escrowed root-level files and
   * module.risum back in verbatim.
   */
  serialize(entity: Character, ctx: SerializeContext): SerializeResult,

  /** Per canonical field path -> "native" | "escrow" | "dropped". Delegates
   *  the data.* portion to chara-card-v3's capabilities and adds the charx-only
   *  rows from the field map above (assets: native; module.risum: escrow,
   *  dropped on cross-format convert). */
  capabilities: CapabilitiesMap,
};
```

## Edge cases & failure modes

1. **`card.json` missing or not at root.** `detect()` returns false; `parse()`
   throws a codec-specific `InvalidCharXError` if called directly. Not a silent
   empty-character result.
2. **`card.json` present but `spec` is `chara_card_v2`, not `v3`.** Spec allows this
   in principle (a charx wrapping a V2 card) but is unusual; codec MUST still parse
   it by delegating to the chara-card-v2 codec instead of v3, and record a warning
   (`ParseReport.warnings`) that this charx carries a V2 payload.
3. **`embeded://` path does not resolve to any zip entry.** Record a
   `ParseReport` warning per missing asset, keep the canonical asset reference with
   `storedPath` unset and a `missing: true` flag, do not fail the whole parse.
4. **Two-d typo `embedded://` encountered on read.** Accept it defensively
   (normalize internally to the correct `embeded://` scheme), but always emit the
   correct one-d spelling on write, per spec.
5. **Asset directory does not match the `{type}` in `data.assets[]`** (the RisuAI
   `assets/other/` vs `assets/{type}/images/` real-world mismatch). Not an error:
   directory layout is advisory (see above); resolution is by URI, not by
   recomputing the expected path.
6. **`ccdefault:` asset serialized to a foreign format that has no default-asset
   concept** (e.g. converting to chara_card_v2 JSON). The sentinel string is
   preserved verbatim in the `assets` extension data if the target format supports
   `extensions` passthrough, else recorded `dropped`.
7. **`module.risum` present, target format is PNG or bare CCv3 JSON (no zip
   container).** The blob cannot be embedded (no archive to hold it). Recorded
   `dropped` in `SerializeReport`, `--strict` CLI mode exits nonzero. Round-tripping
   charx -> charx still preserves it losslessly.
8. **Zip contains additional root JSON files with no recognizable shape** (not
   `card.json`, not `.risum`, arbitrary app config). Escrowed by filename, verbatim
   bytes, re-emitted unchanged on charx->charx round-trip; dropped-and-reported on
   cross-format conversion.
9. **Encrypted zip (spec says SHOULD NOT, not MUST NOT).** Codec attempts to open
   as a normal zip; if the zip library reports encryption, fail parse with a clear
   `InvalidCharXError` naming encryption as the cause, since decrypting is out of
   scope (no password source in the pipeline).
10. **Non-ASCII file names/paths inside the archive** (spec says SHOULD avoid, not
    forbidden). Codec MUST still parse correctly; not an error, no special handling
    beyond normal UTF-8 zip entry name decoding.
11. **`.charx` file that is actually a bundle-import zip misdetected as charx** (no
    `card.json`, or `card.json` present but doesn't parse as JSON). `detect()`
    returns false so the bundle-import path in `content-detection.md` takes over;
    this codec never partially parses a non-conformant zip.
12. **Very large embedded video/3D assets.** No size ceiling is imposed by this
    spec; production asset storage limits (if any) are out of scope here, see
    `productions-and-history.md`. OPEN QUESTION: whether `vaud convert` should warn
    or refuse on charx files above some size threshold; no decision made yet.

## Test plan

- Fixtures required (`fixtures/charx/`):
  - `minimal-card-json-only.charx`, card.json with no assets array, no extra
    files; exercises the pure delegation path to chara-card-v3.
  - `with-embedded-icon-and-emotions.charx`, multiple `embeded://` image assets
    under `assets/icon/images/` and `assets/emotion/images/`, exercises asset
    extraction/round-trip.
  - `risu-real-export.charx`, sanitized real RisuAI export including a
    `module.risum` sibling file and the known `assets/other/` misplacement
    (kwaroran/RisuAI#497 pattern); exercises escrow-of-unknown-binary and
    permissive directory handling.
  - `ccdefault-and-remote-assets.charx`, one asset with `uri: "ccdefault:"`, one
    with an `https://` URL, one with a `data:` inline base64 payload; exercises all
    four URI kinds.
  - `two-d-typo-embedded-scheme.charx`, malformed but common `embedded://` (two
    d's) reference; exercises the defensive-read/correct-write edge case.
  - `v2-payload-in-charx-wrapper.charx`, `card.json` with `spec: "chara_card_v2"`;
    exercises edge case 2.
  - `missing-asset-reference.charx`, `data.assets[]` entry pointing at a zip path
    that does not exist; exercises edge case 3.
  - `extra-root-json-file.charx`, an unrecognized `settings.json` at zip root
    alongside `card.json`; exercises escrow-by-filename.
  - `not-actually-charx.zip`, a bundle-import-style zip with no `card.json`,
    used as a negative `detect()` fixture, not run through the Round-Trip Law.
- **Round-Trip Law applicability:** applies to every fixture above except
  `not-actually-charx.zip`. `serialize(parse(F))` re-parsed must be deep-equal in
  canonical data + escrow to `parse(F)`. Byte-identity level: `semantic` (see
  above); `card.json`'s own bytes SHOULD be canonical-json stable when unedited but
  this is not asserted by the Law harness for the outer zip.
  - Cross-codec check: `parse(charx fixture)` then `serialize(..., "chara-card-v3-
    json")` (bare JSON, no zip) then `parse` that back must yield deep-equal `data.*`
    (asset refs necessarily degrade to whatever the JSON-only format can hold; not
    asserted equal, only `data.*` prompt-bearing fields).
- **Property/unit tests beyond fixtures:**
  - `embeded://` path resolution is case-sensitive and `/`-normalized regardless of
    host OS path separator.
  - Two-d `embedded://` typo is accepted on read, never produced on write.
  - `ccdefault:` and `http(s)://` and `data:` URIs never trigger a zip-entry lookup.
  - `module.risum` bytes are never inspected or mutated, only copied.
  - `detect()` is false for empty zips, zips with `card.json` in a subdirectory
    (not root), and zips where `card.json` isn't valid JSON.
  - Capabilities map for the charx-only rows matches the field-map table above
    exactly (snapshot test, since the docs site generates its matrix from this
    export).

## Non-goals

- This spec does not define the CCv3 `data.*` field semantics, that is
  `chara-card-v3.md`'s job; this codec is a thin container layer over it.
- Does not decode, validate, execute, or transform `.risum` module contents (Lua
  trigger scripts, RPack encoding). It is opaque escrowed binary, full stop. Any
  future "understand Risu modules" work is a separate spec, not an extension of
  this one.
- Does not fetch remote (`http(s)://`) asset URIs to inline them; they stay as
  references.
- Does not enforce or repair the `assets/{type}/{kind}/` directory convention on
  read; does not judge or "fix" nonconforming exporters (e.g. RisuAI's own
  `assets/other/` bug), it just resolves by URI as the spec requires clients to do.
- Does not define zip compression parameters, streaming/large-file handling
  strategy, or a size ceiling; those are implementation/production-storage
  concerns, not format semantics.

## Sources consulted

- `<RoleCall>`, searched exhaustively for `charx` and
  `risu` (case-insensitive) across all `.ts` files; zero implementation results for
  charx; the one `risu` hit (`packages/lorebook/src/parser.ts:505`) is an unrelated
  comment about ST field-name variants, not charx. Confirms the bible's note that
  VAUD lacks a charx implementation.
- `character-card-spec-v3` (public CCv3 spec, kwaroran/character-card-spec-v3,
  `SPEC_V3.md`), fetched 2026-07-02: CHARX file format section (zip layout,
  `card.json` root requirement, asset directory convention table, `embeded://` URI
  scheme including the one-d spelling and case/`/`-separator rules, `ccdefault:`
  sentinel, asset object shape `{type, uri, name, ext}` and their MUST/SHOULD
  constraints, encryption/ASCII-path SHOULD-NOT guidance, full `CharacterCardV3`
  field list including V3 additions (`assets`, `nickname`,
  `creator_notes_multilingual`, `source`, `group_only_greetings`, `creation_date`,
  `modification_date`), `extensions` passthrough guidance, `character_book`
  decorator list (`@@activate_only_after`, `@@depth`, `@@position`, `@@use_regex`,
  etc.), decorator detail deferred to `chara-card-v3.md`, not re-specified here.
  URL: https://github.com/kwaroran/character-card-spec-v3/blob/main/SPEC_V3.md
- kwaroran/RisuAI GitHub issue #497, "CharX export is not following CCV3
  specification," fetched 2026-07-02: confirms real-world RisuAI charx exports
  write image assets to `assets/other/` instead of the spec's
  `assets/{type}/images/`, the basis for edge case 5 and the "advisory, not
  load-bearing" directory-convention decision.
  URL: https://github.com/kwaroran/RisuAI/issues/497
- Web search summary (DeepWiki mirror of kwaroran/RisuAI source,
  "Character Cards and Formats," and search-result synthesis), fetched 2026-07-02:
  description of RisuAI's `exportModule()` producing `module.risum` (RPack-encoded
  binary containing Lua trigger scripts, regex scripts, and a duplicate lorebook,
  removed from `card.json` to shrink it) as the basis for treating `.risum` as
  opaque escrowed binary. No official byte-level spec for RPack encoding was found,
  see OPEN QUESTION in the field-map table.
  URL: https://deepwiki.com/kwaroran/RisuAI/3.1-character-cards-and-formats
- `specs/formats/canonical-model.md`, "Character" section (chara_card_v2/v3
  superset requirement, Risu charx extensions mention, asset-handling open item)
  and "Open items" (typed asset references).
- `specs/formats/escrow-and-roundtrip.md`, Round-Trip Law, escrow envelope shape,
  byte-identity levels, capabilities matrix contract, fixture corpus rules.
- `docs/06-PRODUCTION-BIBLE.md:43`, this file's brief row (charx.md), confirming
  scope and that VAUD-lacks-implementation OPEN QUESTIONs are pre-approved.
- `docs/02-ARCHITECTURE.md:11-13`, `packages/formats` codec module boundary and
  the `Codec` interface shape (detect/parse/serialize/capabilities) this spec's API
  sketch conforms to.

## OPEN QUESTION list

- OPEN QUESTION: whether the studio always materializes `data:` inline-base64
  assets to local production storage on parse, or leaves them lazy/inline. No
  VAUD precedent, no public spec mandate either way.
- OPEN QUESTION: `.risum`'s RPack binary encoding is undocumented publicly as of
  this writing; this codec treats it as opaque and does not attempt to decode it.
- OPEN QUESTION: whether `vaud convert` should warn or refuse on `.charx` files
  above some size threshold (large embedded video/3D/AI-model assets); no decision
  made.
