# Marinara samples

Marinara reads CCv3 cards with its features in the extensions field; its best-known public
artifacts are presets and regex packs.

No samples collected yet. Wanted:

- `presets/`: Marinara's Spaghetti Recipe (the widely shared public ST preset), with the exact
  download URL + date recorded here on collection
- `characters/`: a CCv3 card carrying Marinara extension data
- Regex: the "Marinara's Essentials" pack already lives in `src/formats/_fixtures/regex/` for the
  test suite; a public sample copy can live here once provenance is recorded

## lorebooks/arcadia-world-lore.marinara.json

- Source: CONSTRUCTED, not a captured export. Hand-built to match the engine schemas exactly:
  `packages/shared/src/schemas/lorebook.schema.ts` (book, entry, folder fields) and the export
  envelope in `packages/server/src/routes/lorebooks.routes.ts` (`{ type: "marinara_lorebook",
  version: 1, exportedAt, data: { lorebook, entries, folders } }`, ExportEnvelope in
  `packages/shared/src/types/export.ts`). Field types are the DESERIALIZED storage-row shape
  (`services/storage/lorebooks.storage.ts` parses the SQLite "true"/"false" strings and JSON
  columns back to real booleans/arrays/objects before the row reaches the envelope).
- Engine commit: Marinara-Engine daf8c212.
- Theme: the engine's own `create_lorebook` example, Arcadia World Lore / Silver Court
  (`packages/server/src/db/seed-mari.ts` create_lorebook example).
- Exercises: regex keys (per-entry `useRegex`), secondary keys with `and_all`, a `constant` entry,
  `position` 2 with `depth` + non-default `role`, `sticky`/`cooldown`/`delay`, character +
  character-tag filters, `additionalMatchingSources` (including the unmapped `character_name`),
  `activationConditions`, a `schedule`, `relationships`, and a NESTED folder pair
  (`folder-spies.parentFolderId = folder-court`) alongside root-level entries.
- REPLACE ME: swap this for a real captured `.marinara.json` export once one is collected with a
  recorded source URL, date, and license. The codec round-trip test keys off this file's path.

## lorebooks/arcadia-world-lore.marinara.json

- Source: CONSTRUCTED, not a captured export. Hand-built to match the engine schemas exactly:
  `packages/shared/src/schemas/lorebook.schema.ts` (book, entry, folder fields) and the export
  envelope in `packages/server/src/routes/lorebooks.routes.ts` (`{ type: "marinara_lorebook",
  version: 1, exportedAt, data: { lorebook, entries, folders } }`, ExportEnvelope in
  `packages/shared/src/types/export.ts`). Field types are the DESERIALIZED storage-row shape
  (`services/storage/lorebooks.storage.ts` parses the SQLite "true"/"false" strings and JSON
  columns back to real booleans/arrays/objects before the row reaches the envelope).
- Engine commit: Marinara-Engine daf8c212.
- Theme: the engine's own `create_lorebook` example, Arcadia World Lore / Silver Court
  (`packages/server/src/db/seed-mari.ts` create_lorebook example).
- Exercises: regex keys (per-entry `useRegex`), secondary keys with `and_all`, a `constant` entry,
  `position` 2 with `depth` + non-default `role`, `sticky`/`cooldown`/`delay`, character +
  character-tag filters, `additionalMatchingSources` (including the unmapped `character_name`),
  `activationConditions`, a `schedule`, `relationships`, and a NESTED folder pair
  (`folder-spies.parentFolderId = folder-court`) alongside root-level entries.
- REPLACE ME: swap this for a real captured `.marinara.json` export once one is collected with a
  recorded source URL, date, and license. The codec round-trip test keys off this file's path.

Record source URL, date, and license for every file added.