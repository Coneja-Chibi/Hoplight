# Format: Backyard / Faraday

Backyard.ai (formerly Faraday) is a desktop AI roleplay app. This adapter reads its **legacy flat-JSON
character** shape: a single object with `aiName` / `aiPersona` / `customDialogue` style keys, no Tavern
`spec`/`data` wrapper. It is not a Tavern superset, and it is not the newer `.byaf` archive (a larger
multi-file format, deferred to its own adapter per the source note).

- `id: "backyard"`, kind `character`, container JSON, writes `.json`.
- Label: `Backyard.ai / Faraday character (legacy json)`.
- Source: `src/formats/backyard/index.ts`. Canonical field names: [../entities/character.md](../entities/character.md).

## Detection

`detect()` reads only `input.text`. It returns `0` immediately if there is no text, if the text is not
valid JSON, or if the parsed value is not a JSON object. Otherwise it scores in two tiers:

- **`0.9` (strong)**: any of `aiName`, `aiPersona`, `aiDisplayName`, `customDialogue` is present **as a
  string**. These keys are Backyard-unique, so a match is a confident identification.
- **`0.55` (weak, bare-persona heuristic)**: `persona` is a string **and** `description` is `undefined`
  **and** `kind` is not `"character"`. This is a loose fallback for a stripped card that carries only a
  `persona` field. The two extra guards are a firewall: the `description === undefined` check avoids
  colliding with other flat cards that pair `persona` with `description`, and `kind !== "character"`
  keeps it from firing on an Agnai card (which sets `kind: "character"`).
- Otherwise `0`.

Both scores sit below the `1.0` adapters (RoleCall, Risu, Agnai) and the generic `0.9` Tavern reader on a
shared input, so a more specific format still wins. `0.55` clears the `0.5` recognition threshold but only
just, by design.

## Field map

Backyard uses several alias keys per concept. Reads take the **first non-empty string** among a key list
(`firstStr`). Text fields are run through placeholder conversion on the way in (see Escrow); attribution
and tags are not.

| Canonical | Backyard wire (first non-empty wins) | Converted |
| --- | --- | --- |
| `identity.name` | `aiDisplayName`, `aiName`, `displayName`, `name` (default `""`) | no |
| `identity.nickname` | `aiName` when it differs from the resolved name (the {{char}} shorthand) | no |
| `identity.description` | `aiPersona`, `description`, `persona` | yes |
| `identity.characterVersion` | `version` (left unset if absent; no synthesized default on parse) | no |
| `persona.personality` | `personality` | yes |
| `persona.scenario` | `scenario` | yes |
| `prompts.systemPrompt` | `systemPrompt`, `system_prompt` | yes |
| `greetings.firstMessage` | `firstMessage`, `greeting`, `first_mes` | yes |
| `examples.exampleMessages` | `customDialogue`, `examples`, `mes_example` | yes |
| `attribution.creator` | `creator` | no |
| `discovery.tags` | `tags` (array; non-string entries dropped) | no |

Everything else in `CharacterBody` (taglines, prompts other than system, alternate greetings, media,
presentation, lorebook/behavior refs) is left unset by this adapter and, if the source card carried
anything under other keys, survives only through escrow.

The two Backyard names are DISTINCT authored fields and are modeled that way: `aiDisplayName` is the
display name (`identity.name`), `aiName` is the `{{char}}` shorthand (`identity.nickname`, carried only
when it differs). On export `aiDisplayName = name` and `aiName = nickname ?? name`. (An earlier version
of this adapter folded both into `identity.name` and stamped the name onto both keys on export,
destroying a distinct authored `aiName` - fixed, with a regression test.)

## Escrow and round-trip

The whole raw parsed object rides in `escrow.backyard.raw`. That escrow is what makes round-trips safe,
because the placeholder conversion below is **not** a bijection.

Backyard writes placeholders in single braces (`{character}` / `{user}`, and a bare `{char}`). The
canonical model uses Tavern double braces, so on read every text field is rewritten: `{character}` and
`{char}` become `{{char}}`, `{user}` becomes `{{user}}`. The `{char}` fallback uses lookarounds so it
matches a genuine single brace and never the inner `{char}` of an already-converted `{{char}}` (the
reference importer corrupts that to `{{{char}}}`; this adapter deliberately does not). The inverse
(double back to single) only handles `{{char}}` / `{{user}}` and drops any other Tavern token, so it is
lossy.

On export (`fromCanonical`) the adapter clones the escrowed raw card (or starts from `{}` if there is no
escrow) and overlays the canonical body. Per text field, `fieldOut` decides:

- If the field is **unedited** since parse (converting the raw string forward equals the current
  canonical value), it re-emits the **raw bytes verbatim**, so the non-bijective conversion cannot
  corrupt an untouched card.
- If the field was **edited**, it writes a fresh single-brace conversion of the canonical value, which
  takes the lossy inverse.

So an unedited Backyard card survives a Backyard -> canonical -> Backyard round-trip with its text values
intact; only fields you actually changed re-encode and risk placeholder loss.

## Quirks

These are export normalizations, not value-preserving passthroughs. A round-trip is value-safe for the
mapped text fields but is **not** guaranteed byte-identical, because export always:

- Writes both name keys (`aiDisplayName` from the name, `aiName` from the nickname falling back to the
  name), so a card that carried only one of the two gains the other on export. Distinct values are
  preserved, never collapsed.
- Writes `version` only when `identity.characterVersion` is set; a from-scratch cross-format card (no
  escrow twin) gets a `"1.0"` floor so it emits valid, but a twin card without `version` never gains one.
- Re-serializes with two-space JSON formatting, so original whitespace is not preserved.

`creator` and `tags` are copied straight through without placeholder conversion in either direction.
`tags` is only written on export when the canonical value is present.

## Source of truth

| Concern | File |
| --- | --- |
| Adapter (detect / toCanonical / fromCanonical) | `src/formats/backyard/index.ts` |
| Canonical character schema | `src/entities/character/schema.ts` |
| Field meanings + which formats produce them | [../entities/character.md](../entities/character.md) |
| Format catalog + detection scores | [README.md](README.md) |
