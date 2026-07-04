# RoleCall sample provenance

No genuine RoleCall card/lorebook export file was found on disk (searched
`C:\Users\chiev\Downloads`, `C:\Users\chiev\Documents\RoleCall`). The one
lorebook-shaped JSON at the RC repo root, `bunnymo-v2.9.json`, is a SillyTavern
worldbook (`{entries:{...}}` map), NOT a RoleCall v1 export. So both samples here
are CONSTRUCTED, grounded field-for-field in RoleCall's own serializers (RC is
Chi's code, read freely).

## vera-casting-card.v3.json (character)

A Character Card V3 export as RC's serializer actually emits one. Grounded in:
- `C:\Users\chiev\Documents\RoleCall\src\lib\formats\character\serialize-v2.ts`
  (`serializeToV2`, lines 140-231): the full `extensions.rolecall` block
  (id, tagline, genre, fandom, nsfw, content_rating, token_count, image_url,
  thumbnail_url, source_url, creator_notes, creators_note, accent_color, details,
  loadout, alternate_greeting_titles, recommendations, linkedLorebooks). Note
  `data.creator_notes` is set to the tagline (serialize-v2.ts:219), while
  `extensions.rolecall.creator_notes` carries the real "notes to other creators".
- `serialize-v3.ts` (`serializeToV3`, lines 103-181): V3 wraps V2 and spreads the
  FULL rolecall block through `...v2.data` (only `character_book`/`character_books`
  are destructured out). The narrow `CharacterCardV3Data.extensions.rolecall` TS
  type (serialize-v3.ts:79-91) lists only 9 fields but is a TYPE-ONLY narrowing;
  runtime emits all V2 fields. So a real V3 card DOES carry details/creators_note/
  accent_color/token_count/alternate_greeting_titles etc. Sample reflects runtime.
- `details` uses the RICH casting-card shape from the monorepo
  `C:\Users\chiev\Documents\VAUDEVILLE\packages\types\src\character.ts:79-108`
  (`CharacterCardDetails`): signature_color, gradient_colors, full_name, title,
  age, pronouns, colors, media_links, fieldOrder, default_background,
  prompt_depth_injections, publicDefinitionDisplay. The pre-monorepo
  `apps/rc` / `RoleCall` `content/types.ts` `CharacterDetails` (RoleCall
  content/types.ts:155-163) is a leaner DB-row subset (signature_color,
  gradient_colors, full_name, title, age, pronouns, colors only); the editor
  writes the richer superset into the `details` JSONB, so the rich shape is
  realistic for an RC-saved character.
- Sprites -> assets grounded in `RoleCall\src\lib\sprites\types.ts`
  (`spritesToV3Assets`, lines 289-306): sprite `main` -> asset `type:"icon"`,
  every other sprite type passes through verbatim, so expressions serialize as
  **`type:"expression"`** (NOT `"emotion"`). `name` = label or `${type}_${i+1}`;
  `ext` from the URL. URLs use an allowlisted host (i.imgur.com) with image
  extensions per `ALLOWED_SPRITE_HOSTS` (types.ts:65-85).
- `extensions.depth_prompt` included to exercise the ST/base depth mechanism that
  coexists with RC's `details.prompt_depth_injections[]`.

## aetheria-lorebook.v1.json (lorebook)

A RoleCall Export v1.0 as `serializeToRoleCallV1` emits one. Grounded in:
- `C:\Users\chiev\Documents\RoleCall\src\lib\lorebook\serializer.ts`
  (`serializeToRoleCallV1` lines 534-586, `serializeEntryToRoleCallV1` 452-525).
- `C:\Users\chiev\Documents\RoleCall\src\lib\lorebook\schemas.ts`
  (`RoleCallExportV1` / `RoleCallLorebookV1` / `RoleCallEntryV1` / tree, lines
  28-299).
- Faithful to what the real serializer PRODUCES:
  - `settings` emits only lorebookType/globalCaseSensitive/globalMatchWholeWords/
    globalScanDepth/globalRecursion/tokenBudget. `budgetMode`/`entryBudget` are
    OPTIONAL in the schema and are NOT written by `serializeToRoleCallV1`
    (serializer.ts:548-555), so this sample omits them (the vaud fixture wrongly
    includes them).
  - Entries carry NO `sideEffects` and NO `metadata` key: `RoleCallEntryV1` has no
    such fields and the serializer never writes them (the vaud lorebook fixture
    invents both). Omitted here.
  - `unsupportedFields` carries the ST-origin bag RC preserves for round-trip
    (vectorized, groupOverride, useGroupScoring, automationId,
    matchCharacterDepthPrompt, matchCreatorNotes, generationTriggers, outletName)
    per schemas.ts:288-298 and serializer.ts:521-523.
  - `tree` + `categories` embedded per serializer.ts:566-578.

## Why these differ from the in-repo vaud fixtures

The vaud test fixtures (`src/formats/rolecall/*.test.ts`) use an unrealistic
sprite `type:"emotion"` (real RC emits `type:"expression"`) and add lorebook
`settings.budgetMode`/`entryBudget` + entry `sideEffects`/`metadata` that RC's
serializer never produces. These samples use the real wire shapes so the
de-escrow audit tests against what RoleCall actually emits.
