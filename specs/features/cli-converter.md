# Spec: CLI Converter Commands (`convert` / `inspect` / `validate` / `import` / `export`)

**Package:** `apps/cli` · **Milestone:** M1 · **Status:** draft
**Depends on:** `specs/formats/canonical-model.md`, `specs/formats/escrow-and-roundtrip.md`,
`specs/formats/content-detection.md`, `specs/formats/bundle-import.md`, and every codec
spec under `specs/formats/` (each contributes a format id and a capabilities matrix to
the tables below). **VAUDEVILLE reference:** none — the `vaud` CLI has no VAUDEVILLE
predecessor; grammar and report shapes are original to this spec, built on top of the
codecs `packages/formats` extracts from VAUDEVILLE.

## Purpose

Defines the five M1 CLI commands that make `vaud` "The Converter": `vaud convert`,
`vaud inspect`, `vaud validate`, `vaud import`, `vaud export`. These are the first
commands to exist (master plan: "v0.1 The Converter: works with zero AI key") and the
proof that every codec in `packages/formats` is real. This spec fixes the exact
argument grammar, the plain-text report rendering, the `--json` machine output shapes,
`--strict` semantics, exit codes, and the algorithm for naming files when one input is
converted to multiple target formats at once. It does not define any codec's field
mapping (that lives in each format's own spec) or the agent REPL (`cli-ux.md`).

## Behavior

### 0. Command surface

| Command | Purpose |
|---|---|
| `vaud convert <input...> --to <format-id...>` | Parse one or more source files, serialize each to one or more target formats. |
| `vaud inspect <input...>` | Parse only; print detected format, canonical summary, and the parse report (escrowed/dropped/warnings). No output files. |
| `vaud validate <input...>` | Parse and zod-validate against the canonical schema; report shape errors. Exit nonzero on any validation failure, independent of `--strict`. |
| `vaud import <input> --into <production>` | Classify and import a single file, a directory, or a mixed ZIP into a production folder, in the dependency order fixed by `specs/formats/bundle-import.md`. |
| `vaud export <source> --to <format-id...> [--all-formats] [--zip]` | Serialize one or more canonical entities (from a production, a directory, or explicit files) out to one or more formats, optionally bundled into a single ZIP. |

All five commands are thin: they call `packages/formats` codecs (`detect` / `parse` /
`serialize` / `capabilities`) and `packages/core` (canonical schemas, `Escrow`,
`ParseReport`/`SerializeReport`). No command contains format logic of its own.

### 1. Global flags (defined in full by `cli-ux.md`; this section fixes only their
converter-specific semantics)

`cli-ux.md` is authoritative for the cross-cutting flag set, help style, and generic
confirmation policy shared by every `vaud` command. This spec does not redefine that
lane; it only pins down the meaning `--json`, `--strict`, `--yes`, `--out-dir`, and
`--quiet` take on specifically inside `convert`/`inspect`/`validate`/`import`/`export`:

| Flag | Converter-specific meaning |
|---|---|
| `--json` | Emit one machine-readable JSON object to stdout (shapes in "Public API sketch" below); all human-readable logging (progress, warnings) moves to stderr. Mutually exclusive with the plain-text report on stdout. |
| `--strict` | Exit code 1 if any `dropped` field appears in any report. Per `specs/formats/escrow-and-roundtrip.md` ("Reports"), `--strict` reacts to `dropped` only — `escrowed` fields are the expected, lossless mechanism and never trip `--strict`. This gate is genuinely owned by this spec: no other command family has reports to gate. |
| `--yes` | Applied here to the converter's own destructive action: overwriting an existing output file (section 3, naming algorithm step 5). General confirmation-prompt mechanics are `cli-ux.md`'s. |
| `--out-dir <dir>` | Where output files land. Default: the directory of each input file (per-input, not a single shared default when inputs span directories). |
| `--quiet` | Suppress the per-file progress lines on stderr; final report still prints. |

Exit codes (fixed for all five commands, per `03-CONVENTIONS.md`): `0` every requested
operation succeeded; `1` a user-facing problem (bad arguments, detection failure,
validation failure, a dropped field under `--strict`, a refused overwrite); `2` an
internal error (uncaught exception, codec bug). When a batch has a mix of successes and
user-facing failures, exit code is `1` and the report lists the failures individually —
partial success is not success.

