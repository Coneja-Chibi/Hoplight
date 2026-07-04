# Backyard AI (Faraday) samples

## 1.byaf / 2.byaf / 3.byaf  (Backyard Archive Format, v1)
- Source: https://github.com/ahoylabs/byaf/raw/main/src/byaf/__tests__/test-archives/v1/{1,2,3}.byaf
  (ahoylabs/byaf, the official BYAF spec+tooling repo; these are its own conformance test archives.)
- Downloaded: 2026-07-04
- Format: ZIP container. `manifest.json` + `characters/test123/character.json` + `scenarios/scenarioN.json`
  + `characters/.../images/*` (+ a scenario background image in 2.byaf). schemaVersion 1 throughout.
- NOTE: vaud has NO byaf adapter yet (src/formats/backyard/index.ts is legacy flat-JSON only). These
  samples are the forward-looking corpus for the byaf slice; today 100% of their content would escrow
  because no byaf codec exists to map any of it.

### Which escrowed / unmapped fields each archive exercises
- 1.byaf  - minimal: 1 char, 1 scenario, 1 loreItem, 1 image (avatar). Baseline.
- 2.byaf  - full sampler + template + chat + background:
    scenario carries `formattingInstructions`, the whole SAMPLING block
    (minP/minPEnabled/temperature/repeatPenalty/repeatLastN/topK/topP), `promptTemplate:"general"`,
    `grammar:null`, `messages[]` (ai+human chat transcript), `backgroundImage`, `exampleMessages[]`,
    `firstMessages[]`, `narrative`, `canDeleteExampleMessages`. Character has an extra unlabeled image
    (`label:""`, edge case 12/13). Manifest has `author.name` + `author.backyardURL`.
- 3.byaf  - MULTI-SCENARIO: two scenarios (`narrative:"A test scenario"` and `"Second scenario"`),
    each with its own `firstMessages[]` - exercises the scenarios[1..n] -> alternateGreetings fold and
    full non-primary scenario escrow. Character has 3 images, one with empty label.

### Concrete escrowed-field inventory observed in the wire (see gap list):
- character.json: `id`, `schemaVersion` (bookkeeping); `name` vs `displayName` split (nickname home);
  `isNSFW:false` (content-rating home); `createdAt`/`updatedAt` (ISO strings, attribution home is
  unix-seconds number - type mismatch); `loreItems[]` (embedded lorebook); `images[]` incl. empty label.
- manifest.json: `author.name` (creator home); `author.backyardURL` (hub URL, provenance); `createdAt`.
- scenario.json: `narrative` (scenario home); `firstMessages[0].text` (firstMessage home);
  `exampleMessages[]` (exampleMessages home, needs join); `formattingInstructions` (systemPrompt home);
  `backgroundImage` (presentation.background home) -> all currently escrow-only.
  PRESET-BOUND (no Preset entity yet): `promptTemplate`, sampling block.
  CORRECTLY ESCROW: `grammar` (executable GBNF), `model` (runtime GGUF ptr), `messages[]` (chat
  transcript), `canDeleteExampleMessages` (UI toggle), `characterID` refs, all `$schema`/`schemaVersion`.

### Legacy flat-JSON variant
- The variant the current adapter actually implements (aiName/aiPersona/customDialogue...) is NOT
  represented here - no clean, unambiguously-licensed public single-file sample was found that is not
  itself a PNG-embedded card. The in-repo unit test (backyard.test.ts) already fixtures this shape.
