# Spec: Productions and History

**Package:** `packages/core` (the `Production` manifest zod schema - `Production` is already
listed as a v1 canonical content type in canonical-model.md, so its schema lives where every
other canonical type's schema lives, per ADR-005 and `docs/03-CONVENTIONS.md` "zod schemas are
the single source of truth") + `packages/productions` (new - not yet enumerated in
`docs/02-ARCHITECTURE.md`'s package list; the filesystem engine: entity file I/O, the
content-addressed history store, restore, library mode, bare-file resolution; see OPEN QUESTION
1) · **Milestone:** M0 (manifest schema + bare-file operation), M2 (history store, wired to the
agent's staged-edit `commit` step), M5 (Test Stage / Studio consume production history directly,
per the master plan (private planning notes) "M5 The Test Stage + Productions") · **Status:** draft
**Depends on:** specs/formats/canonical-model.md (Entity envelope, `meta.hash`), ADR-005
(escrow envelope) · **VAUDEVILLE reference:** none - this component has no VAUDEVILLE
precedent; it is designed fresh from `docs/02-ARCHITECTURE.md`'s "Productions (project
workspaces)" section, per the ground truth column in the production bible (private planning notes) line 63.

## Purpose

A production is the unit of work in Vaudeville Studios: a folder on disk holding a set of
canonical entities (characters, lorebooks, presets, personas, regex scripts) as human-readable,
git-friendly files, plus a manifest (`vaud.json`) that indexes them and a local, content-addressed
history store (`.vaud/history/`) that snapshots entity state over time without requiring git.
This component defines: the on-disk folder layout, the manifest schema, how entities are
serialized as files, how snapshots are taken and restored, "library mode" (a managed default
production for users who never explicitly create one), and "bare-file operation" (commands that
touch a single file with no production context at all). It exists so that (a) every studio
surface - CLI, agent loop, future Studio app - has one shared, filesystem-only definition of "a
project" to read and write against, and (b) the agent's staged-edit commits
(`specs/engine/agent-loop.md`) have somewhere durable and undo-able to land, without forcing the
user to know or use git. It is written for an implementing agent with no other context on this
component.

## Behavior

### Production folder layout

```
my-production/
  vaud.json                          # the manifest (see below)
  characters/
    aria-stormwind.character.json
    aria-stormwind.png               # card art asset, referenced from the entity file
  lorebooks/
    aria-world.lorebook.json
  presets/
    my-preset.preset.json
  personas/
    me.persona.md
  regex/
    cleanup-scripts.regex.json
  assets/
    aria-stormwind-sprites/
      neutral.png
      happy.png
  .vaud/
    history/
      objects/
        4a/1f9c...                   # content-addressed blobs, sha256, git-style 2/62 split
      snapshots/
        01J...snapshot.json          # one file per snapshot, ulid-named
      HEAD                            # plain-text file: id of the current snapshot, or empty
    settings.json                     # optional, local-only production settings (never synced)
```

Rules:

1. Entity files live under a top-level folder named for their content type (plural, kebab-case:
   `characters/`, `lorebooks/`, `presets/`, `personas/`, `regex/`). This mirrors the canonical
   content types in `specs/formats/canonical-model.md` ("Content types (v1 surface)"). `World`
   entities (M7) get their own `world/` folder when that milestone lands; not defined here.
2. Every entity file name is `<slug>.<type>.<ext>` where `<type>` is the singular content type
   (`character`, `lorebook`, `preset`, `persona`, `regex`) and `<slug>` is a kebab-case slug
   derived from the entity's display name at creation time (character `name`, lorebook `name`,
   etc.), with a numeric suffix (`-2`, `-3`, ...) appended on collision. The slug is a
   convenience for humans browsing the folder; it is NEVER the entity identity - `Entity.id`
   (the ulid from canonical-model.md) is. Renaming an entity's display name does not
   retroactively rename its file; a future `vaud rename` operation may, explicitly, as a
   file-move + manifest update in one step.