### 2. Format id registry

`--to` and `--against` (validate) take one or more **format ids**. A format id is the
kebab-case basename of the owning codec spec in `specs/formats/`, except where one spec
covers more than one distinct serialization target (`personas.md`, `regex-scripts.md`):
those expose one format id per target shape. PNG is not a format id — it is a container
flag (`--embed-png`) layered on top of a card- or persona-shaped target, because
`png-embedding.md` describes a tEXt-chunk wrapper applicable to more than one canonical
content type, not a content type of its own.

| Format id | Content type | Owning spec | Default output suffix |
|---|---|---|---|
| `chara-card-v2` | Character | `specs/formats/chara-card-v2.md` | `.v2.json` |
| `chara-card-v3` | Character | `specs/formats/chara-card-v3.md` | `.v3.json` |
| `charx` | Character | `specs/formats/charx.md` | `.charx` |
| `backyard` | Character | `specs/formats/backyard.md` | `.backyard.json` |
| `rolecall-character` | Character | `specs/formats/rolecall-character.md` | `.rcpersona.json` |
| `st-worldinfo` | Lorebook | `specs/formats/st-worldinfo.md` | `.json` |
| `rolecall-lorebook` | Lorebook | `specs/formats/rolecall-lorebook.md` | `.rclorebook.json` |
| `st-preset` | Preset | `specs/formats/st-preset.md` | `.json` |
| `lumiverse-preset` | Preset | `specs/formats/lumiverse-preset.md` | `.lumiverse.json` |
| `st-persona` | Persona | `specs/formats/personas.md` | `.json` |
| `rc-persona` | Persona | `specs/formats/personas.md` | `.rcpersona.json` |
| `st-regex-script` | RegexScript | `specs/formats/regex-scripts.md` | `.json` |
| `rc-regex-script` | RegexScript | `specs/formats/regex-scripts.md` | `.json` |

`--embed-png` is valid only on character and persona targets and requires source art
bytes (see Edge case 6). The exact keyword-precedence rule used when *reading* a PNG
(`ccv3` > `chara` > `rcpersona` > `persona`, per the production bible (private planning notes)'s
`png-embedding.md` brief) is authoritative in `specs/formats/png-embedding.md`, not
here; this spec only consumes its output.

Every codec's `capabilities: Record<CanonicalFieldPath, "native"|"escrow"|"dropped">`
(defined in `specs/formats/escrow-and-roundtrip.md`, "Capabilities matrix") is what
`convert`/`export` reports render from — this spec never hand-maintains a duplicate
list of which fields are lossy per format.

### 3. `vaud convert`

```
vaud convert <input...> --to <format-id...> [--out-dir <dir>] [--strict] [--json] [--yes] [--embed-png]
```

- `<input...>`: one or more file paths (glob-expanded by the shell or, on Windows,
  internally — `vaud` must not rely on shell globbing since `cmd.exe`/PowerShell do not
  expand globs the way POSIX shells do).
- `--to <format-id...>`: one or more format ids, consumed greedily until the next flag
  or end of argv (matches the illustrative grammar in
  `wireframes/cli/cli-and-tui.html:36`, e.g. `vaud convert VESPER.png --to charx json
  backyard` — non-normative wireframe, but this spec adopts its surface grammar).
  `json` alone as a bare `--to` value is a shorthand alias for `chara-card-v3` when the
  detected content type is Character (the "current preferred JSON shape"); this alias
  is a CLI-level convenience, not a fact about the underlying format, and only exists
  for the Character content type. Required: at least one value. There is no implicit
  default target.
- For each input, `vaud convert` runs `detect` -> `parse` (producing canonical entity +
  escrow + `ParseReport`), then for each requested target runs `serialize` (producing
  bytes + `SerializeReport`).
- Every `--to` value must be a format id whose content type matches the input's
  detected content type; a mismatch is a per-target failure (Edge case 2), not a fatal
  abort of the whole input.

#### Multi-target output naming algorithm

Given input file `dir/NAME.ext` and requested targets `[f1, f2, ...]`:

