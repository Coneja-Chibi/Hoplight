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
- **Default CCv3** is the portable interop shape for thin hosts (C.AI Tools dumps, Crushon drop-import,
  Janitor PNG, etc.): read/write via `formats/sillytavern` only. No fake `extensions.<host>` bag.
  Editor strip: **one** `default-ccv3` / label **Default** tab (not three host names). See
  `formats/_shared/extension-platforms.ts`.
- Character.AI **DROPPED** as a native platform (Chi 2026-07-09): no official export; definition usually
  withheld. Crushon **SKIPPED**: import sink only. Janitor: optional thin later; prefer ST/Default CCv3.
  None of those get their own lens tab.
- Pygmalion has its own flat adapter (`formats/pygmalion/`).

## Marinara (HIGH - re-audited 2026-07-09 vs Marinara-Engine clone)

Root: `sillytavern.raw.data.extensions` (NOT `.marinara` - that sub-key was fabricated). Source:
`packages/shared/src/types/character.ts` `CharacterExtensions` + `CharacterEditor.tsx`.

**On the exportable CCv2 card (`data.extensions`):**
- rpgStats {enabled, attributes[{name,value}], hp{value,max}} -> rpg-stats
  - Character Stats tab (`CharacterEditor` StatsTab): enable + HP max + named attributes only.
  - **No `pools[]` on character `rpgStats`.** `RPGStatsConfig` in `character.ts` is only
    enabled/attributes/hp. Prompt inject (`formatRPGStats`) only prints HP + attributes.
- backstory / appearance (string) -> textarea
- nameColor / dialogueColor / boxColor (CSS color **or gradient string**) -> color (SwatchRow; gradient
  may need free text beyond hex)
- avatarCrop -> on card, **not yet in platforms/marinara.ts** (ST catch-all holds it)
- trackerCardColors -> on card, **not yet in platforms/marinara.ts**
- conversationStatus -> runtime / chat-scoped override preferred in newer types; read-only if present
- fav, talkativeness, depth_prompt, world -> ST-owned (do not re-declare)

**Colored resource bars ARE real in Marinara - different entity/key (do not call them character pools):**
- **Persona** `personaStats` (`PersonaStatsConfig` / editor JSON): `{ enabled, bars[{name,value,max,color}],
  rpgStats? }`. UI: Persona editor "Persona Status Bars" (defaults Satiety/Energy/Hygiene/Mood).
  Key is **`bars`**, not `pools`. Persona content type, not character card extensions.
- **Runtime tracker / game state** also uses `CharacterStat` `{name,value,max,color}` on chat/game
  (player stats, featured character tracker). Session state, not the exportable character card.
- Earlier research mashed those bars into `rpgStats.pools[]` on the character. Concept real; **path and
  key wrong**. Our `RpgStats` UI's "Resource pools" section matches persona **bars** shape, not character
  `rpgStats`.

**Host-local / not V2 character extensions:** comment, avatarPath, spriteFolderPath; Sprites tab =
filesystem; CharacterRegex = separate regex entity; personaStats = Persona entity; quests/dynamicState =
runtime.

- No own catch-all: ST catch-all covers leftover keys in the shared bag.

## Chub (HIGH - verified vs live Chub API; re-audit 2026-07-09 for jewel)

Root: `sillytavern.raw.data.extensions.chub` (**namespaced**; not bare extensions).
Wireframe: `design/vs-native-chub.html` · Plan: `docs/CHUB-JEWEL-PLAN.md`.

- id (number), full_path (string) -> read-only hub identity
- custom_css (string CSS) -> CssWorkshop (editable plain CSS; sealed preview only; NEVER apply in Vaude chrome)
- background_image (URL) -> url (editable)
- expressions, alt_expressions -> **sprites milestone stub** (not asset-manager; twin kept). Often empty on download.
- related_lorebooks [{id,path,version,commit_ref}] -> read-only / lore link-out later (refs only, no book bytes)
- preset (null|ref), extensions (Chub Stages refs) -> read-only (never run Stages)
- ST core (name, description, greetings, character book, depth_prompt, …) -> body / ST native
- NOTE: `vectorized` is a lorebook-ENTRY field, not a chub-block field.


## Lumiverse (MEDIUM - app source; expressions KEY still unverified; LoRA verified 2026-07-09 vs clone)

Root: `sillytavern.raw.data.extensions` (bare keys, no `.lumiverse` namespace). Source of truth for
card-forge fields: local clone `Documents/Lumiverse` (service + CharacterEditorPage tabs).

- expressions {enabled, defaultExpression, mappings: label->image_id} -> asset-manager + toggle + text (KEY unverified: expressions vs expression_config)
- expression_groups: Record<charName, Record<label,image_id>> -> ListEditor of asset-managers
- alternate_fields: {description|personality|scenario -> [{id,label,content}]} -> per-field ListEditor of {label,content}
- alternate_avatars: [{id,image_id,label}] -> asset-manager
- world_book_ids (also top-level data.world_book_ids), databank_ids -> lorebook-link / read-only

### Character LoRA (FIRST-CLASS - was wrongly buried as catch-all)

Lumiverse lets you attach an image-gen LoRA to a character (Character editor **LoRA tab** /
`CharacterLoraTab.tsx`). Dual storage (both real; only one rides the exportable card):