3. `<ext>` is `json` for every content type except Persona, which is `md`
   (`docs/02-ARCHITECTURE.md` line 73 names the folder contents "human-readable JSON/MD files";
   the persona brief, the production bible (private planning notes) line 78, is the only content type whose spec
   names a markdown house format - `*.persona.md`). The internal structure of a `.persona.md`
   file (front matter shape, how `{ id, type, data, escrow, meta }` maps onto a markdown
   document) is `specs/features/personas-system.md`'s responsibility, not this one; that spec is
   not yet written. OPEN QUESTION 2: does a `.persona.md` file carry its `Entity<Persona>`
   envelope as YAML front matter with markdown body content underneath, or some other split?
   This spec only fixes the file extension and folder placement, not the internal format.
4. JSON entity files are pretty-printed: 2-space indent, LF line endings, a single trailing
   newline, and object keys in a stable, spec-fixed order (the order fields are declared in the
   zod schema in `packages/core`, not alphabetical and not insertion order) so that git diffs on
   these files are small and meaningful when a field changes. This is what "git-friendly" means
   operationally (`docs/02-ARCHITECTURE.md`: "a `.vaud/history/` ... no git dependency;
   git-friendly"). `.persona.md` files must follow the same git-friendly spirit (stable field
   order in any front matter, single trailing newline) once personas-system.md fixes their shape.
5. A JSON entity file's body is exactly `{ id, type, data, escrow, meta }` - the `Entity<T>`
   envelope from canonical-model.md, serialized directly. There is no separate "front matter"
   or wrapper format for JSON entity types. (Persona is the one exception, per rule 3 above.)
6. Binary assets (card art PNGs, sprite sheets) are stored as sibling files next to the entity
   that references them, or under `assets/<entity-slug>-<asset-kind>/` for multi-file assets
   (sprite sets). The canonical entity stores a typed, relative-path reference
   (`{ kind: "asset", path: "aria-stormwind.png" }`-shaped; the exact asset-reference schema is
   canonical-model.md's responsibility, not this spec's - see canonical-model.md "Open items":
   "canonical model stores typed references"). This spec only fixes where those referenced files
   physically live relative to the production root.
7. `.vaud/` is the only folder this spec reserves. Nothing else the studio writes may live
   outside `.vaud/` except entity files, assets, and `vaud.json` themselves - a production folder
   must stay legible to a human browsing it in a file manager or git client with `.vaud/`
   collapsed.

### The manifest (`vaud.json`)

`vaud.json` sits at the production root. It is the fast index: every command that needs to list
or locate entities reads this file first and only falls back to a full directory walk if the
manifest is missing, corrupt, or explicitly bypassed (`vaud doctor --reindex`, not specified
further here).

```jsonc
{
  "vaudVersion": "0.4.0",         // studio version that last wrote this file
  "schemaVersion": 1,             // manifest schema version, for future migrations
  "id": "01J8X9K2N4QRZP3F7T6WYB5C0M",  // ulid, assigned once, stable for the life of the production
  "name": "My Production",
  "createdAt": "2026-07-02T00:00:00.000Z",
  "updatedAt": "2026-07-02T00:00:00.000Z",
  "entities": [
    {
      "id": "01J8X9K2N4QRZP3F7T6WYB5C0M",
      "type": "character",
      "path": "characters/aria-stormwind.character.json",
      "hash": "4a1f9c..."          // last-known meta.hash of this entity, for drift detection
    }
  ],
  "settings": {}                   // reserved; production-scoped, non-secret settings only
}
```

Rules:

1. `entities` is kept sorted by `id` (not insertion order, not path) so that adding one entity
   produces a single-line diff, never a reshuffled array.
2. `hash` in an `entities[]` row mirrors that entity's own `meta.hash` (canonical-model.md line
   26) at the time the manifest was last written. A mismatch between the manifest's `hash` and
   the entity file's actual `meta.hash` means the file was edited outside the studio (a text
   editor, a git checkout, a merge) since the manifest was last synced; `vaud doctor` /
   `vaud status` surface this as "N entities modified outside the studio" and reconcile the
   manifest on next write. This is the drift-detection mechanism; it does not block reads.
3. `vaud.json` itself is never entity data and is never snapshotted as an "entity" in
   `.vaud/history/` - but its own bytes ARE captured as part of every snapshot (see below), so
   history still lets you recover a prior manifest state (e.g. after a bad bulk rename).