1. `base = NAME` with its own extension stripped, but the stripping checks the full
   `FORMAT_SUFFIX` table (all values in the format id registry, longest match first)
   before falling back to a bare final-extension strip. `VESPER.v2.json` strips the
   known suffix `.v2.json` to recover `base = VESPER`, not `VESPER.v2`; `VESPER.charx`
   strips `.charx` to `VESPER`; a file with no recognized suffix (`VESPER.png`,
   `VESPER.custom.json`) falls back to stripping only the final extension (`VESPER`,
   `VESPER.custom`). This makes same-format round-trip conversion idempotent on the
   filename (`VESPER.v2.json --to chara-card-v2` writes `VESPER.v2.json` again, not
   `VESPER.v2.v2.json`).
2. `outDir = --out-dir value, or dir (the input's own directory) if omitted`.
3. For each target `fi`, candidate name = `base + FORMAT_SUFFIX[fi]` (table above),
   EXCEPT when `--embed-png` is set for that target (see below), which overrides the
   suffix to `.png`.
4. If two or more targets in the same invocation produce the same candidate name
   (possible for the several formats whose suffix is bare `.json`, or for two
   `--embed-png` targets both resolving to `.png`), disambiguate by inserting the
   format id before the extension: `base.<format-id>.json` (or `base.<format-id>.png`),
   and emit a `warning` in the report naming the collision.
5. If the resulting path already exists on disk: without `--yes` and in a TTY, prompt
   `overwrite <path>? [y/N]`; without `--yes` in a non-TTY, fail that target with
   `"refused to overwrite (no --yes)"` and exit 1 for the batch; with `--yes`,
   overwrite unconditionally.
6. Every input is processed independently — one input's target collisions or
   overwrite refusals do not block another input's outputs.

#### `--embed-png` behavior

`--embed-png` is a modifier on one or more of the requested card/persona targets, not
a format id of its own (section 2). When set for target `fi` (a `chara-card-v2`,
`chara-card-v3`, or `rolecall-character`/`rc-persona` target):

1. The target is first serialized to its normal canonical JSON shape exactly as
   without `--embed-png` (so its `SerializeReport` — escrowed/dropped/warnings — is
   identical either way).
2. That JSON is then written into a PNG tEXt chunk per `specs/formats/png-embedding.md`
   (keyword selection, base64 encoding, chunk placement, and precedence on read are all
   that spec's ground truth, not restated here).
3. Source art bytes come from the input's own canonical asset reference (a Character
   or Persona parsed from an existing PNG carries its source image forward
   automatically). When no asset reference exists (e.g. parsing a bare `st-worldinfo`
   JSON, or a character JSON never packaged in a PNG), the target fails with
   `userMessage: "no source image to embed into"` (Edge case 6) rather than
   synthesizing placeholder art.
4. The output suffix for that target becomes `.png` (step 3 above), superseding the
   target's normal `FORMAT_SUFFIX` entry; the `--to <format-id>` value still selects
   which JSON shape is embedded (a `chara-card-v3` target with `--embed-png` writes a
   `ccv3`-keyword PNG, not a `chara`-keyword one).
5. OPEN QUESTION: whether `vaud convert`/`vaud export` should also accept a `--art
   <file>` flag to supply art when no asset reference exists, rather than always
   failing — not decided by this spec; a plausible future extension, not required for
   M1.

### 4. `vaud inspect`

```
vaud inspect <input...> [--json]
```

Parses each input and prints a summary: detected format id + confidence (from
`specs/formats/content-detection.md`), canonical content type, a short identity
line (e.g. character name, lorebook entry count), and the full `ParseReport`
(escrowed field count + list, dropped field count + list, warnings). Writes no files.
`inspect` never fails on escrow or dropped fields by itself (there is no `--strict`
gate on `inspect` — it is a read-only report, not a pass/fail check); it exits 1 only
if detection itself fails (Edge case 3) or the file cannot be read/parsed as JSON/PNG
at all.

### 5. `vaud validate`

```
vaud validate <input...> [--against <format-id>] [--strict] [--json]
```

Parses each input, then validates the canonical entity against its `packages/core` zod
schema. `--against <format-id>` additionally re-serializes to that format and asserts
the Round-Trip Law (`specs/formats/escrow-and-roundtrip.md`) holds against the input
itself (useful for validating a hand-edited file before shipping it). Zod errors are
reported as a list of `{ path: string (JSON-pointer-ish), message: string }`; any such
error is a validation failure independent of `--strict`. `--strict` on `validate` adds
the same dropped-field gate as `convert`/`export`, evaluated against the `--against`
serialize pass when present, or a no-op (no report to check) when absent.

