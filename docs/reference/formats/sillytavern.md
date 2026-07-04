# Format: SillyTavern

SillyTavern is the de-facto standard ecosystem for local AI roleplay. It reads Character Card V1/V2/V3
and standalone world info books. vaud treats it as two codecs in one folder: a **character** adapter and
a **lorebook** (world info) adapter.

- Character: `id: "sillytavern"`, kind `character`, container PNG or JSON, writes `.json`.
- World info: `id: "sillytavern-lorebook"`, kind `lorebook`, container JSON, writes `.json`.
- Source: `src/formats/sillytavern/index.ts` (character) and `src/formats/sillytavern/lorebook.ts`
  (world info). Shared Tavern field mapping lives in `src/formats/_shared/tavern-fields.ts`.

## Character card

### Detection

`detect()` returns `0.9` for a recognizable card, `0` otherwise. `0.9`, not `1.0`, because SillyTavern
is the **generic** Tavern reader: more specific adapters (RoleCall) claim `1.0` on the same CCv3 card and
win, so they can map their own extension block. Recognition:

- **PNG**: the card is embedded in a `chara`/`ccv3` text chunk; a PNG with such a chunk scores `0.9`.
- **JSON**: `spec: "chara_card_v3"` with a `data` object (V3), `spec: "chara_card_v2"` with `data` (V2),
  or a flat object with no `spec`/`data` but a `name` **and a real character signal** (`description`,
  `personality`, `scenario`, `first_mes`, or `mes_example`) for V1/flat.
- The character-signal requirement is the cross-kind firewall: it stops a world info book (also
  `{ name, ... }` json) from being mistaken for a flat V1 character.

### Field map

The standard CCv2/V3 `data` fields map through `_shared/tavern-fields.ts`. Highlights:

| Canonical | Tavern wire |
| --- | --- |
| `identity.name` | `data.name` |
| `identity.description` | `data.description` |
| `persona.personality` | `data.personality` |
| `persona.scenario` | `data.scenario` |
| `prompts.systemPrompt` | `data.system_prompt` |
| `prompts.postHistoryInstructions` | `data.post_history_instructions` |
| `greetings.firstMessage` | `data.first_mes` |
| `greetings.alternateGreetings` | `data.alternate_greetings` |
| `examples.exampleMessages` | `data.mes_example` |
| `attribution.creator` | `data.creator` |
| `attribution.creatorNotes` | `data.creator_notes` |
| `discovery.tags` | `data.tags` |
| `prompts.depthInjections` (origin `depth_prompt`) | `data.extensions.depth_prompt` `{prompt,depth,role}` |
| `settings.talkativeness` | `data.extensions.talkativeness` (string or number -> number) |
| `worldName` | `data.extensions.world` (linked worldbook name) |
| `knowledgeRefs` (embedded book) | `data.character_book` (see [character-book](../concepts/character-book.md)) |

These last three are **authored** fields ST keeps in `extensions` only because CCv2/v3 is rigid. They are
first-classed as editable canonical slots, not escrow. `depth_prompt` with an empty `prompt` is ST's
default-when-unset and maps to **no** injection (the depth/role config stays on the escrow twin). `role`
is carried only when the card authored one; its absence means ST's default (`system`), applied at read
time, so an unauthored role is never fabricated back on export.

### Escrow and round-trip

The whole original card (all of `data`, its `extensions` block, the V1/V2/V3 variant) rides in
`escrow.sillytavern.raw`. A SillyTavern -> canonical -> SillyTavern round-trip is byte-lossless: export
overlays the canonical body onto a clone of the raw card and preserves the original variant wrapper. A
V1 flat card stays flat on the way out; a V3 card stays V3.

## World info (lorebook)

### Detection

`detect()` returns `0.9` when the input is a worldbook: a top-level `entries` **object** (keyed by
string index, not an array) whose first value looks like an entry (`key` / `keysecondary` / `comment` /
`content`). Returns `0` otherwise.

### Field map and int enums

ST world info encodes several canonical enums as integers. The decoders live in
`src/formats/_shared/lore-enums.ts` (shared with the embedded `character_book` dialect):

| Canonical enum | ST integer coding |
| --- | --- |
| `selectiveLogic` | `0` and_any, `1` not_all, `2` not_any, `3` and_all |
| `role` | `0` system, `1` user, `2` assistant |
| `position` | `0` world (before-char), `1` character (after-char), `2` before_example, `3` after_example, `4` depth |

Entry field highlights:

| Canonical | ST wire |
| --- | --- |
| `title` | `comment` |
| `content` | `content` |
| `enabled` | `!disable` (ST canonicalizes on a `disable` flag) |
| `triggers` | `key` (regex as `/pattern/flags`) |
| `secondaryTriggers` | `keysecondary` |
| `sortOrder` | `order` (ST's insertion/placement order) |
| `priority` | (no ST field: ST has no eviction axis, so `priority` defaults to `100`) |
| `groupName` | `group` (empty string -> `null`) |
| `scanCharacterDescription` etc. | `matchCharacterDescription` etc. |

### Lossy positions and escrow

ST has fewer injection slots than canonical, so the richer positions collapse on export:
`append`/`append_bottom` -> depth (`4`), `prepend_top` -> `0`, `scene` -> before_example (`2`). ST also
drops per-trigger probability (it has no advanced trigger mode). That loss is inherent to ST and is what
escrow-of-raw guards: an **unedited** entry re-projects from its raw twin, so a vaud ST -> ST round-trip
is still byte-lossless. Only edited fields re-encode and take the collapse.

Raw-only carriers that survive via escrow: entry `uid`, `vectorized`, `automationId`, ST's two extra
scan sources (`matchCharacterDepthPrompt`, `matchCreatorNotes`), and `displayIndex` (ST's cosmetic
editor display order) - none of which have a canonical slot. `displayIndex` is a distinct axis from the
placement order (`order`); since only ST carries it, it rides the raw twin rather than a canonical field.
On a cross-format import into ST (no twin) `displayIndex` defaults to `sortOrder` so the editor list
mirrors insertion order.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter | `src/formats/sillytavern/index.ts` |
| World info codec | `src/formats/sillytavern/lorebook.ts` |
| Shared Tavern field map | `src/formats/_shared/tavern-fields.ts` |
| Shared lore int-enum decoders | `src/formats/_shared/lore-enums.ts` |
| Interop reference | VAUDEVILLE `packages/lorebook` (facts only) |