4. Bumping `schemaVersion` is a breaking change to this spec; `packages/productions` must ship a
   migration function for every schema version it has ever produced, run automatically and
   idempotently on open (`vaud` command that opens a production with an old `schemaVersion`
   upgrades it in place and logs what changed).

### Content-addressed history (`.vaud/history/`)

Modeled on git's object store but deliberately smaller in scope: no branches, no merges, no
compression requirement for v1, linear history only.

**Object store (`objects/`).** A snapshot's payload is the exact bytes of every tracked file at
snapshot time. Each distinct byte sequence is stored once, keyed by its sha256 hex digest, split
git-style into a two-character directory prefix and the remaining 62 characters as the filename
(`objects/4a/1f9c...`).

This spec uses two different hashes and both trace back to canonical-model.md's `meta.hash`
("content hash of data+escrow, for history"), refined here into two layers rather than
contradicted: `meta.hash` remains the LOGICAL version identity of an entity's payload - computed
by `packages/core` at parse/write time from `data + escrow` alone, independent of JSON formatting
- and is what canonical-model.md means by "for history": it is what changes (or doesn't) when the
entity's actual content changes, and it is what `vaud.json`'s per-entity `hash` field and the
drift check (Behavior, manifest rule 2) key on. The object-store hash is a PHYSICAL storage key
one layer below that: it hashes the literal on-disk bytes of a tracked file (including JSON
formatting, and, for non-entity tracked files like `vaud.json` and asset files, content that has
no `meta.hash` at all) so that `commitSnapshot` can content-address and dedup every file it
tracks uniformly, entities and non-entities alike, through one mechanism. For an entity file, the
two hashes usually change together (edit content -> both change) but are never the same number and
must not be conflated in code or in reports: `meta.hash` answers "has this entity's meaning
changed," the object-store hash answers "do I already have these exact bytes stored."

Deduplication is automatic and free: re-snapshotting an unchanged file (same bytes) writes no new
object, only a reference to the existing one. This is what keeps repeated full-production
snapshots cheap even though every snapshot conceptually covers every tracked file (tracked =
every entity file, `vaud.json`, and every asset file referenced by a tracked entity).

**Snapshot records (`snapshots/<id>.json`).** One JSON file per snapshot, named with a ulid so
filenames sort chronologically:

```jsonc
{
  "id": "01J8XA1B2C3D4E5F6G7H8J9K0M",
  "parentId": "01J8X9...",          // previous snapshot's id, or null for the first snapshot
  "createdAt": "2026-07-02T00:03:00.000Z",
  "trigger": "agent-commit",         // "manual" | "agent-commit" | "restore-safety" | "import"
  "message": "Aria: add jealousy trait to personality",
  "files": {
    "characters/aria-stormwind.character.json": { "hash": "4a1f9c...", "entityId": "01J8X9K2..." },
    "vaud.json": { "hash": "9b02ee...", "entityId": null }
  }
}
```

`files` covers every tracked file's path -> object hash at that moment, including files unchanged
since the parent snapshot (a full manifest, not a diff - cheap because of object dedup, and it
means restoring to any single snapshot never requires walking its ancestor chain to reassemble
state, unlike a naive diff-chain design).

**HEAD.** A plain-text file, `.vaud/history/HEAD`, holding the id of the most recent snapshot (or
empty for a production with no snapshots yet). Single pointer, no branches in v1.

**When snapshots are taken.** This spec defines the mechanism; callers decide when to invoke it:

1. `trigger: "manual"` - the user explicitly runs a snapshot command (CLI grammar is
   `specs/features/cli-converter.md`'s / a future CLI spec's concern, not this one).
2. `trigger: "agent-commit"` - the agent loop's staged-edit lifecycle (draft -> validate ->
   approve -> commit, `docs/02-ARCHITECTURE.md` "Staged edits only") calls `commitSnapshot()` as
   its `commit` step. `docs/02-ARCHITECTURE.md` line 65: "Every commit is a version in the
   production's history" - this is the mechanism that makes that sentence true. The staged-edit
   envelope's own lifecycle and validation rules are `specs/engine/agent-loop.md`'s concern; this
   spec only defines the storage side of "commit."
3. `trigger: "restore-safety"` - see Restore, below: an automatic snapshot taken immediately
   before a restore operation, so restores are themselves undo-able.