### 6. `vaud import`

```
vaud import <input> --into <production> [--yes] [--json]
```

`<input>` is a single file, a directory, or a `.zip`. Behavior:

- Single recognized file (character/lorebook/preset/persona/regex-script): parsed and
  written into the production's matching subfolder.
- Directory: every recognized file inside is imported; unrecognized files are skipped
  and listed as warnings, not failures.
- `.zip`: delegates entirely to `specs/formats/bundle-import.md` — classify every
  archive entry, then import in that spec's fixed dependency order. This spec does not
  restate that order or its size/zip-bomb limits; see that spec for both.
- `--into <production>` names a production folder (`specs/engine/productions-and-history.md`,
  not yet written). For M1, `vaud import` treats `<production>` as an opaque directory
  it creates if missing and writes recognized-content subfolders into; it does not
  depend on any production manifest schema. OPEN QUESTION: once
  `productions-and-history.md` exists, whether `import` must also write a
  `.vaud/history` snapshot and/or update `vaud.json` — deferred to that spec.

### 7. `vaud export`

```
vaud export <source...> --to <format-id...> [--all-formats] [--zip] [--out-dir <dir>] [--strict] [--json] [--yes]
```

- `<source...>`: files, or a production/directory root (every recognized entity inside
  is exported).
- `--to <format-id...>`: same grammar as `convert`. Mutually exclusive with
  `--all-formats`.
- `--all-formats`: export every format id whose content type matches each source
  entity's content type (i.e. the full row-set of the format id registry table,
  filtered by content type). Matches `wireframes/cli/cli-and-tui.html:49`'s
  `vaud export production/neon-noir --all-formats --zip`.
- `--zip`: instead of writing loose files into `--out-dir`, bundle all produced outputs
  for the whole invocation into one `<source-basename>-bundle.zip` at `--out-dir`
  (default: current directory). The naming algorithm in section 3 still governs the
  in-zip file names.
- Naming, overwrite, and collision rules are identical to `convert` (section 3),
  applied per source entity.

### 8. Report rendering (plain text, stdout)

