# Agnai samples - sources

- robot.native.json - Agnai's seed character "Robot", transcribed from agnaistic/agnai@dev
  `common/characters.ts` (AGPL-3.0; data/facts only, no code copied), reshaped into the native export
  form (`charToJson` native = character minus `_id`). Exercises: `persona.structured` (kind
  "attributes"), greeting/scenario/sampleChat, name. Exercises NONE of the de-escrow gap fields.
- No public downloadable native Agnai JSON export carrying voice/sprite/culture/imageSettings/json was
  found (Agnai distribution is PNG/CCv2-dominant; native JSON exports are user-local). The de-escrow
  edit-tests therefore use a TYPE-GROUNDED fixture in agnai.test.ts whose wire shapes were verified
  field-by-field against the agnai source types (fetched 2026-07-04, facts only):
  - `voice` discriminates on `service` (NOT "provider"): common/types/texttospeech-schema.ts
  - `FullSprite` is FLAT (part keys + eyeColor/bodyColor/hairColor/gender at one level): common/types/sprite.ts
  - `imageSettings` affixes prefix/suffix/negative/template: common/types/image-schema.ts (BaseImageSettings)
  - Character carries culture/visualType/sprite/voice/voiceDisabled/json/imageSettings: common/types/library.ts

Schema references (facts only, AGPL-3.0): common/types/library.ts, common/types/memory.ts,
common/types/texttospeech-schema.ts, common/types/sprite.ts, common/types/image-schema.ts,
common/characters.ts.