4. `trigger: "import"` - a bulk import (`specs/formats/bundle-import.md`) that writes many
   entities at once takes one snapshot after the whole import completes, not one per file.
5. Nothing in this spec defines a periodic/idle autosave trigger for M0-M5. OPEN QUESTION 3:
   should there be a debounced autosave snapshot for direct (non-agent) edits made through a
   future Studio app UI, and if so at what interval? Not needed for CLI-only milestones since
   every CLI write is already a discrete, snapshot-able event.

**Restore.** `restoreSnapshot(productionRoot, snapshotId, opts?)`:

1. Loads the target snapshot record.
2. Takes a `restore-safety` snapshot of current working state FIRST, unconditionally, unless
   `opts.skipSafetySnapshot` is explicitly set. This guarantees a restore is never a one-way
   door: the state immediately before the restore is always one `restoreSnapshot` call away.
3. For every path in the target snapshot's `files`, writes that path's object-store blob back to
   the working file, overwriting current contents. Paths that exist in the current working tree
   but are absent from the target snapshot (files created after that snapshot) are deleted,
   unless `opts.scope` narrows the restore to a subset of paths/entity ids (partial restore: "just
   put this one character back the way it was"), in which case only the in-scope paths are
   touched and nothing is deleted.
4. Rewrites `vaud.json`'s `entities[]` hashes to match the restored files, and updates `HEAD` to
   point at a NEW snapshot representing "the state right after this restore" (not the old target
   snapshot's id) - restoring is a forward-moving operation, like `git revert`, not a rewrite of
   history, so `.vaud/history/` itself is append-only and never has records deleted or mutated in
   place.

### Library mode

Users who never run a "create production" command still need somewhere for the agent, the
Doctor, and history to operate. Library mode is a single, managed, well-known default production
that the CLI creates on first use if it does not already exist, at a fixed path:
`<OS user config/data dir>/vaud/library/` (exact base directory per-OS is
`docs/03-CONVENTIONS.md`/a future CLI-conventions spec's concern; this spec only requires that it
be a single, fixed, OS-conventional location, not something the user has to configure to get
started). Library mode is a production like any other - same `vaud.json`, same folder layout,
same `.vaud/history/` - with two differences:

1. It is implicit: any command that needs "a production" and was not given one explicitly (no
   `--production <path>`, not run from inside a directory with an ancestor `vaud.json`) targets
   library mode rather than failing.
2. Its `vaud.json.name` is fixed (`"Library"`) and it is never listed alongside user-named
   productions in a "recent productions" UI without being visually distinguished as the default.

Production discovery for commands run inside a directory: walk upward from the current working
directory looking for `vaud.json`, exactly like git's `.git` search, stopping at the filesystem
root. First `vaud.json` found wins; if none is found, the command falls back to library mode.

### Bare-file operation

Some commands never need "a production" at all: `vaud convert card.png --to charx`,
`vaud inspect lorebook.json`. These operate on exactly the file(s) named on the command line,
performing a codec parse/serialize/inspect in memory, with:

- No `vaud.json` read or written, anywhere.
- No history snapshot taken.
- No production discovery walk performed.

This is bare-file operation, and it is the mode the M1 Converter promise ("works with zero AI
key", the master plan (private planning notes)) depends on being fully independent of productions - a brand-new
user must be able to run `vaud convert` on a downloaded card with no production ever having been
created. The dividing line: a command is bare-file if its inputs and outputs are both named
explicitly as file paths on the command line and it does not invoke the agent loop. A command
crosses into production territory (and therefore at minimum library mode) the moment it needs
durable identity for an entity across runs (history, staged edits, an agent conversation that
references "the character I imported yesterday") - anything needing `Entity.id` continuity needs
a manifest to hold that id, and bare-file operation never persists one.

Edge case: an agent-loop session invoked in a directory with no ancestor `vaud.json`, asked to
edit a bare file the user just pointed it at (not inside any production). The agent's staged-edit
commit step still needs somewhere to snapshot to. Per Library mode above, this falls back to
library mode: the file is treated as if it had been imported into the library production at that
path (a manifest entry is created, pointing at the file's actual on-disk path, which may be
outside the library folder itself - the manifest's `path` field is not required to be a relative
path grounded at the production root when the entity was reached via this fallback; OPEN QUESTION
4: should such an out-of-tree entity reference instead be disallowed, forcing an explicit
import/copy into the library folder before the agent may stage edits against it, which is safer
but adds friction to the single most common "just point the agent at a file" flow?).

## Public API sketch

```ts
// packages/core - the Production canonical type, per canonical-model.md's v1 content-type list
// ("Production (workspace manifest)") and ADR-005 ("canonical types ... zod schemas in
// packages/core"). ZERO deps on other packages, per 02-ARCHITECTURE.md's packages table: this
// schema describes the manifest's SHAPE only, no filesystem I/O.

export const ProductionEntityRefSchema = z.object({
  id: z.string(),          // matches an Entity.id elsewhere in the production
  type: ContentTypeSchema, // "character" | "lorebook" | "preset" | "persona" | "regex" | ...
  path: z.string(),        // relative to production root (see bare-file fallback caveat, OPEN QUESTION 4)
  hash: z.string(),        // last-synced meta.hash of the referenced entity
});
export type ProductionEntityRef = z.infer<typeof ProductionEntityRefSchema>;

export const ProductionManifestSchema = z.object({
  vaudVersion: z.string(),
  schemaVersion: z.number().int(),
  id: z.string(),   // ulid, stable for the life of the production
  name: z.string(),
  createdAt: z.string(),  // ISO
  updatedAt: z.string(),  // ISO
  entities: z.array(ProductionEntityRefSchema), // kept sorted by id, see Behavior
  settings: z.record(z.string(), z.unknown()),
});
export type ProductionManifest = z.infer<typeof ProductionManifestSchema>;

// packages/productions - the filesystem engine. Depends on packages/core for the schemas above
// plus the Entity<T> envelope; owns all disk I/O, history, and production discovery.

import type { Entity, ContentType } from "@vaudeville/core";
import type { ProductionManifest, ProductionEntityRef } from "@vaudeville/core";

export interface Production {
  root: string; // absolute path to the production folder
  manifest: ProductionManifest;
  isLibrary: boolean;
}

// Discovery / lifecycle

/** Upward-walks from `cwd` for an ancestor vaud.json; falls back to library mode if none found. */
export function resolveProduction(cwd: string): Promise<Production>;

/** Creates a new production folder + vaud.json at `root`. Fails if `root` already has one. */
export function createProduction(root: string, name: string): Promise<Production>;

/** Returns (creating on first call) the single, fixed library-mode production. */
export function openLibrary(): Promise<Production>;

// Entity file I/O (reads/writes THROUGH the manifest, keeping entities[] in sync)

export function listEntities(production: Production, type?: ContentType): ProductionEntityRef[];

export function readEntity<T>(production: Production, entityId: string): Promise<Entity<T>>;

/** Writes a new or updated entity file, updates vaud.json's entities[] and updatedAt. Does NOT
 *  take a history snapshot itself - callers decide when to snapshot (see below). */
export function writeEntity<T>(production: Production, entity: Entity<T>, opts?: {
  /** slug hint for a brand-new entity's filename; ignored for updates to an existing file */
  slugHint?: string;
}): Promise<ProductionEntityRef>;

export function deleteEntity(production: Production, entityId: string): Promise<void>;

// History

export type SnapshotTrigger = "manual" | "agent-commit" | "restore-safety" | "import";

export interface SnapshotRecord {
  id: string;
  parentId: string | null;
  createdAt: string;
  trigger: SnapshotTrigger;
  message: string;
  files: Record<string, { hash: string; entityId: string | null }>;
}

/** Captures the current byte-state of every tracked file (all entity files, vaud.json, and every
 *  referenced asset) as one new snapshot. Object-store writes are deduplicated by content hash. */
export function commitSnapshot(
  production: Production,
  trigger: SnapshotTrigger,
  message: string
): Promise<SnapshotRecord>;

export function listSnapshots(production: Production): Promise<SnapshotRecord[]>; // newest first

export function getSnapshot(production: Production, snapshotId: string): Promise<SnapshotRecord>;

export interface RestoreOptions {
  /** Restrict restore to specific paths or entity ids; omit to restore the whole production. */
  scope?: { paths?: string[]; entityIds?: string[] };
  /** Skip the automatic pre-restore safety snapshot. Default false. Discouraged. */
  skipSafetySnapshot?: boolean;
}

/** Restores working files to a prior snapshot's state. Always forward-moving: appends a new
 *  snapshot representing the post-restore state rather than rewinding HEAD. Returns both the
 *  safety snapshot taken beforehand (or null if skipped) and the new post-restore snapshot. */
export function restoreSnapshot(
  production: Production,
  snapshotId: string,
  opts?: RestoreOptions
): Promise<{ safetySnapshot: SnapshotRecord | null; resultSnapshot: SnapshotRecord }>;

/** Reads a single tracked file's bytes as they existed in a given snapshot, without restoring
 *  (used for diff/preview UIs, e.g. Test Stage "compare to last commit"). */
export function readFileAtSnapshot(
  production: Production,
  snapshotId: string,
  path: string
): Promise<Buffer | null>; // null if that path was not tracked at that snapshot
```

## Edge cases & failure modes

1. **`vaud.json` is missing but `.vaud/history/` exists.** Treat as a corrupted production, not a
   fresh one. Reconstruct a minimal `vaud.json` from the latest snapshot's `files` map (it names
   every tracked path) rather than failing outright; surface a warning that the manifest was
   regenerated. Never silently create an empty, disconnected `vaud.json` next to an existing
   history store.
2. **An entity file was hand-edited (or restored via git) outside the studio, so its bytes no
   longer match `vaud.json`'s recorded `hash`.** Not an error. The next command that touches that
   entity re-reads it, recomputes `meta.hash` via `packages/core`'s parser, and updates the
   manifest. `vaud status`-equivalent surfaces "modified outside the studio" as information, not
   as a blocking conflict - there is no merge step because there is nothing to merge against
   (single working copy, no concurrent-edit model in v1).
3. **Two entities produce the same filename slug.** Numeric suffix disambiguation at creation
   time (`aria-stormwind.character.json`, `aria-stormwind-2.character.json`). Slugs are never
   reassigned or renumbered after the fact, even if the earlier-numbered entity is later deleted,
   to avoid a file silently referring to a different entity than a stale reference expects.
4. **Restoring a snapshot whose `files` map references a since-deleted object (object-store file
   missing on disk).** Treat as a corrupted history store for that specific blob only: fail that
   one file's restore with a named error, continue restoring every other file in scope, and
   report the failed path(s) at the end rather than aborting the whole restore. This is a
   defense against partial disk corruption / an interrupted write, not an expected steady-state
   condition.
5. **Snapshotting a production with an asset file larger than a few hundred MB (e.g. a large
   sprite sheet or an accidentally-embedded video).** No size cap is defined in this spec. Object
   dedup means repeated snapshots of an unchanged large file cost nothing extra, but the FIRST
   snapshot after any change to it is a full copy into the object store. OPEN QUESTION 5: should
   there be a size threshold above which the studio warns before tracking a file in history (or
   excludes it from automatic asset tracking and requires an explicit opt-in)?
6. **Concurrent processes writing to the same production** (e.g. the CLI agent REPL and a Studio
   instance open on the same folder, or two CLI invocations from two terminals). No file locking
   is defined in this spec. `commitSnapshot` reads the current `HEAD`, computes a new snapshot,
   and writes `HEAD` last; a race between two processes can produce two snapshots with the same
   `parentId` (a fork in an otherwise-linear history) rather than data loss, because the object
   store's writes are content-addressed and idempotent (write-if-absent). This is an accepted
   surface for v1, not resolved by this spec. OPEN QUESTION 6: is a fork in `.vaud/history/`
   (two snapshots sharing a parent) tolerated permanently (treat `listSnapshots` as a DAG walk
   from `HEAD` rather than assuming strict linearity), or must `commitSnapshot` take a filesystem
   lock and fail the second writer?
7. **`vaud.json`'s `schemaVersion` is newer than the running `vaud` binary understands** (an
   older CLI opening a production last touched by a newer one). Refuse to write, with an error
   naming the required minimum version; reads may still be attempted best-effort. Never silently
   downgrade or strip fields it does not recognize.
8. **An entity references an asset path that does not exist on disk** (moved, deleted by hand,
   never committed). `readEntity` still succeeds (the reference is just a string path in the
   canonical model); the asset is resolved lazily by whoever needs the bytes (a codec serializer,
   the Test Stage). That caller reports a missing-asset error scoped to itself. This spec does not
   validate asset existence as part of manifest sync.
9. **Bare-file command is run on a file that happens to sit inside a production's folder tree**
   (e.g. `vaud convert characters/aria-stormwind.character.json --to charx` run without a
   `--production` flag or agent involvement). Stays bare-file: the command's own inputs/outputs
   are explicit file paths and it does not touch history or the manifest, REGARDLESS of the
   file's physical location. A file living inside a production folder does not automatically pull
   every command touching it into production semantics - only production-discovery-aware commands
   (the agent loop, explicit `vaud history`/`vaud snapshot` commands) do the upward manifest walk.
10. **Restoring with `scope.entityIds` naming an id that is not present in the target snapshot at
    all** (e.g. the entity did not exist yet at that point in history). Report it as a no-op for
    that id (not an error) and proceed with any other ids/paths in scope; a restore whose entire
    scope resolves to nothing is itself a no-op that still records nothing (no empty snapshot
    created).
11. **Library mode's fixed path already exists but is not a valid production** (e.g. the OS
    config directory has a stray `vaud/library/` file, not a folder, from an unrelated cause).
    Fail loudly on first library-mode use rather than attempting to repurpose or delete
    unrecognized content at that path.