Per `03-CONVENTIONS.md` ("Output vocabulary is plain first... not 'the curtain rises
on 3 files'"): wording is plain; the only house flavor is the `+`/`-`/`.` line-prefix
glyphs already established as house glyphs (`+ - · ✦`). One line per produced artifact
or per failure; a one-line summary at the end. Example (`vaud convert`, two targets,
one escrow, no drops):

```
+ VESPER.charx           risu, lossless
+ VESPER.v3.json         spec-clean
converted VESPER.png -> 2 files, 0 escrowed, 0 dropped
```

Example with an escrowed field and a failure:

```
+ VESPER.backyard.json   2 fields escrowed for round-trip
- MARLOW.png -> rolecall-character   detection failed: unrecognized PNG tEXt keyword
converted 1 of 2 inputs -> 1 file, 2 escrowed, 0 dropped, 1 failed
```

`--strict` failures print the dropped field list before the summary line and the
process exits 1:

```
! VESPER.charx  dropped: extensions.risu.customScripts (charx has no equivalent field)
convert failed under --strict: 1 dropped field
```

### 9. `--json` shapes

All five commands, when `--json` is passed, emit exactly one JSON object to stdout
(never partial/streamed JSON) matching the interfaces in the Public API sketch below.
Progress and human-readable warnings still go to stderr as plain lines (not JSON) so
`--json` output on stdout stays parseable with `jq`/similar.

## Public API sketch

```ts
// apps/cli/src/commands/*.ts — command handlers. All import from packages/core and
// packages/formats only; never from other apps.

import type { Entity, ContentType } from "@vaud/core";
import type { ParseReport, SerializeReport } from "@vaud/core/reports";

export type FormatId =
  | "chara-card-v2" | "chara-card-v3" | "charx" | "backyard" | "rolecall-character"
  | "st-worldinfo" | "rolecall-lorebook"
  | "st-preset" | "lumiverse-preset"
  | "st-persona" | "rc-persona"
  | "st-regex-script" | "rc-regex-script";

export interface FormatRegistryEntry {
  id: FormatId;
  contentType: ContentType;
  defaultSuffix: string;      // e.g. ".v3.json"
  ownerSpec: string;          // repo-relative path, e.g. "specs/formats/chara-card-v3.md"
}

export const FORMAT_REGISTRY: readonly FormatRegistryEntry[];

export interface GlobalFlags {
  json: boolean;
  strict: boolean;
  yes: boolean;
  outDir?: string;
  quiet?: boolean;
}

export type ExitCode = 0 | 1 | 2;

export interface CommandOutcome<TJson> {
  exitCode: ExitCode;
  json?: TJson;          // populated only when GlobalFlags.json is true
  render(): string;      // plain-text report; called only when GlobalFlags.json is false
}

// --- convert ---

export interface ConvertArgs extends GlobalFlags {
  inputs: string[];
  to: FormatId[];
  embedPng?: boolean;
}

export interface ConvertFileResult {
  input: string;
  detected?: { formatId: FormatId; confidence: "high" | "medium" | "low" };
  parseReport?: ParseReport;
  outputs: Array<{
    target: FormatId;
    path: string;
    serializeReport: SerializeReport;
    written: boolean;       // false if refused overwrite or dropped under --strict
  }>;
  error?: { userMessage: string; code: "detection-failed" | "content-type-mismatch" | "overwrite-refused" | "internal" };
}

export interface ConvertJsonResult {
  files: ConvertFileResult[];
  summary: { inputs: number; succeeded: number; failed: number; filesWritten: number; escrowed: number; dropped: number };
}

export function convert(args: ConvertArgs): Promise<CommandOutcome<ConvertJsonResult>>;

// --- inspect ---

export interface InspectArgs extends GlobalFlags {
  inputs: string[];
}

export interface InspectFileResult {
  input: string;
  detected?: { formatId: FormatId; confidence: "high" | "medium" | "low" };
  contentType?: ContentType;
  identity?: string;             // short human label: character name, lorebook title, etc.
  parseReport?: ParseReport;
  error?: { userMessage: string; code: "detection-failed" | "parse-failed" };
}

export function inspect(args: InspectArgs): Promise<CommandOutcome<{ files: InspectFileResult[] }>>;

// --- validate ---

export interface ValidateArgs extends GlobalFlags {
  inputs: string[];
  against?: FormatId;
}

export interface ValidationError { path: string; message: string; }

export interface ValidateFileResult {
  input: string;
  schemaErrors: ValidationError[];
  roundTrip?: { formatId: FormatId; ok: boolean; report?: SerializeReport };
  error?: { userMessage: string; code: "detection-failed" | "parse-failed" };
}

export function validate(args: ValidateArgs): Promise<CommandOutcome<{ files: ValidateFileResult[] }>>;

// --- import ---

export interface ImportArgs extends GlobalFlags {
  input: string;          // file, directory, or .zip
  into: string;            // production directory
}

export interface ImportedItem { id: string; name: string; contentType: ContentType; sourceFile: string; }

export interface ImportJsonResult {
  imported: ImportedItem[];
  skipped: Array<{ file: string; reason: string }>;
  failed: Array<{ file: string; reason: string }>;
}

export function importCommand(args: ImportArgs): Promise<CommandOutcome<ImportJsonResult>>;

// --- export ---

export interface ExportArgs extends GlobalFlags {
  sources: string[];
  to?: FormatId[];
  allFormats?: boolean;
  zip?: boolean;
}

export interface ExportJsonResult {
  entities: ConvertFileResult[];  // same per-entity shape as convert; export is
                                   // "convert sourced from a production instead of a bare file"
  zipPath?: string;
}

export function exportCommand(args: ExportArgs): Promise<CommandOutcome<ExportJsonResult>>;
```

## Edge cases & failure modes

1. **Unrecognized input file.** `detect` returns no match. `convert`/`inspect`/
   `validate` report `detection-failed` for that input and continue with the rest of
   the batch; exit code 1 for the batch (Edge case rule in section 1).
2. **`--to` target's content type does not match the input's detected content type**
   (e.g. a Lorebook input with `--to backyard`). That single target fails with
   `content-type-mismatch`; other valid targets for the same input still run.
3. **`--strict` with only escrowed fields, no dropped fields.** Must NOT fail — per
   `escrow-and-roundtrip.md`, escrow is the lossless mechanism and only `dropped`
   triggers `--strict`.
4. **Two `--to` targets resolve to the same output filename** (e.g. two formats both
   using the bare `.json` suffix). Disambiguated per section 3 step 4, with a warning
   in the report; never silently overwritten within the same invocation.
5. **Output path already exists on disk.** Governed by `--yes`/TTY rules in section 3
   step 5; never overwritten silently in a non-interactive context.
6. **`--embed-png` requested but no source art bytes are available** (e.g. converting
   a bare `st-worldinfo` JSON lorebook, or a character JSON that was never packaged in
   a PNG and carries no asset reference). Fails that target with
   `userMessage: "no source image to embed into"`; see "`--embed-png` behavior" in
   section 3 for the full rule and its OPEN QUESTION on a possible future `--art`
   flag.
7. **Multiple input files with the same basename in different source directories,
   default `--out-dir` (unset).** No collision — default `--out-dir` is per-input (its
   own directory), so outputs land beside each source file, never merged into one
   folder implicitly.
8. **Multiple input files with the same basename, explicit shared `--out-dir`.** A
   real collision at step 3/4 of the naming algorithm across DIFFERENT inputs (not
   just different targets of one input) is out of scope for the auto-disambiguation in
   step 4, which only covers same-input target collisions. This case fails the second
   input's conflicting output with `overwrite-refused` unless `--yes` is set (then it
   overwrites, last-input-wins, and a warning is emitted).
