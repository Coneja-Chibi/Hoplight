# Marinara presets

## marinara-universal-preset-v12.marinara.json

- What: "Marinara's Universal Preset" (v12), the prompt-manager preset Marinara-Engine bundles as
  its built-in default. A `marinara_preset` export envelope
  (`{ type, version, exportedAt, data: { preset, sections, groups, choiceBlocks } }`) - the exact
  shape `GET /prompts/:id/export` serves.
- Source: Marinara-Engine repository, `packages/server/src/db/default-preset.json`, at commit
  `daf8c212`. It is the engine's own shipped artifact, not a scraped third-party file.
- Reformatting: reserialized with `JSON.stringify(parsed, null, 2)` (2-space, LF, no BOM, no
  trailing newline) so it matches the codec's own serializer output byte-for-byte, exactly as the
  NovelAI lorebook fixtures were normalized to their codec. No field values were changed; key order
  is preserved by parse-then-stringify.
- Used by: `src/formats/marinara/preset.test.ts` (detection, wire-to-canonical mapping, unedited
  byte-identical round-trip, field-diff overlay under edits).

Still wanted: a community-authored public Marinara preset (e.g. a widely shared roleplay preset) to
complement the built-in default. Record the exact download URL, date, and license terms here when
added.