## Test plan

- Fixtures required:
  - `fixtures/productions/minimal/` - a hand-built production folder: `vaud.json` + one
    character entity + one lorebook entity, no history yet. Exercises `resolveProduction`,
    `listEntities`, `readEntity`.
  - `fixtures/productions/with-history/` - the above plus a `.vaud/history/` containing 3
    linear snapshots (add character, edit character personality, add lorebook), each snapshot's
    `files` map hand-verified against its object-store contents. Exercises `listSnapshots`,
    `getSnapshot`, `readFileAtSnapshot`.
  - `fixtures/productions/drifted/` - a production whose entity file bytes do not match
    `vaud.json`'s recorded `hash` (simulates an out-of-band edit). Exercises edge case 2.
  - `fixtures/productions/corrupt-missing-manifest/` - `.vaud/history/` present, `vaud.json`
    absent. Exercises edge case 1 (manifest reconstruction from latest snapshot).
  - `fixtures/productions/schema-version-mismatch/` - `vaud.json` with `schemaVersion` set above
    the current spec version. Exercises edge case 7.
- Round-Trip Law applicability: none directly - this is not a format codec. However, entity files
  written by `writeEntity` and re-read by `readEntity` must produce a deep-equal `Entity<T>`
  (a narrower, in-package round-trip check, not the cross-format Law from
  escrow-and-roundtrip.md).