9. **`vaud import` given a `.zip` that decompresses beyond the archive size guard.**
   Delegates entirely to `specs/formats/bundle-import.md`'s limits and error shape;
   this command does not define or duplicate the numeric thresholds.
10. **`vaud validate --against` on a format the input cannot losslessly reach** (e.g.
    validating a `chara-card-v3`-only field set against `--against chara-card-v2`).
    Not an error by itself — the round-trip check reports `ok: false` with the
    `SerializeReport` showing the dropped/escrowed fields; only `--strict` turns that
    into a failing exit code.
11. **stdin input.** OPEN QUESTION: whether any of the five commands accept `-` as a
    stdin placeholder (useful for piping) is undecided; not covered by
    `docs/03-CONVENTIONS.md`'s CLI section, which specifies `--json`/exit codes/
    confirmation rules but not stdin handling.
12. **Glob expansion on Windows.** Since `cmd.exe`/PowerShell do not glob, `vaud` must
    expand `*`/`**` patterns in `<input...>`/`<source...>` arguments itself rather than
    relying on shell behavior, so the same command line works identically across the
    three release OSes (ADR-003 targets Windows/macOS/Linux).
13. **`vaud import <directory>` containing a mix of recognized and unrecognized
    files.** Unrecognized files are warnings, not failures; the command still exits 0
    if every recognized file imported successfully.
14. **Empty `--to` list.** Rejected at argument-parsing time with exit code 1 before
    any file is touched; there is no implicit default target for `convert` or
    `export --to` (only `--all-formats` supplies an implicit target set).

## Test plan

