# Platform native fields (verified research)

Source of truth for building each platform's native-field schema (platforms/<key>.ts). Fields verified
against each platform's REAL format (their own source/types/API), 2026-07-07, via the
platform-format-research workflow. Confidence + open questions are honest per platform. A native field
is a dot path into `entity.original` + a control. Rule buckets: authored-editor (build a control),
executable-opaque (flagged read-only, never run), db-social-readonly (read-only), link-out (lorebook/
regex/external), canonical-skip (already a canonical card - do NOT re-declare).

## Storage reality (how each reaches entity.original)

- Marinara, Lumiverse, Chub RIDE a SillyTavern/CCv2 card -> their data is under
  `original.sillytavern.raw.data.extensions[.chub]`. Buildable + verifiable now.
- Character.AI, Janitor, Pygmalion, Crushon are their OWN flat formats with NO vaud import/export
  adapter yet. Native editing would store under `original.<platform>.raw.*` (a per-platform bag) that
  only round-trips once an adapter lands. UI works; round-trip pending adapter. Flag this.

## Marinara (HIGH - verified from Marinara-Engine source types)

Root: `sillytavern.raw.data.extensions` (NOT `.marinara` - that sub-key was fabricated). Its own editor
has an RPG Stats tab (enable + attributes + hp + colored pool bars), long-text backstory/appearance,
and color pickers for name/dialogue/box.
- rpgStats {enabled, attributes[{name,value}], hp{value,max}, pools?[{name,value,max,color}]} -> rpg-stats
- backstory (string) -> textarea
- appearance (string) -> textarea
- nameColor / dialogueColor / boxColor (hex string) -> color (SwatchRow)
- conversationStatus ("online"|"idle"|"dnd"|"offline") -> read-only (runtime presence)
- SKIP (canonical/ST-owned): talkativeness, depth_prompt, fav, world. No own catch-all (ST's covers the bag).
- NOT the card: personaStats (Persona entity), gamePrompt/quests/dynamicState (runtime game state).

## Chub (HIGH - verified vs live Chub API definition.extensions.chub)

Root: `sillytavern.raw.data.extensions.chub`.
- id (number), full_path (string) -> read-only
- custom_css (string CSS) -> executable-opaque read-only (Chub injects it; never an editor)
- background_image (URL) -> url
- expressions, alt_expressions (asset sets; populated shape UNVERIFIED - null in ~50 sampled cards) -> asset-manager, tolerant
- related_lorebooks [{id,path,version,commit_ref}] -> lorebook-link
- preset (null|ref), extensions (Chub Stages refs) -> read-only link-out
- NOTE: `vectorized` is a lorebook-ENTRY field, not a chub-block field. depth_prompt is shared ST, not chub.

## Lumiverse (MEDIUM - app source; single-char expressions KEY unverified)

Root: `sillytavern.raw.data.extensions` (bare keys, no .lumiverse namespace).
- expressions {enabled, defaultExpression, mappings: label->image_id} -> asset-manager + toggle + text (KEY unverified: expressions vs expression_config)
- expression_groups: Record<charName, Record<label,image_id>> -> ListEditor of asset-managers
- alternate_fields: {description|personality|scenario -> [{id,label,content}]} -> per-field ListEditor of {label,content}
- alternate_avatars: [{id,image_id,label}] -> asset-manager
- world_book_ids (also top-level data.world_book_ids), databank_ids -> lorebook-link / read-only
- catch-all for the rest (character_loras etc.), flag script-like opaque.

## Character.AI (MEDIUM - API object, no file format; root = the `character` object)

- name, title(3-50), greeting(3-2048), description(<=500), definition(<=32000) -> text/textarea (all NL+macros, not code)
- starter_prompts (keyed object, up to 3 x <=200 chars; per-entry shape UNVERIFIED) -> NEW starter-prompts-list (bounded ListEditor)
- img_gen_enabled, copyable, comments_enabled -> toggle
- avatar_file_name (bare filename, CDN base prepended) -> asset-manager
- visibility (PUBLIC|UNLISTED|PRIVATE) -> read-only (doctrine deviation from their dropdown)
- songs[], voice_id, default_voice_id -> read-only link-out (ids into c.ai catalogs)
- base_img_prompt -> text; img_prompt_regex, strip_img_prompt_from_msg -> executable-opaque read-only
- external_id, identifier -> read-only

## Janitor (MEDIUM - flat snake_case root, verbatim scraper source; some keys inferred)

Root: flat card root (no data/extensions wrapper).
- name, chat_name -> text
- description (HTML, the public bio), personality (required, the definition body), scenario, first_message -> textarea
- first_messages (string[] alt greetings) -> ListEditor of textarea
- example_dialogs (single string) -> textarea
- allow_proxy (bool, authored pref) -> toggle
- showdefinition, is_public(UNVERIFIED key), is_nsfw(UNVERIFIED key) -> read-only (visibility/rating)
- custom_tags (string[]) -> ListEditor of text; tags [{id,name}] catalog -> read-only
- id(uuid), creator_name -> read-only
- Advanced Scripts (ES5 JS) -> executable-opaque read-only; PATH UNVERIFIED (likely a SEPARATE '</> Scripts' entity, not in the card). Do not invent a path.

## Pygmalion (HIGH - avakson/aichared editor source; flat text-only)

Root: flat document root (bare keys, e.g. `char_name`).
- char_name -> text
- char_persona, world_scenario, char_greeting, example_dialogue -> textarea (5 prose fields, that's the whole editor)
- metadata {version,created,modified,source,tool{...}} (tool-stamped) -> read-only, or preserve via catch-all
- NO `pygmalion_id` (that lead was WRONG - it's a vaud-internal label, never a card field). No scripts/lorebook/assets/social.

## Crushon (LOW - no native export format found; DO NOT guess paths)

CrushOn imports Tavern cards and re-exports Tavern V1 flat JSON via 3rd-party tools; its native metadata
(gender/age/visibility/rating/tags) is DB-side and likely dropped on export - NO verified JSON path for any
of it. Build MINIMAL: the standard Tavern fields are canonical; add a safe catch-all only. To do it right,
capture ONE real crushon export or the create-form POST payload first. Do not fabricate gender/visibility paths.

## New components this research calls for

- color (native control) -> reuse SwatchRow (compact hex). [Marinara]
- starter-prompts-list (bounded ListEditor, <=3 short entries over a keyed object). [Character.AI]
- SealedContent (flagged read-only for executable payloads: Chub custom_css, Janitor JS, CAI img regex).
- expression-map (label -> sprite) - likely just asset-manager; confirm it handles a label->image map. [Lumiverse/Chub]