- Property/unit tests beyond fixtures:
  - `commitSnapshot` called twice with no intervening file changes produces two snapshot records
    whose `files` maps are identical in content but writes zero new objects on the second call
    (dedup check via object-store file count before/after).
  - `restoreSnapshot` followed immediately by `restoreSnapshot` back to the pre-restore safety
    snapshot reproduces the exact original working-tree bytes (round-trip through restore).
  - `restoreSnapshot` with `scope` limited to one entity id does not modify any other tracked
    file's bytes or its manifest hash entry.
  - Slug collision: creating two character entities with the same display name produces two
    distinct, stable filenames; deleting the first and creating a third does not reuse or shift
    numbering (edge case 3).
  - `resolveProduction` from a deeply nested subdirectory of a production finds the same
    `vaud.json` as running it from the production root (upward-walk correctness).
  - `resolveProduction` from a directory with no ancestor `vaud.json` anywhere up to filesystem
    root returns the library-mode production, creating it on first call and reusing it
    (same `id`) on every subsequent call.
  - History fork handling per OPEN QUESTION 6's eventual resolution: once decided, a test asserting
    the chosen behavior (either reject-second-writer or DAG-tolerant listing).

## Non-goals

- Does not define a merge/branch model for history. `.vaud/history/` is linear (or, pending OPEN
  QUESTION 5, tolerant of accidental forks) but never exposes branch creation, merging, or
  conflict resolution to the user. Two people collaborating on one production is a future,
  unscoped problem (likely "just use git on top of these files," since the layout is explicitly
  git-friendly).