| Layer | Where | Shape | Vaude forge role |
| --- | --- | --- | --- |
| **Runtime binding** (per-user) | App settings key `characterLora:<characterId>` via `/characters/:id/image-gen-lora` | `CharacterLoraBinding`: `{ lora_name, weight_model, weight_clip, base_tags?, source_url?, bound_at }` | **NOT on the card.** Host-local; different users can bind different files for the same char. Do not invent a path under `original` for this alone. |
| **Portable card mirror** | `character.extensions.lumiverse_image_gen_lora` (constant `PORTABLE_LORA_EXTENSION_KEY` in `src/services/character-lora.service.ts`) | `PortableLoraReference` v1: `{ version: 1, lora_filename, weight, base_tags?, source_url? }` | **ON the card.** Written when binding is set; cleared when unbound. Importers surface "this character expects X @ W" - **never auto-fetch `source_url`** (safetensors phishing risk; Lumiverse itself never fetches it). |

Card path for ST-shaped import: `original.sillytavern.raw.data.extensions.lumiverse_image_gen_lora`
(same bare-extensions bag as other Lumiverse keys).

- **Control (portable half):** structured form, not catch-all - filename text, weight slider/number,
  base_tags textarea, source_url text (display-only warning). Optional "SealedContent"-style note that
  we never download LoRA bytes from URL.
- **NOT** the key `character_loras` (that name was a research guess and is wrong).
- Runtime `weight_clip` is **not** mirrored into the portable object (portable only has one `weight`,
  filled from `weight_model`). Honesty if we ever edit portable alone.
- ComfyUI/SwarmUI pipeline uses the **runtime** binding to patch LoraLoader / loraweights; that is
  host app behavior, not a Vaude card field.

- catch-all for remaining unknown extension keys (e.g. character_loras if some old dump used a different
  key - do not treat as the canonical LoRA path). Flag script-like opaque.

## Character.AI — DROPPED (Chi 2026-07-09)

No official card export. Community scrapers expose a flat API object; **`definition` is usually
withheld** unless the creator set copyable. Building `platforms/characterai.ts` or
`formats/characterai/` would pretend at a surface C.AI does not give users.

**Interop:** if the user already has a Tavern/CCv2/CCv3 file (CAI Tools, converters), open it as
**Default CCv3** via SillyTavern. Honesty: shallow imports when definition was locked are C.AI's gate,
not ours. Do not invent `original.characterai` or starter-prompts native jewel.

Archaeology (fields that exist on scrapers, not build targets): name, title, greeting, description,
definition (if copyable), categories, avatar_file_name, visibility, copyable, starter_prompts,
img_gen_*, songs/voices, external_id.

## Crushon — SKIPPED (Chi 2026-07-09)

Import sink: Create page drops PNG/JSON and fills a short form. **No verified first-party export.**
Gender/visibility/rating are site DB, not a portable bag. Do not fabricate paths.

**Interop:** emit **Default CCv3** (or flat V1 subset) from ST path so Crushon can ingest. Rich
CCv3 features (book, alts, extensions) are **lossy** on that host — export honesty, not a native schema.

## Janitor (MEDIUM — thin optional; not a bag jewel)

Root: flat snake_case scrape root when someone has a JSON dump; many users only have ST PNG.

- Prefer Default CCv3 / ST PNG (already covered).
- If a scrape adapter ever lands: name, personality, scenario, first_message, first_messages[],
  example_dialogs, allow_proxy (toggle), custom_tags; RO: id, creator, catalog tags, visibility flags.
- Advanced Scripts (ES5): sealed never-run; path often a **separate** entity — do not invent.
- Profile CSS ≠ character bag (CssWorkshop `janitor-profile` pack for profile work).

## Pygmalion (HIGH - classic flat; **adapter landed** `formats/pygmalion/`)

Root: flat document root (bare keys, e.g. `char_name`). Adapter + coverage + sample exist
(`samples/pygmalion/classic.native.json`). Do NOT claim "no import adapter."
- char_name -> text
- char_persona, world_scenario, char_greeting, example_dialogue -> textarea (5 prose fields, that's the whole classic editor)
- metadata {version,created,modified,source,tool{...}} (tool-stamped) -> original only
- PNG carrier: flat JSON in `chara` chunk supported via shared card-io
- NO `pygmalion_id` (that lead was WRONG - vaud-internal label). No scripts/lorebook/assets/social on classic wire.
- ooba multi-alias / YAML cousins are **other format rows**, not this adapter.

## Default CCv3 (interop shape)

Portable card for thin hosts and "I have a PNG from somewhere":

```
spec: "chara_card_v3"
spec_version: "3.0"
data: {
  name, description, personality, scenario, first_mes, mes_example,
  creator_notes, system_prompt, post_history_instructions,
  tags, alternate_greetings, character_book?, extensions: {}
}
```

Read/write: `src/formats/sillytavern`. Empty `extensions` is fine. Do not invent host namespaces
under `extensions` for dropped/skipped platforms.

## New components this research calls for

- color (native control) -> reuse SwatchRow (compact hex). [Marinara]
- CssWorkshop (assisted CSS; Chub cards + optional Janitor profile). **No** starter-prompts-list for C.AI (dropped).
- SealedContent only if a verified Janitor script path ever lands — never invent.
- expression-map / groups: sprites milestone (Lumiverse/Chub stubs until then).
