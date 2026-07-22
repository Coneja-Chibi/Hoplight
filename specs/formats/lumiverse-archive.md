# Spec: Lumiverse Data Archive Import (.lvbak)

**Package:** `packages/formats` · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md,
specs/formats/escrow-and-roundtrip.md, specs/formats/bundle-import.md
(container-import sibling; shares the per-entry-isolation and bounds
philosophy), specs/formats/lumiverse-preset.md, specs/formats/regex-scripts.md,
specs/formats/personas.md, specs/formats/st-worldinfo.md ·
**Lumiverse reference:** `src/services/user-data/export.service.ts`,
`src/services/user-data/manifest.ts`, `src/services/user-data/table-registry.ts`,
`src/services/user-data/import.service.ts` (upstream repo
github.com/prolix-oc/Lumiverse, read at draft time) · **Ground truth:** a real
user export produced 2026-07-21 was inspected while drafting; every row-shape
claim below was verified against it unless marked otherwise.

## Purpose

Lumiverse's Settings -> Data Portability feature exports a user's entire
library as one `.lvbak` file. Unlike every other container this suite reads,
it is not a bundle of platform-format files: it is a per-user SQLite dump. A
ZIP holds `manifest.json`, one `database/{table}.ndjson` file per table (one
raw row per line, column names as keys), and a `files/` tree of binaries that
rows reference by name. No CCv2 card, ST preset, or worldinfo JSON exists
anywhere inside; the importer must reconstruct those shapes from rows.

This spec defines a read-only archive mode that detects a `.lvbak`, walks the
tables that map to canonical kinds, synthesizes each per-kind wire shape, and
dispatches to the already-shipped Lumiverse codecs (`src/formats/lumiverse/`)
so mapping logic exists exactly once. Import fans one archive out into many
canonical entities: characters (with their expression sprites, embedded
lorebooks, and embedded regex), standalone lorebooks, presets, personas, and
regex sets. Chats and every other table are out of scope (see Non-goals).

Like bundle import, this component classifies and dispatches; it does not
duplicate any codec's field mapping. It sits beside the (unbuilt)
bundle-import seam rather than inside it, because classification here is
table-driven, not per-file content detection.

## Detection

Content-based, never extension-based (the user may have renamed or pre-
extracted the archive; the shipped file is `.lvbak`, Content-Type
`application/zip`):

1. The bytes are a ZIP central directory containing an entry named exactly
   `manifest.json` at the root, plus at least one entry under `database/`.
2. `manifest.json` parses as JSON with `producer === "lumiverse"` and
   integer `schemaVersion`.