- Does not replace or wrap git. A user who separately `git init`s a production folder gets normal
  git history on top of this mechanism; this spec neither requires nor forbids that, and does not
  auto-generate a `.gitignore` (OPEN QUESTION 7: should `packages/productions` scaffold a
  `.gitignore` recommending `.vaud/history/objects/` be excluded, since it duplicates what git
  already versions, or should the object store be left committable since dedup keeps it small and
  some users will want history available even without a git remote?).
- Does not implement garbage collection / pruning of old snapshots or unreferenced objects.
  Every snapshot is kept forever in M0-M5. A retention/prune feature is a future spec.
- Does not define the CLI command grammar for snapshots/restore (`vaud snapshot`, `vaud history
  log`, etc.) - that belongs to a CLI-facing spec (`specs/features/cli-converter.md` or a sibling)
  that calls the API sketched here.
- Does not define locking or multi-process coordination beyond the content-addressed,
  write-if-absent property of the object store noted in edge case 6.
- Does not define encryption or access control on production contents. Productions are plain
  files on the user's own disk; the key vault (`specs/engine/key-vault.md`) is the only component
  in this suite that handles secrets, and production files never contain provider keys.
- Does not validate or resolve asset file existence as part of manifest sync (edge case 8) -
  that is left to whichever component actually needs the asset bytes.

