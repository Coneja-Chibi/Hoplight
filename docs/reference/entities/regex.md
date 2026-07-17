# Entity: regex set

The canonical find/replace-script entity. Source of truth for the types:
`src/entities/regex/schema.ts`. A `CanonicalRegexSet` is `CanonicalEntity<"regex", RegexSetBody>`,
stored under `studio/regex/<id>.json` (same hub-spoke shape as lorebook/persona/pack).

**Studio authoring (SHIPPED - the R3 editor):** [REGEX-JEWEL-PLAN.md](../../REGEX-JEWEL-PLAN.md), cross-format
survey [design/REGEX-FORMATS.md](../../../design/REGEX-FORMATS.md), wireframes
`vs-regex-editor.html` (private design files) + `vs-regex-tryit.html` + `vs-regex-shelf-gallery.html`.
Editor concept: [concepts/regex-editor.md](../concepts/regex-editor.md); engine concept:
[concepts/regex-engine.md](../concepts/regex-engine.md).

A regex **set** is a named, ordered collection of **rules**. One rule maps 1:1 to a SillyTavern script
row, a Risu customscript row, a RoleCall rule, a Lumiverse script, or a Marinara script; one set maps
to an ST standalone file or card bundle, an RC script, a Lumi folder/pack slice, a Risu card/module
list, or a Marinara collection.

**Safety:** a rule is DATA. Applying one is a budgeted `String.replace`, never `eval` (see the engine
concept). Anything smelling of script execution (Risu trigger scripts, Lumi spindle) is out of scope
and rides escrow as sealed cargo.

## RegexSetBody

Set-level settings.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `string` | The set's name. |
| `description` | `string?` | Free-text description. |
| `enabled` | `boolean?` | Set-level on/off (the Library shelf switch). Absent = on; always read as `enabled !== false`. An off set is skipped on export, the way an off lorebook is. |
| `rules` | `RegexRule[]` | The rules (below), applied in `sortOrder`. |

## RegexRule

One find/replace rule. `find` and `flags` are stored **separately** (the Risu/RC/Lumi encoding); the
SillyTavern codec folds/unfolds its single `/pattern/flags` wire string on import/export.

### Identity and content

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Stable rule id, preserved across round-trips. |
| `label` | `string` | Display name for the rule. |
| `note` | `string?` | Internal creator note, distinct from the label (Lumiverse `description`). |
| `find` | `string` | The bare pattern, **no delimiters**. |
| `flags` | `string` | Verbatim flags string; default `"g"`. May carry non-JS extension tokens (Risu `"gu<cbs>"` observed live) - stored as-is, stripped only at compile time inside the engine, never here. |
| `useFlags` | `boolean?` | Risu `ableFlag`: whether the custom flags string applies. |
| `replace` | `string` | Verbatim replacement; may carry `$1` / `{{match}}` / CBS / HTML. Renders only through `SealedHtmlPreview`, never `innerHTML`. |
| `trimStrings` | `string[]?` | ST/RC/Lumi: fragments stripped from the match before the replace. |
| `enabled` | `boolean` | Whether the rule is active. |
| `sortOrder` | `number` | Application order within the set. |

### Placement

| Field | Type | Meaning |
| --- | --- | --- |
| `phases` | `RegexPhase[]` | Pipeline phases the rule runs at. Open union: `input`, `output`, `request`, `display`, `prompt`, `lorebook`, `reasoning`, `slash`, `memory`, or a platform-specific string. Per-platform legality lives in `core/regex/platform-fields.ts` (`phasesForProfile`), never a UI literal (the position-picker law). |
| `targets` | `RegexTargetChannel[]?` | Lumiverse's orthogonal placement x target axis (`prompt` / `response` / `display`); absent = platform default. |
| `substituteFind` | `RegexSubstitution?` | Find-side macro substitution mode: `none` / `raw` / `escaped` (ST/RC) plus `after` (Lumi). Absent = `none`. |
| `minDepth` / `maxDepth` | `number \| null?` | ST/RC/Lumi/Marinara message-depth window (0 = most recent). |
| `runOnEdit` | `boolean?` | ST/RC/Lumi: re-apply when a message is edited. |
| `characterIds` | `string[]?` | Marinara `targetCharacterIds`: limit to specific recipient characters; empty/absent = all. |

### Vaud-engine-only controls

These three have no wire home on any platform. Travel-lint marks them under every platform lens;
export keeps the data canonical-side and emits nothing for them.

| Field | Type | Meaning |
| --- | --- | --- |
| `firstMatchOnly` | `boolean?` | Replace only the first match even under a global flag. |
| `condition` | `RegexRuleCondition?` | `{ ruleId, matched }`: run this rule only when the named rule DID (`matched: true`) or DID NOT (`matched: false`) apply earlier in the same pass. One pass, `sortOrder` order; a condition naming a rule that has not run yet (or does not exist) skips with an honest trace reason - it never forward-resolves. |
| `overlay` | `boolean?` | Display-channel rule that returns match spans + replacement as an OVERLAY instead of mutating text (ST names this "Overlay strategy" and implements it nowhere). |

## Fields that ride escrow, not a canonical slot

| Field | Type | Why escrow |
| --- | --- | --- |
| `extras` | `Record<string, unknown>?` | Per-platform leftovers with no first-class home (Lumi telemetry / scope / `script_id`, ST `id` / `uuid`, ...). Sealed, round-trips untouched - the lossless-escrow doctrine. |

## The character-card twin

`CharacterRegexScript` (same file) is the narrow, card-embedded Risu `customScripts` shape (singular
`phase`, no `id` / `enabled` / `sortOrder`). `entities/character/schema.ts` re-exports it as its
`RegexScript` so there is ONE definition, not two. It is intentionally not `RegexRule` itself: a full
alias would change `CharacterBehavior.regexScripts`'s wire contract and break the risu codec's
round-trip. It stays the small card twin until a real migration replaces `customScripts` with
regex-entity references.