- Fixtures required (reuses the shared fixture corpus under `fixtures/<format>/`, per
  `03-CONVENTIONS.md`'s "fixture corpus is sacred" rule — no new fixture format, only
  CLI-level tests driving those fixtures through the command layer):
  - `fixtures/chara-card-v3/vesper/` (or equivalent existing character fixture) driven
    through `vaud convert --to charx chara-card-v2 backyard` to exercise naming,
    multi-target, and report rendering (mirrors `wireframes/cli/cli-and-tui.html:36`'s
    illustrative command).
  - A fixture pair with an escrowed-only field (exercises `--strict` passing, Edge
    case 3) and a fixture with a genuinely dropped field for at least one target
    codec (exercises `--strict` failing, section 8's third example).
  - A malformed/unrecognized PNG fixture (from the misdetection cases required by
    `specs/formats/escrow-and-roundtrip.md`'s fixture corpus rules) driven through
    `vaud inspect` to assert `detection-failed` handling (Edge case 1).
  - A small mixed-content `.zip` fixture driven through `vaud import` to assert
    delegation to `bundle-import.md`'s ordering (integration test, not a re-test of
    that spec's own unit tests).
- Round-Trip Law applicability: `vaud convert <F> --to <same format as F>` for every
  fixture must satisfy the Round-Trip Law directly (this is the CLI-level expression
  of the law each codec spec already tests at the unit level); a CLI test asserts the
  reparsed output is deep-equal to the original parse.
- Property/unit tests beyond fixtures:
  - Naming algorithm (section 3) as a pure function: base-name stripping, suffix
    lookup, collision disambiguation, given synthetic (non-fixture) filename inputs.
  - Exit code matrix: all-success -> 0, mixed -> 1, forced internal throw (mocked
    codec) -> 2.
  - `--json` output is valid JSON and matches the interfaces in the Public API sketch
    (schema-checked in tests, not hand-inspected).
  - Windows glob expansion (Edge case 12) unit-tested independent of a real shell.

## Non-goals

- Does not define any codec's field mapping, detection heuristics, or capabilities
  matrix — those live in each format's own spec under `specs/formats/`.
- Does not define the agent REPL, bare `vaud` invocation, or `~/.vaud/config.json` —
  those are `cli-ux.md`.
- Does not define production manifest (`vaud.json`) or history snapshot behavior —
  that is `specs/engine/productions-and-history.md` (not yet written); `vaud import`/
  `vaud export` treat a production path as an opaque directory for M1.
- Does not define `vaud doctor`, `vaud lore test`, or any M2+ command shown in the CLI
  wireframe — those belong to their own milestone specs (`script-doctor.md`,
  `lorebook-engine.md`, etc.).
- Does not define the self-updater or release binary packaging (ADR-003, `updater.md`).

## Sources consulted

- the master plan (private planning notes) — v0.1 "The
  Converter" scope, `vaud convert/inspect/validate/export` command names, M1 exit
  criteria.
- `docs/02-ARCHITECTURE.md` — `packages/*`
  dependency rule (`core <- formats <- everything`), escrow/capabilities mechanism,
  productions concept.
- `docs/03-CONVENTIONS.md:33-40` — CLI
  conventions section: `--json`, exit codes 0/1/2, `--yes` for destructive ops, plain-
  first output vocabulary.
- `the production bible (private planning notes):72` —
  brief row for `cli-converter.md`: five commands, report rendering, `--json` shapes,
  `--strict`, exit codes, multi-target naming; ground truth pointer to escrow spec and
  `03-CONVENTIONS.md`.
- `specs/formats/canonical-model.md` —
  `Entity<T>` envelope, `ContentType` set, escrow/capabilities relationship.
- `specs/formats/escrow-and-roundtrip.md` —
  Round-Trip Law definition; Escrow envelope shape; `--strict` reacts to `dropped`
  only (quoted in section 1); `ParseReport`/`SerializeReport` field names (escrowed,
  dropped, escrowShadowed, warnings); capabilities matrix mechanism; fixture corpus
  rules (misdetection cases as permanent fixtures).
  `escrow-and-roundtrip.md` — "Reports" — the exact clause: "`--strict` exits nonzero
  if `dropped` is nonempty."
- `templates/SPEC-TEMPLATE.md` — section
  structure followed by this file.
- `wireframes/cli/cli-and-tui.html:36,49` —
  illustrative (non-normative) CLI grammar examples (`vaud convert VESPER.png --to
  charx json backyard`; `vaud export production/neon-noir --all-formats --zip`) used
  to shape this spec's `--to`/`--all-formats`/`--zip` grammar and output-naming
  examples; this file is a wireframe mockup, not ground truth, and is cited only where
  explicitly noted as such above.
- `<RoleCall>/apps/rc/src/lib/imports/bulk-import-orchestrator.ts` —
  read for background on mixed-ZIP classify-then-import dependency ordering (personas,
  characters, presets, lorebooks, then chats) and zip-bomb size guards; this file is
  the ground truth for `specs/formats/bundle-import.md`, not for this spec, so
  `vaud import`'s behavior section here delegates to that spec by reference rather
  than restating its details, per this file's own brief (ground truth: escrow spec +
  `03-CONVENTIONS.md` CLI section only).
- the production bible (private planning notes) global rules and reviewer rules sections — governed
  the "never invent format facts" / "cite every claim" constraints applied throughout.