## Sources consulted

- `docs\02-ARCHITECTURE.md` lines 33-40 (package
  layout - no `packages/productions` currently listed, hence OPEN QUESTION 1), lines 62-69
  ("The agent" - staged edits, "Every commit is a version in the production's history"), lines
  71-76 ("Productions (project workspaces)" - the entire ground-truth paragraph this spec expands:
  "A production is a folder: human-readable JSON/MD files, a `vaud.json` manifest, and a
  `.vaud/history/` of content-addressed snapshots (no git dependency; git-friendly). Library mode
  ... covers loose-file users; `vaud` commands accept bare file paths too.").
- `docs\the master plan (private planning notes)` line 40 ("v0.1 | The
  Converter: works with zero AI key" - basis for bare-file operation needing no production),
  line 55 ("M5 The Test Stage + Productions ... project workspaces with version history" -
  milestone placement).
- `specs\formats\canonical-model.md` lines 13-29
  (the `Entity<T>` envelope, `id`/`meta.hash` fields this spec's manifest and object store build
  on), lines 72-76 ("Open items" - asset handling, "binary assets stored beside the entity in
  productions; canonical model stores typed references," directly informing the asset-placement
  rules above).
- `specs\formats\escrow-and-roundtrip.md` (full file)
  - read for the distinction between the cross-format Round-Trip Law and this spec's narrower
  in-package write/read round-trip, referenced in Test Plan.
- `docs\decisions\ADR-005-canonical-model.md` (full
  file) - escrow envelope rationale, confirms `Entity.escrow` is part of what gets serialized
  into entity files (Behavior, "Entity files" rule 4).
- `docs\decisions\ADR-006-ai-and-agent.md` lines 22-24
  ("Staged edits with validate-before-commit; the agent never writes user files directly") -
  confirms the agent-loop `commit` step this spec's `commitSnapshot`/`trigger: "agent-commit"`
  exists to serve.
- `docs\03-CONVENTIONS.md` lines 18 (kebab-case file
  naming - applied to entity-type folder names and slugs), lines 22-25 (fixture corpus / no
  hand-edited fixtures convention, applied to this spec's Test Plan fixture list).
- `docs\the production bible (private planning notes)` line 63 (this file's
  own brief row: "vaud.json manifest, folder layout, human-readable entity files, .vaud/history
  content-addressed snapshots, restore, library mode, bare-file operation" and ground truth
  "none (design from architecture doc; git-friendly is a requirement)" - the explicit license to
  design this component fresh rather than port it).
- Git's object-model (content-addressed blobs keyed by hash, two-character directory sharding) is
  cited by name in the Behavior section as the design's closest public analogue, for an
  implementing agent's intuition - not sourced from any file in this repo; general prior art
  knowledge, not a VAUDEVILLE or Vaudeville Studios ground-truth claim.