3. `schemaVersion > 1` is rejected with a versioned error (mirrors
   Lumiverse's own importer, `import.service.ts`); `schemaVersion === 1` is
   the only accepted value today.

Anything failing these checks returns a non-match so detection can fall
through to charx/bundle handling. Fail closed: a ZIP with a `manifest.json`
whose producer is not `lumiverse` is NOT this format.

**ZIP64 is mandatory.** Lumiverse writes with `forceZip64: true`, so even a
tiny archive carries ZIP64 end-of-central-directory records and 0x0001 extra
fields. The bounded unzip in `src/core/archive.ts` must be verified against a
real `.lvbak` before this spec's work starts; if it cannot parse ZIP64, that
is a prerequisite task, not an edge case. NDJSON entries are DEFLATE (level
3); binaries under `files/` are STORED; zero-length entries are meaningful
and must not be treated as errors.

## Behavior

### 1. Open and bound

Open the ZIP through the bounded-inflate infrastructure with a new bounds
profile (`LVBAK_ARCHIVE_BOUNDS`) that adopts Lumiverse's own import caps
verbatim: 5 GiB compressed, 20 GiB decompressed, 500,000 entries (decided
2026-07-21: any archive Lumiverse itself would restore, Hoplight can read;
diverging lower would reject real backups for no safety gain). Breach aborts
the whole archive, exactly as bundle-import's ceilings do. Per-line NDJSON
ceilings are separate, see step 3.

Path safety per entry follows bundle-import Behavior step 1 verbatim (reject
`..`, absolute, backslash, NUL; skip macOS cruft).

### 2. Read the manifests

- `manifest.json` (first entry): read `schemaVersion`, `producer`,
  `ndjsonFormatVersion`, `exportedAt`, `hasEncryptedSecrets`,
  `includeVectors`. Its `counts` and `missingFiles` fields are placeholders,
  always `{}`/`[]`; never trust them.
- `manifest-stats.json` (last entry, optional): the real per-table `counts`
  and the `missingFiles` list (files referenced by rows but absent from the
  server disk at export time; the real export inspected had 1,971 of these).
  Used for the import report's expected-vs-actual numbers and to
  pre-explain missing avatars. Its absence downgrades reporting, never
  fails the import.

### 3. Stream the tables

Each `database/{table}.ndjson` is newline-delimited JSON, one row-object per
line, keys equal to Lumiverse's live SQLite column names. Two properties a
parser must honor:

- **Line ceilings:** `ndjsonFormatVersion >= 1` guarantees lines fit 4 MiB;
  when the field is absent (legacy archives) lines to 64 MiB must be
  tolerated (mirrors `MAX_NDJSON_LINE_BYTES` vs
  `LEGACY_MAX_NDJSON_LINE_BYTES` in the Lumiverse reader).
- **JSON-in-a-string columns:** SQLite TEXT columns holding JSON arrive as
  strings and need a second parse. Verified examples:
  `characters.extensions`, `presets.prompts`, `presets.prompt_order`,
  `presets.parameters`, `regex_scripts.placement`, `regex_scripts.target`,
  `regex_scripts.actions`, `personas.metadata`, `world_books.metadata`,
  `world_book_entries.key`. A failed inner parse fails that ROW, not the
  table or the archive.

Only the tables named in step 5 are read. All others (chats, messages,
memory cortex, databank chunks, weaver, settings, connections, theme assets,
extensions, lancedb vectors, encrypted secrets) are skipped by name and
counted in the report as skipped tables with their row counts from
manifest-stats. Encrypted secrets are additionally called out: the AES key
lives only in the user's separate `.ticket.json` and this importer never
asks for it.

### 4. Resolve binaries

Rows reference binaries; nothing is embedded:

- `characters.avatar_path` / `personas.avatar_path` -> `files/avatars/{path}`
- `images` rows -> `files/images/{filename}`, thumbnails at
  `files/thumbnails/{id}_thumb_sm_v2.webp` / `_thumb_lg_v2.webp`
- `characters.image_id` / `avatar_crop_image_id` join the `images` table

A referenced binary that is absent (very common; see `missingFiles`) means
the entity imports WITHOUT that asset plus a per-entity warning. Missing
binaries never fail a row. The real export inspected had no `files/avatars/`
directory at all while still containing 907 importable characters.

### 5. Per-kind mapping (synthesize, then dispatch)

The rule for every kind: build the wire shape the existing codec already
parses, then call that codec. Row columns that do not fit the wire shape ride
into escrow (a `lumiverse-archive` bucket beside the codec's own escrow
twin), so provenance survives the Round-Trip Law's escrow requirement even
though this format is import-only.

| Canonical kind | Tables | Dispatch target and notes |
| --- | --- | --- |
| character | `characters` (+ `images`, `character_gallery`) | Columns are CCv2 fields flattened (`name`, `description`, `first_mes`, `mes_example`, `personality`, `scenario`, `system_prompt`, `post_history_instructions`, `alternate_greetings`, `creator`, `creator_notes`, `tags`) plus an `extensions` JSON string. Synthesize a `chara_card_v2` JSON and hand it to the existing Lumiverse character adapter. Verified: `extensions` can carry `lumiverse_modules` (the exact sidecar shape `modules.ts` parses: expressions, expression_groups, alternate_fields, embedded regex), `character_book`, `regex_scripts`, `alternate_fields`, plus foreign-platform escrow (`chub`, `risuai`, `rolecall`, `agnai`, ...). Expression sprites therefore arrive through the existing modules path; no new sprite code. Avatar resolved per step 4. |
| lorebook | `world_books` + `world_book_entries` | Entries join parent via `world_book_id`. Entry columns are ST worldinfo fields (`key`, `keysecondary`, `selective`, `selective_logic`, `constant`, `position`, `depth`, `order_value`, `probability`, `scan_depth`, `sticky`, `cooldown`, `delay`, `use_regex`, ...). Synthesize an ST worldinfo JSON per book and dispatch to the ST worldinfo codec. Vector-index columns (`vectorized`, `vector_index_status`, ...) go to escrow. |
| preset | `presets` | Row holds `prompts` (object), `prompt_order` (array of full prompt objects with `position` values like `pre_history`, `depth`, `role`, `injectionTrigger`), `parameters` (`{customBody, samplerOverrides}`), `provider`, `engine`, `metadata`. This is the lumiverse-preset wrapper's inner block model, NOT the wrapper itself. Synthesize the `{type: "lumiverse_preset", preset: {...}}` wrapper and dispatch to the existing preset codec. BUILD-TIME TASK (verified 2026-07-21, upstream `frontend/src/hooks/useLoomBuilder.ts:670`): the file wrapper the codec parses is built by Lumiverse's frontend FROM this row via a blocks transformation (`sanitizeLumiHubSealedBlocksForExport`), so row -> wrapper synthesis is not an identity copy; replicate that transformation, audit it field-by-field with fixtures during the preset slice, and extend the codec (not this importer) where shapes differ. |
| persona | `personas` | Row matches the persona codec's account-object shape (pronoun triplet `subjective_pronoun` / `objective_pronoun` / `possessive_pronoun`, `is_narrator`, `is_default`, `title`, `description`). Dispatch to the existing persona codec. `attached_world_book_id` is a cross-reference, step 6. Avatar per step 4. |
| regex | `regex_scripts` | Row is close to the standalone `lumiverse_regex_scripts` wire shape the regex codec already reads (both wire shapes are in `regex.ts`). Scoping columns (`scope`, `scope_id`, `character_id`, `preset_id`, `pack_id`, `folder`) are cross-references and escrow. Verified inner-JSON strings: `placement`, `target`, `actions`. |

Explicitly not mapped even though tables exist: `packs` + `lumia_items` +
`loom_items` + `loom_tools` (Lumia/Council companion packs; no canonical
mapping decided, and the studio's sprite-pack entity is about expression
sprites, which travel inside characters). Recorded in the report as skipped
tables, revisit post-M1 if wanted.

### 6. Cross-references and import order

Lumiverse preserves primary keys verbatim and links rows by those IDs
(`world_book_id`, `character_id`, `preset_id`, `attached_world_book_id`).
Hoplight assigns fresh IDs on import, so the importer keeps an in-memory map
`lumiverseId -> importedEntityId` and resolves links after both sides exist.

Import order (parents before dependents):

1. Lorebooks (referenced by personas and regex scoping)
2. Personas (may reference a lorebook)
3. Characters (self-contained; embedded books/regex ride inside the card)
4. Presets
5. Regex sets (may reference characters and presets)

A link whose target row was skipped or failed resolves to nothing plus a
warning naming both sides; it never fails the referencing row.

### 7. Failure isolation and the report

Per-ROW try/catch, identical philosophy to bundle-import Behavior step 7: a
row that fails (inner-JSON parse error, codec rejection) is recorded as
`failed: [{table, rowId, name?, reason}]` and the stream continues. Only
container-level bounds violations (step 1) abort the whole archive.

The report gives the user honest totals per kind: imported / failed /
skipped-table row counts (from manifest-stats when present), missing-binary
warnings, unresolved cross-references, and the explicit list of skipped
tables so nobody believes chats came along.

## Public API sketch

```ts
// packages/formats/src/lumiverse-archive.ts

export interface LvbakDetection {
  isLumiverseArchive: boolean;
  schemaVersion?: number;
  ndjsonFormatVersion?: number;
  hasEncryptedSecrets?: boolean;
  counts?: Record<string, number>; // from manifest-stats.json when present
}

/** Cheap detection: central directory + manifest.json probe only. */
export function detectLumiverseArchive(zipBytes: Uint8Array): LvbakDetection;

export interface LvbakImportReport {
  imported: Record<"character" | "lorebook" | "preset" | "persona" | "regex",
    Array<{ id: string; name: string }>>;
  failed: Array<{ table: string; rowId: string; name?: string; reason: string }>;
  skippedTables: Array<{ table: string; rows: number | null }>;
  missingBinaries: string[];
  unresolvedLinks: Array<{ from: string; to: string; reason: string }>;
  warnings: string[];
}

/**
 * Parse-only, mirroring bundle-import's layering resolution (a): returns
 * canonical entities plus the report; the caller commits them. Never
 * writes, never executes any imported script (regex/Lua stay sealed data).
 */
export function importLumiverseArchive(
  zipBytes: Uint8Array
): Promise<{ entities: CanonicalEntity[]; report: LvbakImportReport }>;
```

The same LAYERING OPEN QUESTION as bundle-import applies and should settle
the same way for both seams at once.

## Edge cases & failure modes

1. **Pre-extracted archive (a folder, not a ZIP).** Users unzip `.lvbak`
   files; the inspected real export arrived as a directory. DECIDED
   2026-07-21: both inputs are supported. The library API takes bytes only;
   the studio/CLI surface additionally accepts a directory and feeds the
   same table reader through a directory-walking entry source. Detection,
   bounds, and per-row behavior are identical for both inputs; only the
   entry enumeration differs. Exact UI/CLI affordances still belong to
   those surfaces' specs.
2. **`manifest-stats.json` absent or truncated.** Counts and missingFiles
   degrade to unknown (`rows: null` in skippedTables); import proceeds.
3. **Unknown columns / missing columns in a known table.** Mirror
   Lumiverse's own importer: unknown columns ride to escrow (we keep, they
   drop), missing columns become the codec's defaults. No version sniffing
   beyond `schemaVersion`; column presence IS the compatibility contract.
