# Spec: Bundle Import/Export (mixed-content ZIP)

**Package:** `packages/formats` · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/content-detection.md (sibling brief, not yet written — this spec
references its exported detection functions by name; exact module boundaries
settle when that spec lands) · **VAUDEVILLE reference:**
apps/rc/src/lib/imports/bulk-import-orchestrator.ts,
apps/rc/src/lib/imports/content-detector.ts,
apps/rc/src/lib/imports/__tests__/bulk-import-roundtrip.test.ts

## Purpose

A bundle is a single ZIP archive holding any mixture of characters, personas,
presets, lorebooks, and chats, either as a flat list of files or nested in
folders. Bundle import classifies every entry in the archive by content type,
then imports in dependency order so cross-references (a chat naming a
character, a preset's regex scripts) resolve. Bundle export is the inverse:
`vaud export --all-formats` (or the studio's "export everything" action)
produces one ZIP containing every entity in a production, each serialized to
its native format, plus a manifest. This is the format the CLI/app use for
whole-library backup and transfer, and the format SillyTavern-style "full
backup" ZIPs are read through (in degraded, best-effort mode — see Edge
case 8).

This component sits in `packages/formats` because it re-uses each codec's
`detect`/`parse`/`serialize` functions; it does not itself parse any format,
it classifies and dispatches.

## Behavior

### Import: classify-then-import pipeline

1. **Extract.** Open the ZIP. Reject unsafe paths per entry: any path
   segment equal to `.` or `..` or empty, any path containing `\`, `\0`, or
   starting with `/` is a path-traversal attempt — skip the entry and record
   a failure, do not abort the whole bundle (VAUD:
   bulk-import-orchestrator.ts:323-332). Skip macOS cruft: filenames
   starting with `._`, exactly `.DS_Store`, or any path containing
   `__MACOSX` (VAUD: bulk-import-orchestrator.ts:338).

2. **Zip-bomb guard.** Enforce two ceilings while decompressing. The two
   ceilings are NOT enforced symmetrically — match the reference exactly:
   - Per-entry ceiling: 256 MiB decompressed. Checked BEFORE decompression
     ONLY, and ONLY when the ZIP's local/central directory header exposes
     the entry's uncompressed size (`assertEntryFitsInBudget`). When that
     size is unavailable, the per-entry ceiling is NOT enforced at all —
     there is no post-decompression per-entry recheck in the reference
     (VAUD: bulk-import-orchestrator.ts:70-107, esp. the early `return` at
     :94-96 when the size is absent). Consequence to preserve or fix
     deliberately: a single ~300 MiB entry whose declared size is unknown,
     in an otherwise-empty archive, passes (300 < 750 cumulative) even
     though it exceeds the 256 MiB per-entry ceiling. If the port wants a
     hard per-entry guarantee it must add a streaming/post-decompression
     per-entry check that the reference lacks.
   - Cumulative ceiling across the whole archive: 750 MiB decompressed
     total. Checked BEFORE each entry (inside `assertEntryFitsInBudget`,
     when the size is known) AND AFTER decompressing each entry, by summing
     actual decompressed bytes (VAUD: bulk-import-orchestrator.ts:104-106
     pre-check, 354-356/368-369/387-388/407-408 post-checks). This is the
     backstop that catches unknown-size entries in aggregate.
   - Comparison is strict `>` at both ceilings: exactly 256 MiB / 750 MiB
     passes, one byte over aborts (VAUD: :98, :104). Exceeding either
     ceiling aborts the ENTIRE bundle import with an error — this is the one
     case where a single bad entry fails the whole bundle, not just that
     entry.

3. **SillyTavern-backup detection.** Before classifying individual entries,
   check whether the archive has ST's whole-app-backup shape: a top-level
   `settings.json` AND at least one of the top-level roots `characters/`,
   `chats/`, `worlds/` present (VAUD: bulk-import-orchestrator.ts:151-159,
   case-insensitive path comparison). If so, the bundle is treated as an ST
   backup, not a Vaudeville bundle, and a narrower allow-list applies (see
   "SillyTavern backup mode" below) instead of classifying every file.

4. **Per-file classification (non-ST-backup path).** For every remaining
   entry, dispatch by extension:
   - `.png` -> `detectPngType(buffer)`. Checks the raw tEXt/zTXt/iTXt chunk
     keyword bytes (`ccv3\0`, `chara\0`, `persona\0`, in that priority
     order) via a latin1 scan of the whole buffer, matching the literal
     null-terminated keyword, not a loose substring — this is the fix for
     the "persona" word appearing inside character prose (VAUD:
     content-detector.ts:32-101, see specs/formats/content-detection.md for
     the full misdetection history). Falls back to a structural PNG parse
     (title+content shape => persona; else character) if no keyword chunk
     matches. Confidence is `high` for keyword match, `medium` for
     structural fallback, `low`/`unknown` otherwise.
   - `.json` -> `JSON.parse`, then `detectJsonTypeEnhanced(data)`, which
     delegates to the shared `detectJsonType` structural heuristic
     (persona spec/details shape, V1/V2/V3 character shape, preset
     prompts+sampler shape, lorebook entries shape, in that priority
     order). A parse failure or non-object JSON produces `unknown` with
     `low` confidence and does NOT abort the bundle — only that entry is
     recorded as failed (VAUD: content-detector.ts:107-155,
     bulk-import-orchestrator.ts:390, :423-434).
   - `.jsonl` -> `detectJsonLType(text)`. Splits into non-blank lines; if
     the first line parses as an object with `user_name` or
     `character_name` but neither `mes` nor `content`, it is an ST "hybrid"
     chat header and the SECOND line is checked for message shape instead
     of the first (VAUD: content-detector.ts:171-208). Message shape is:
     has one of `mes`/`message`/`content` AND one of
     `name`/`role`/`is_user`. A hybrid header with no following message
     lines still classifies as `chat` at `medium` confidence (degenerate
     empty chat, must not be dropped). Anything else is `unknown`.
   - Any other extension (images that aren't `.png`, `.md`, `.txt`, etc.)
     is not classified at all and is silently skipped (not even recorded
     as `unknown`) — VAUD only branches on `.png`/`.json`/`.jsonl`
     (bulk-import-orchestrator.ts:364-422).

5. **Grouping.** Classified entries are bucketed by `ContentType`:
   `character | persona | preset | lorebook | chat | unknown`. Entries with
   type `unknown` are not imported; each produces a warning naming the
   file (VAUD: bulk-import-orchestrator.ts:585-591).

6. **Import order (dependency order).** Phases run strictly in this
   sequence, each phase fully sequential file-by-file within itself in the
   reference implementation (parallelizable in principle since files within
   a phase have no cross-references, but the port should preserve
   deterministic ordering for reproducible reports):
   1. Personas
   2. Characters
   3. Presets
   4. Lorebooks
   5. Chats (last, because a chat references a character by name and,
      optionally, persona/preset context)
   (VAUD: bulk-import-orchestrator.ts:552-559, 593-685). Note characters
   and personas do NOT depend on each other in the reference implementation
   despite both being "phase 1/2" — the ordering is a fixed sequence, not a
   dependency-graph solve; document this as a known simplification (Edge
   case 6).

7. **Per-entry import failure isolation.** Each classified entry is
   imported in a try/catch; a failure (parser throws, importer rejects)
   is caught, appended to `failed: [{file, reason}]`, and the loop
   continues to the next entry of that type (VAUD:
   bulk-import-orchestrator.ts:594-651). The zip-bomb ceilings from step 2
   are the only failures that abort the whole bundle.

8. **Chats are special-cased.** A classified chat is parsed
   (`parseJSONLChat`) but NOT committed as an importable entity by the
   bulk pipeline itself — it is staged with `needsCharacterMapping: true`
   and a warning telling the user to import it separately once character
   matching is resolved (VAUD: bulk-import-orchestrator.ts:653-685). A
   chat with zero parsed messages produces only a warning, no staged
   entry, no failure record.

9. **Result shape.** `success` is `true` iff `failed.length === 0`
   (VAUD: bulk-import-orchestrator.ts:687) — a bundle with zero failures
   but plenty of warnings (unknown files, chats needing mapping) still
   reports `success: true`. Callers must read `warnings` separately;
   `success` alone does not mean "everything happened."

### SillyTavern backup mode

Triggered per step 3. When active:

- Only these paths are accepted, everything else is counted in
  `skippedUnsupportedCount` / `skippedUnsupportedRoots` and skipped
  (VAUD: bulk-import-orchestrator.ts:161-187):
  - top-level `settings.json` (exactly one path segment)
  - `characters/<name>.png`
  - `worlds/<name>.json`
  - `personas/<name>.json`
  - `<preset-root>/<name>.json` where `<preset-root>` is one of
    `koboldai settings`, `novelai settings`, `openai settings`,
    `textgen settings` (case-insensitive)
- `characters/` subfolders and any file nested more than one level under
  `characters/` (e.g. expression images) are skipped as "character
  subfolders/expression images".
- `chats/*.jsonl` are counted separately as `skippedChatCount` — full ST
  backup chat migration needs the character-matching flow and is out of
  scope for bundle import in M1 (VAUD: bulk-import-orchestrator.ts:200-203,
  294-297).
- `settings.json` itself is not classified as a generic JSON file. It is
  read once and mined for embedded personas: `power_user.personas` (a map
  of avatar filename -> display name) and
  `power_user.persona_descriptions` (avatar filename -> `{description}`)
  are combined into synthetic `rolecall_persona`-shaped JSON classification
  entries, one per persona, named after a filesystem-safe slug of the
  persona name with numeric disambiguation on collision (VAUD:
  bulk-import-orchestrator.ts:219-277, `safeImportFilename`,
  `synthesizePersonaClassificationsFromSettings`). These synthesized
  entries then flow through the normal persona import phase like any other
  classified file. `synthesizedPersonaCount` in the report counts them.
- `buildZipClassificationWarnings(report)` renders the user-facing warning
  strings from the machine-readable report fields (VAUD:
  bulk-import-orchestrator.ts:279-301): one fixed line announcing ST-backup
  mode and its narrowed scope, one line naming skipped roots (sorted,
  deduped) if any, one line about skipped chat files if any.

### Export: `--all-formats` bundle layout

VAUDEVILLE has no bundle EXPORT implementation to port (only import exists
today — `bulk-import-orchestrator.ts` has no serialize/zip-write
counterpart, and no `export --all-formats` command was found in the
codebase). The export side is new design for this spec, constrained to be
the losslessly-invertible counterpart of import above:

- One ZIP, flat-per-type folders: `characters/`, `personas/`, `presets/`,
  `lorebooks/`, `chats/` at the archive root, mirroring the import grouping
  so a bundle exported by `vaud export --all-formats` and immediately
  re-imported by `vaud import` round-trips through the classify step
  trivially (folder name is a strong classification hint but the importer
  must still classify by content, not by folder, so files moved out of
  their folder still import correctly).
- Each entity serializes to ITS OWN native/default format: characters as
  PNG-embedded card (chara_card_v3 tEXt chunk) unless the entity has no
  art asset, in which case a bare `.json` V3 card; presets, lorebooks,
  personas, regex scripts as their native RC/ST-compatible JSON shape per
  their own codec specs.
- `manifest.json` at the archive root: format version, export timestamp,
  producing tool + version, and a flat list of
  `{ path, contentType, entityId, name }` for every entity in the bundle.
  This manifest is NOT required for import (import re-classifies from
  content, per the classify-then-import pipeline above) but lets tooling
  and the studio UI preview bundle contents without decompressing every
  entry, and lets `vaud inspect bundle.zip` report counts without a full
  import pass.
- OPEN QUESTION: exact manifest.json schema (field names, versioning
  scheme) is unspecified pending the CLI's `vaud export`/`vaud import`
  report shapes being designed in specs/features/cli-converter.md; this
  spec fixes only the invariant that a manifest exists and is
  import-optional.
- OPEN QUESTION: whether chat export is in scope for M1's bundle export at
  all, given chats are not first-class canonical entities yet in
  specs/formats/canonical-model.md (only Character, Lorebook, Preset,
  Persona, RegexScript, Production are listed as v1 content types). Until
  a chat/scene canonical model exists, bundle export should omit
  `chats/` entirely; bundle import's chat handling above stays scoped to
  reading pre-existing ST/RC bundles, not producing them.

## Public API sketch

```ts
// packages/formats/src/bundle.ts

export type ContentType =
  | "character"
  | "persona"
  | "preset"
  | "lorebook"
  | "chat"
  | "unknown";

export interface FileClassification {
  name: string;            // filename only, e.g. "dragon.png"
  originalPath: string;    // full path inside the archive
  type: ContentType;
  confidence: "high" | "medium" | "low";
  bytes: Uint8Array;        // raw entry content (VAUD uses a DOM `File`;
                            // replaced with `Uint8Array` for CLI/Node use)
}

export interface ZipClassificationReport {
  isSillyTavernBackup: boolean;
  skippedUnsupportedCount: number;
  skippedUnsupportedRoots: string[];
  skippedChatCount: number;
  synthesizedPersonaCount: number;
  failedFiles: Array<{ file: string; reason: string }>;
}

export interface ZipClassificationResult {
  classifications: FileClassification[];
  report: ZipClassificationReport;
}

/** Classify every entry of a ZIP buffer without importing anything. */
export function classifyBundle(
  zipBytes: Uint8Array
): Promise<ZipClassificationResult>;

/** Render user-facing warning strings from a classification report. */
export function describeBundleWarnings(
  report: ZipClassificationReport
): string[];

export interface BundleImportResult {
  success: boolean; // true iff failed.length === 0; check warnings separately
  imported: {
    characters: Array<{ id: string; name: string }>;
    personas: Array<{ id: string; name: string }>;
    presets: Array<{ id: string; name: string; regexScriptCount?: number }>;
    lorebooks: Array<{ id: string; name: string }>;
    chats: Array<{
      // chats are staged, not committed, by bundle import (see Behavior:
      // Import step 8)
      name: string;
      characterName?: string;
      messageCount?: number;
      needsCharacterMapping: true;
    }>;
  };
  failed: Array<{ file: string; reason: string }>;
  warnings: string[];
}

/**
 * Import a bundle into a production. Order is fixed: personas, characters,
 * presets, lorebooks, then chats (staged only). Per-entry failures are
 * isolated; only the zip-bomb ceilings abort the whole call.
 */
export function importBundle(
  zipBytes: Uint8Array,
  target: ProductionHandle // production being written into; see LAYERING
                           // OPEN QUESTION below on where this type lives
): Promise<BundleImportResult>;

export interface BundleManifestEntry {
  path: string;
  contentType: Exclude<ContentType, "chat" | "unknown">;
  entityId: string;
  name: string;
}

export interface BundleManifest {
  formatVersion: string; // OPEN QUESTION: exact scheme
  exportedAt: string;    // ISO
  producedBy: string;    // e.g. "vaud 0.1.0"
  entries: BundleManifestEntry[];
}

/**
 * Export every entity in a production as one bundle ZIP. Chats are omitted
 * (see Behavior: Export, OPEN QUESTION on chat scope).
 */
export function exportBundle(
  source: ProductionHandle
): Promise<{ zipBytes: Uint8Array; manifest: BundleManifest }>;
```

LAYERING OPEN QUESTION (`ProductionHandle` placement / write side effects):
`classifyBundle` and `describeBundleWarnings` are pure and belong cleanly in
`packages/formats` (they classify and dispatch to codecs, nothing else).
`importBundle`/`exportBundle` are different: they read from and WRITE INTO a
production (assigning entity IDs, persisting files), which is a side-effecting
workspace operation, not a codec operation. Per docs/02-ARCHITECTURE.md,
`packages/core` has ZERO deps and holds pure schemas, so a WRITE-CAPABLE
`ProductionHandle` (filesystem side effects) cannot be a `core` type — only a
`Production` *manifest* schema can. Two admissible resolutions, undecided here
because the production/CLI boundary is owned by
specs/features/cli-converter.md (not yet read/written):
(a) `importBundle` stays in `packages/formats` but is PARSE-ONLY: it returns
canonical `Entity<T>[]` (each with its parse-assigned ULID) plus the report,
and the caller (CLI / a productions-aware layer) performs the actual commit;
or (b) `importBundle` moves out of `packages/formats` into the productions/CLI
layer, and `packages/formats` exports only `classifyBundle` + the per-codec
parse functions it dispatches to. The dependency rule `core <- formats <-
everything` forbids `formats` from depending on an apps-level production
writer, which pushes toward (a). This spec does NOT decide; it flags that the
current sketch's write-into-`ProductionHandle` shape is not yet reconciled
with the dependency rule.

## Edge cases & failure modes

1. **Path traversal entry** (`../../etc/passwd`, absolute path, backslash,
   NUL byte in path): entry is skipped, recorded in `failedFiles` with
   reason `"Unsupported file path"`, bundle continues (VAUD:
   bulk-import-orchestrator.ts:323-332).
2. **Single entry exceeds 256 MiB decompressed (declared size known), or
   cumulative exceeds 750 MiB**: the ENTIRE import throws and aborts, no
   partial result is returned (VAUD: bulk-import-orchestrator.ts:98-106).
   This is the one place bundle import is all-or-nothing. Caveat carried
   from Behavior step 2: an entry that individually exceeds 256 MiB but
   whose declared uncompressed size is absent from the header is NOT caught
   by the per-entry ceiling in the reference; only the 750 MiB cumulative
   post-check can stop it. See the OPEN QUESTION on whether the port
   hardens this.
3. **Malformed JSON entry** (`{not valid json`): caught per-entry, recorded
   in `failedFiles`, other entries still classify and import (VAUD test:
   bulk-import-roundtrip.test.ts:133-149, orchestrator.ts:423-434).
4. **PNG with no recognized chunk keyword and a non-persona-shaped
   payload**: falls through the keyword checks and the structural
   title/content check, classifies `unknown` at `low` confidence
   (content-detector.ts:90-94); not imported, produces a warning.
5. **File extension not `.png`/`.json`/`.jsonl`** (e.g. a stray `.txt`
   readme, a cover image): not classified at all, silently absent from
   both `classifications` and any report field. Decide for the port
   whether this silence should become an explicit "skipped: unsupported
   extension" report entry — VAUD is silent here; OPEN QUESTION whether to
   change this behavior or preserve it as-is for compatibility.
6. **Character and persona in the same bundle referencing each other by
   name, no explicit ID link**: the fixed phase order (personas before
   characters) is NOT a real dependency solve — it is an arbitrary
   sequence carried over from the reference implementation. If a future
   canonical relationship needs personas resolved from characters (or vice
   versa) the phase order must become an actual dependency graph. Flag as
   a known limitation, not a spec requirement to fix in M1.
7. **A chat's `character_name` matches no imported character in this
   bundle or in the target production**: bundle import does not resolve
   this — chats are staged with `needsCharacterMapping: true` regardless,
   and matching is deferred entirely to a separate, not-yet-specified
   chat-import flow (out of scope; VAUD: bulk-import-orchestrator.ts:666-677).
8. **Bundle is a SillyTavern full-app backup, not a Vaudeville bundle**:
   detected structurally (top-level `settings.json` + a marker root), then
   handled in the deliberately narrow SillyTavern-backup mode described
   under Behavior, which drops most content (chats, UI settings,
   extension data) with explicit warnings rather than attempting a lossy
   full-app import.
9. **Bundle has BOTH the ST-backup shape markers AND legitimate top-level
   Vaudeville-style files** (e.g. a `characters/foo.png` root next to an
   unrelated `my-lorebook.json` at the true top level): once
   `isSillyTavernBackup` is true, the ST allow-list in step 3/4 applies to
   every entry, so `my-lorebook.json` at the true root is skipped (it is
   not `settings.json`, not under an allowed two-segment path). This is a
   real information-loss trap for a hand-assembled ZIP that happens to
   collide with the marker shape. OPEN QUESTION: should the port relax
   ST-backup detection to require a higher-confidence signal (e.g. also
   check for `settings.json` containing `power_user` or similar ST-specific
   keys) before committing to the narrow mode.
10. **Empty ZIP, or ZIP with zero classifiable entries**: `classifications`
    is `[]`, no failures, `success: true`, `warnings` empty (or the
    ST-backup announcement line alone if that mode triggered on an
    otherwise-empty archive). Not explicitly tested in VAUD; behavior is
    inferred from the code path, not observed — treat as expected-but-
    unverified until a fixture proves it.
11. **Duplicate filenames across different folders in a nested ZIP**
    (`characters/a.png` and `extra/a.png`): both are classified
    independently by `originalPath`; `name` collisions are not
    deduplicated or merged, both import as separate entities if both
    classify successfully. Only the synthesized-persona path
    (`safeImportFilename`) does collision-safe renaming, and only within
    that single settings.json synthesis step.
12. **Bundle export of a production containing an entity type without a
    native serializer yet** (e.g. RegexScript, if bundle export ships
    before regex-scripts.md's codec lands): OPEN QUESTION, not decided by
    this spec — likely "omit with a warning in the CLI report," but the
    exact behavior belongs to whichever ships second, this spec or
    regex-scripts.md.

## Test plan

- Fixtures required (place under `fixtures/bundle-import/`):
  - `flat-mixed.zip` — one character PNG, one persona JSON, one preset
    JSON, one lorebook JSON, no folders. Exercises the base classify+import
    happy path for all four non-chat types in one archive.
  - `nested-mixed.zip` — same four types, each under its own subfolder
    plus an unrelated `notes.txt` at the root. Exercises: folder-agnostic
    classification, silent-skip of unrecognized extensions (edge case 5).
  - `st-hybrid-chat.jsonl` inside `chat-only.zip` — pins the header + line[1]
    detection (VAUD test: bulk-import-roundtrip.test.ts:20-42, 101-111).
  - `st-flat-chat.jsonl` inside `chat-only.zip` — pins the no-header
    detection path (VAUD test: bulk-import-roundtrip.test.ts:44-53, 90-99).
  - `st-full-backup.zip` — synthesized to match `hasSillyTavernBackupShape`:
    top-level `settings.json` (with `power_user.personas` +
    `persona_descriptions` populated for at least 2 personas, one causing
    a filename collision to exercise `safeImportFilename` numbering),
    `characters/one.png`, `worlds/one.json`, a `characters/one/` subfolder
    with a dummy expression image (must be skipped), and a preset under
    `openai settings/preset.json`. Exercises the entire ST-backup
    allow-list plus persona synthesis plus skipped-root reporting.
  - `zip-bomb-single-entry.zip` — one entry whose declared uncompressed
    size exceeds 256 MiB. Must abort the whole import.
  - `zip-bomb-cumulative.zip` — many entries individually under the
    per-entry ceiling but summing past 750 MiB. Must abort the whole
    import.
  - `path-traversal.zip` — entries with `../`, a leading `/`, and a
    backslash-containing path. Each must be skipped with the exact
    `"Unsupported file path"` reason, and other valid entries in the same
    archive must still import.
  - `malformed-entries.zip` — one valid preset JSON, one JSON with a
    syntax error, one PNG with no chunk keyword and non-persona structure.
    Pins per-entry failure isolation (VAUD test: bulk-import-roundtrip.
    test.ts:133-149).
  - `roundtrip-export.zip` — produced by `exportBundle` against a small
    fixture production (2 characters, 1 preset, 1 lorebook, 2 personas),
    then re-imported via `importBundle`, asserting the re-imported set is
    deep-equal (by canonical `data`+`escrow`, per the Round-Trip Law) to
    the originals modulo new ULIDs.
- Round-Trip Law applicability: bundle import/export is a container, not a
  codec — the Law applies transitively through each entity's own codec
  round-trip, not to the ZIP container itself. The `roundtrip-export.zip`
  fixture above is the bundle-level analog: export then import must
  reproduce canonical data + escrow for every entity, ULIDs aside.
- Property/unit tests beyond fixtures:
  - `success` is `false` if and only if `failed` is nonempty, independent
    of `warnings` content (pins edge case implicit in Behavior step 9).
  - Zip-bomb ceilings are exact-boundary tested (exactly at 256 MiB /
    750 MiB passes; one byte over fails).
  - `describeBundleWarnings` output is stable/snapshot-tested for the
    ST-backup case (fixed announcement line + sorted deduped roots list +
    chat-count line).

## Non-goals

- Bundle import does not resolve chat-to-character mapping; it stages
  chats and stops (mirrors VAUD behavior exactly).
- Bundle import does not attempt a full SillyTavern-app migration (UI
  settings, extension configs, world-info activation state); only the
  content types this suite already models are extracted from ST backups.
- Bundle export of chats/scenes is out of scope until a canonical
  chat/scene model exists (see Edge case, Export OPEN QUESTION above).
- This spec does not define the CLI surface (`vaud import`/`vaud export
  --all-formats` flags, exit codes, `--strict` interaction) — that is
  specs/features/cli-converter.md's job; this spec defines only the
  `packages/formats` library functions the CLI will call.
- Encrypted or password-protected ZIPs are not supported; no such handling
  exists in the reference implementation.

## Sources consulted

- VAUD `apps/rc/src/lib/imports/bulk-import-orchestrator.ts` (full file,
  lines 1-689 as read; key anchors: 29-68 types, 70-107 zip-bomb guard,
  109-159 ST-backup shape detection, 161-217 ST-backup allow-list +
  synthesis helpers, 219-277 persona synthesis, 279-301 warning rendering,
  303-441 classify loop, 447-550 per-type single-file importers, 552-689
  `executeBulkImport` phase ordering and result assembly).
- VAUD `apps/rc/src/lib/imports/content-detector.ts` (lines 1-252:
  `detectPngType` 32-102, `detectJsonTypeEnhanced` 107-155, `detectJsonLType`
  160-222, `detectFileType` 227-251).
- VAUD `apps/rc/src/lib/imports/__tests__/bulk-import-roundtrip.test.ts`
  (lines 1-150 read; pins hybrid/flat chat detection, preset/lorebook
  classification, and per-entry failure isolation with exact expected
  shapes).
- the master plan (private planning notes) (product shape, package layout intent).
- docs/02-ARCHITECTURE.md (packages/formats role, dependency rule
  `core <- formats <- everything`, productions model referenced for
  `ProductionHandle` in the API sketch).
- the production bible (private planning notes), row for `bundle-import.md` (this file's
  brief) and row for `content-detection.md` (sibling brief, not yet
  written — referenced for terminology only).
- specs/formats/canonical-model.md (v1 content types list, used to scope
  the export OPEN QUESTION on chats).
- specs/formats/escrow-and-roundtrip.md (Round-Trip Law applicability
  statement).
- No search of VAUDEVILLE turned up a bundle EXPORT implementation
  (`grep` for `all-formats`/`bundleExport`/`exportBundle` across
  `apps/rc/src` found only unrelated per-chat and backup-restore code at
  `apps/rc/src/lib/scenes-export/per-chat-export.ts` and
  `apps/rc/src/lib/backup/restore.ts`, neither of which is a
  classify-then-import-style multi-format bundle). The Export section of
  this spec is therefore original design constrained by the import
  behavior and the canonical-model/escrow specs, not ported code; marked
  accordingly with OPEN QUESTIONs where the design is genuinely
  undetermined.