4. **A row's inner JSON string is malformed.** That row fails, isolated per
   Behavior step 7. Verified risk: these strings are double-encoded and
   truncation happens at the SQLite layer, not ours.
5. **`hasEncryptedSecrets: true`.** `secrets/` entries are ignored and one
   warning states that API keys were not (and can never be) imported here.
   Never prompt for the ticket; Hoplight has no business holding it.
6. **`includeVectors: true`.** `lancedb/` entries are skipped silently
   except for a skipped-tables report line. Vector rows are base64 raw
   Float32 bytes; nothing in Hoplight consumes them.
7. **Character whose `extensions` fails to parse but whose flat columns are
   fine.** Import the card from flat columns, park the raw extensions
   string in escrow, warn. Losing sprites is better than losing the card.
8. **Duplicate import (same archive twice).** Out of scope for the parse
   layer (it returns entities; committing is the caller's). The studio
   commit flow should surface duplicates by name the same way single-file
   import already does. OPEN QUESTION: whether to thread Lumiverse's
   original row IDs through for smarter dedupe.
9. **Huge lorebooks.** The real export had one book's entries spread over
   22,770 total entry rows; the join buffer must stream per-book, not load
   the whole entries table.
10. **Zero-row tables and zero-length entries.** Valid, produce empty
    results, no warnings.

## Test plan

- Fixtures under `src/formats/_fixtures/lumiverse-archive/` (synthesized,
  never copied from a real user export; the real export consulted stays
  outside the repo):
  - `minimal.lvbak` - manifest + one row each of the five mapped kinds +
    matching `files/` binaries + manifest-stats. Happy path, ZIP64.
  - `legacy-no-format-version.lvbak` - manifest lacking
    `ndjsonFormatVersion`; one long (>4 MiB) NDJSON line that must pass
    under the legacy ceiling.
  - `missing-binaries.lvbak` - avatar_path references with no files/
    entries; entities import, warnings emitted, manifest-stats
    missingFiles honored.
  - `cross-links.lvbak` - persona -> world_book, regex -> character and
    -> preset links that must resolve through the ID map; plus one
    dangling link.
  - `bad-rows.lvbak` - one malformed inner-JSON row per table among valid
    rows; pins per-row isolation and exact failed[] shapes.
  - `wrong-producer.zip` - valid layout, `producer: "someone-else"`; must
    not detect.
  - `future-schema.lvbak` - `schemaVersion: 2`; must reject with the
    versioned error.
  - `secrets-and-vectors.lvbak` - `hasEncryptedSecrets: true` +
    `lancedb/` entries; pins skip-and-warn behavior.
- Round-Trip Law: import-only format (like lumiverse-preset), so the Law
  applies at the escrow tier only: every imported entity carries its raw
  row (and the raw extensions/inner-JSON strings) in escrow, proven by
  fixture assertions. No serializer exists or is planned.
- Detection tests join `src/core/detection.test.ts`: `.lvbak` bytes vs
  charx vs plain ZIP vs ST backup must all land on the right handler.
- A ZIP64 regression test against `src/core/archive.ts` using
  `minimal.lvbak` (which, per the format, is ZIP64 even when tiny).

## Non-goals

- No `.lvbak` export/serializer. Lumiverse restores its own archives;
  Hoplight producing them is a different feature with real compatibility
  risk (Lumiverse's importer drops unknown columns silently).
- Chats, messages, memory cortex, databank, weaver, settings, connection
  profiles, theme assets, notification sounds, extensions: never imported.
  Chats especially: Hoplight is not a chat frontend, and no canonical chat
  entity exists.
- Lumia/Council packs (`packs`, `lumia_items`, `loom_*`): skipped with
  reporting, revisit only if a canonical mapping is designed.
- Secrets decryption, ticket handling, vector import: never.
- This spec does not define the studio UI flow (drop target, progress,
  commit/dedupe screens) or CLI flags; those belong to the UI/CLI specs.

## Sources consulted

- Lumiverse upstream (github.com/prolix-oc/Lumiverse, shallow clone read
  2026-07-21): `src/services/user-data/export.service.ts` (ZIP writer,
  forceZip64, per-entry compression, entry ordering),
  `src/services/user-data/manifest.ts` (ArchiveManifest schema),
  `src/services/user-data/table-registry.ts` (which tables export, scrub
  rules), `src/services/user-data/import.service.ts` (INSERT OR IGNORE,
  column filtering, line ceilings, size caps),
  `src/services/user-data/secret-ticket.service.ts` (AES-256-GCM ticket
  protocol), `src/routes/user-data.routes.ts` (endpoints, filename shape).
- A real export produced 2026-07-21 (907 characters, 384 world books,
  22,770 entries, 17 presets, 13 personas, 129 regex scripts, 10 packs,
  820 chats, 4,653 image files, 1,971 missingFiles): verified manifest
  shape, table list, all column lists quoted above, JSON-in-string
  columns, `lumiverse_modules` inside `characters.extensions`, preset
  block model, absent `files/avatars/`. This export is NOT in the repo and
  its data must never become fixtures.
- This repo: `src/formats/lumiverse/` (all four codecs and tests),
  `src/core/archive.ts` (bounded unzip), specs/formats/bundle-import.md
  (bounds philosophy, isolation, layering question),
  specs/formats/lumiverse-preset.md (wrapper schema the preset dispatch
  targets).
