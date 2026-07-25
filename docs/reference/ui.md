# The visual app (hoplight ui)

`hoplight ui [port] [studioDir]` boots the local studio: a loopback-only Bun server (default
`127.0.0.1:8321`) serving the shell and a JSON API that is a thin skin over the same engine the CLI
uses. One engine, two shells - no format logic exists in the UI layer.

## Kit terminal shell

Kit is Hoplight's conversational terminal shell. Its composer accepts multiline text and up to five
large paste cards. Up and Down recall submitted drafts only at the relevant buffer edge, Ctrl+F opens
transcript search without discarding the current draft, and Escape stops an active turn. A rejected
submission remains in the composer. Typing `/` opens a registry-driven command palette containing
every installed slash command and its summary; typing filters it, Up and Down move selection, Enter
runs the selection, Tab completes it for arguments, Escape closes it, and rows are clickable. A
trailing `@` query opens matching studio pieces; choosing one inserts a stable `@kind:id` marker,
and resolved markers in replies render as compact name-and-kind cards. If a provider stops after
streaming part of a reply, Kit keeps
that partial reply visible before showing the stop or error. The input and connection state form one
fused prompter rail: an open heavy top rule and rose prompt cap lead into the input plate, while a
thin seam joins the quieter provider, model, and ready or working register below. Transcript
scrolling remains available by mouse wheel and navigation keys without painting a second,
application-owned scrollbar beside the terminal's own window chrome.

Settled replies longer than 1,200 characters fold to a one-line cue and reopen by click or Ctrl+O;
live streaming text never folds mid-answer. Fenced unified diffs receive counted add/remove
treatment, horizontal rules share Kit's scene seam, and error rows cap hostile or accidental floods.
Hovering a user, assistant, or error band exposes a copy corner. Copy uses the terminal's OSC52
support, refuses oversized payloads, and reports unsupported or rejected requests in a short status
toast instead of claiming clipboard success.

Successful turns are saved atomically as one JSON file per session under the Hoplight configuration
directory's `sessions/` folder. `/session` opens the saved-session playbill, `/resume [name]` restores
history and visible transcript lines, `/rewind` can truncate or fork at an earlier turn, and
`/export [md|json]` writes a transcript with a session-specific filename. Search, resume, and rewind
lists keep the selected row inside a terminal-height-based visible window.

`/model` opens provider settings. Credential, endpoint, or provider-option edits invalidate any
previous model result before another lookup. Lookup and save failures remain visible and can be
retried; activating or removing a provider refreshes the shell's provider and model state.
`/decks` (also `/inventory`) prints the current canonical deck counts on demand. `/privacy` reports
the session's provider sends and token counts on demand. Wide terminals show the animated NOW
PLAYING theatre marquee without a persistent telemetry strip;
inventory stays out of persistent chrome. Narrow terminals use a purpose-drawn miniature rainbow
`V KIT` lockup but retain the complete greeting and stage cues, wrapping the copy instead of
replacing it with a terse fallback. Extremely short windows can scroll that opening while the
composer and connection commands remain reachable. On roomy terminals, the large `V KIT` lockup
and its welcome script share one centered stage block instead of clinging to the left edge of an
ultrawide canvas. The shell inherits OpenTUI's live canvas instead of copying a
dimension snapshot. Kit also matches the terminal emulator's default background to the stage while
it is open, then restores it on exit, so fractional-cell and profile-padding gutters visually belong
to the same surface.

## Hyper-modularity (the build's spine)
- **Apps are drop-in folders**: `src/ui/apps/<name>/index.ts` default-exports a `HoplightApp`
  (`src/ui/app-contract.ts`): a manifest (tile title, flat-ink SVG mark, accent, order, optional
  `comingSoon` / `catalogOnly` / `appCatalog`) plus `Component(ctx)`. The server discovers them with
  `Bun.Glob` (`_`-prefixed folders skipped) and bundles each for the browser on demand. A normal app
  gains a Dock tile; a `catalogOnly` app stays packaged and opens from the manifest-declared Apps
  catalog. No central list names either kind, identical doctrine to `src/formats/`.
- **Apps never touch the engine or the filesystem**: they receive an `AppContext` whose `api` is the
  only door (inspect/export/studio/formats). The shell owns theme, the Workbench tabs, and the status bar.
- **Tokens are one CSS source**: `src/ui/theme/tokens.css`, transcribed from `design/DECISIONS.md`
  (both themes, the stamp, the seam). Apps consume tokens; hardcoding colors or layout pixels in an
  app is a review rejection (fluid law).
- **Bright accents never carry small text**: every accent has a deep companion for text-bearing
  fills, always worn with `var(--stage-white)` ink (white on the deep tone clears ~7:1; on bright
  rose even black ink measured 4.47:1, under AA). Pairs: `--rose`/`--rose-deep`,
  `--accent`/`--accent-deep` (repainted together by the shell when a custom house accent lands),
  `--deck-*`/`--deck-*-deep`, and per-piece `--a`/`--a-deep` (minted together by
  `accentVars()` in `src/ui/_shared/decks.ts`; the deepening math is `deepAccent()` in
  `src/ui/_shared/color-math.ts`, unit-tested to agree with the tokens). Bright originals keep
  borders, spines, and marks; a fill with a label on it takes the deep twin.

## First-run setup (the wizard)
The locked vs-setup-hybrid flow, one plain question per screen, built on the same drop-in doctrine:
- **Steps are drop-in folders**: `src/ui/setup/steps/<name>/index.ts` default-exports a `SetupStep`
  (`src/ui/setup/step-contract.ts`): a manifest (question, say-line, settings key, single/multi,
  stage note), its options (may be data-driven: the publish step derives platforms from
  `/api/formats`, excluding `native` formats), optional custom option widgets (theme thumbnails,
  color swatches), an optional stage ZONE (theme owns the backwall preview, first-deck the floor,
  publish the apron), optional direct stage effects (accent repaints `--accent`), and `phrase`/
  `recap` fragments for the final summary. The wizard (`src/ui/setup/wizard.ts`) derives progress
  dots, "N of M", defaults, skip-all, the stage, the summary sentence, and the recap chips from the
  sorted step list; nothing central names a step. Pure logic (selection, defaults, sentence
  assembly) lives in `src/ui/setup/wizard-core.ts`, unit-tested.
- **Settings**: `src/studio/settings-shape.ts` (open record, fail-closed per-key parser, known keys
  in `SETTING_KEYS`: theme / firstDeck / publishTargets / houseAccent) + `src/studio/settings.ts`
  (`<studioDir>/settings.json`). The shell boots settings-first: no `setupComplete` -> wizard;
  after OPEN VAUDE the shell applies theme + house accent and lands on the app whose manifest set
  `firstRunLanding` (the Library's two doors); later boots open the lowest-order app. The top-strip
  theme button reveals the next theme outward from the control through the View Transitions API,
  falls back to an immediate switch when unsupported or reduced motion is requested, and persists
  to settings (localStorage is only a pre-paint cache). Individual controls use
  serialized `PATCH` updates so overlapping changes compose instead of replacing stale snapshots.

## The right-click system
One context menu for the whole app (`src/ui/_shared/context-menu.ts`), extended by REGISTRATION:
- a surface marks an element as a TARGET: `ctx.menus.attach(el, () => ({ type, label, data }))`
  (deepest attached element wins; a document-level `shell` target is the always-there fallback)
- a feature contributes items: `ctx.menus.register(type, provider)` (any number of providers per
  type; each provider's items form a section; empty/null = deny by absence). Returns an
  unregister for app cleanup.
- shell-owned providers: `entity` (Send / Show / Open beside / Close the split / Remove on the
  Workbench - the one-shot single path, works in every room), `app` (dock tiles), `shell` (Go home /
  Import files / Switch theme). Adding a menu later (Open in editor, Export, Delete) = one
  register() call; nothing central is edited.

## Apps catalog and documentation
The Dock's **Add app** slot is a real control. It finds the one manifest with `appCatalog: true` and
opens that surface without hardcoding an app id. The catalog derives its cards from `ctx.apps()`, so
it shows the official applications in the running build and cannot drift from the packaged manifest
roster. CSS Workshop is the first `catalogOnly` tool: it remains fully bundled and mountable while
staying off the everyday Dock. Help / Docs is another catalog-only app and renders the committed
`docs/` corpus inside the Studio. Its left navigation and search derive from
`docs/generated/docs-index.json`, then present it as **User Docs** and **Developer Docs** with
human-facing workflow, platform, application/API, architecture, data-model, format, security,
extension, and technical-decision sections. Decision records keep their canonical ADR filenames on
disk while the reader uses plain titles without ADR codes. The center pane renders Markdown through the shared sanitizer and
mounts only generated figures or committed `docs/media/` images; the right rail derives from the
current page's heading anchors. The desktop build bakes the same Markdown and assets that are visible
on GitHub, so there is one source rather than an in-app copy. Each page's **view on GitHub** action
uses the existing leaving gate and `/api/open` URL allowlist.

## Dev live-reload
`hoplight ui` (or `bun run dev`) watches `src/ui/` and pushes a reload over SSE (`/dev/reload`) to
every open page; bundles are built fresh per request, so edits appear on save. The packaged exe
serves baked bundles and 404s the stream (the client goes quiet). Zero dependencies.

## The card-type chip
Summaries carry `sourceFormat` + `sourceVariant` (the first non-hoplight escrow entry). The Library
maps ids to chip labels from the LIVE registry: platform name when the adapter is
platform-specific ("RoleCall · V3"), "Default" when the adapter declares `generic` (the plain
Tavern/CC reader); no source = no chip (made from scratch).

## The studio store
`src/studio/store.ts`: local-first storage where the canonical vaud-json format IS the database -
`<studioDir>/<kind>/<id>.json`, one file per entity, portable and versionable by construction.
Saving never silently overwrites: an occupied id gets a numbered sibling (the import journey's
"Keep both" default enforced at the storage floor).

## The receipt
`src/ui/receipt.ts` renders the plain-words import receipt server-side (both shells say identical
sentences): platform names only, "we read / we kept" voice, lines only when true (embedded book,
scripts-as-data notice, privileged warning), and the warm unknown-file message. It is a rendering of
what the engine already knows - no new format logic.

## Endpoints
`GET /` shell · `GET /tokens.css` · `GET /boot.js` · `GET /api/apps` manifests ·
`GET /apps/<id>.js` bundled app · `GET /api/setup/steps` step ids · `GET /setup/steps/<id>.js`
bundled step · `GET|POST|PATCH /api/settings` (POST replaces the document; PATCH validates and merges a partial update) ·
`GET /api/docs/index|figures` generated docs metadata · `GET /api/docs/get?id=` catalog-declared
Markdown only · `GET /api/docs/asset?path=` committed docs media and generated figure assets only ·
`GET /api/formats` (includes `native`) · `POST /api/inspect` (bytes + x-filename) -> receipt +
canonical entity · `POST /api/export` {entity, targetId} (cross-kind fails closed) ·
`GET /api/coverage` (per-platform canonical-path claims - the editor lens's and the Press's ground
truth) · `GET /api/studio/list|get` · `GET /api/studio/portrait?kind&id` (the entity's art: the
escrowed PNG carrier, else a data-URI `body.media.portrait`; 404 when none) ·
`POST /api/studio/save` · `POST /api/studio/save-bundle` (character + related lorebooks; keep-both
renames rewrite `knowledgeRefs`).

## The Library room (the shelves - deep browse)
Empty studio = the locked first-run doors; populated = the browse room: deck chips with LIVE
per-kind counts, a proscenium stage presenting the active deck through a DROP-IN VIEW, and the
continuous art-size dial. Opens on the setup wizard's `firstDeck`. Import (drop anywhere,
plain-words receipts) lives here. Covers use `/api/studio/portrait` art when carried.
- **Deck views are drop-in modules**: one file in `src/ui/apps/library/views/` default-exporting
  a `DeckView` (`view-contract.ts`: label, icon, css, render(ctx)); `views/registry.ts` is the one
  stated seam (a browser bundle cannot glob), one import line per view. Shipped: `grid` (default,
  fluid auto-fill 2:3 cards), `showcase` (one card at a time: hero art, the card's own
  tagline/description via `peek`, prev/next + thumb rail, stage in place), `list` (dense rows).
  The toolbar derives from the registry; the library names no view. Every view renders two piece
  states from the context: `open` (a quiet "on the workbench" annotation) and `selected` (staged,
  accent ring + corner check).
- **Multi-select is staging** (restored after the IDE rework dropped it): tapping a
  piece toggles it into the room's staging set (persists across deck switches - the distributed tray);
  a Send action bar appears with the live count and commits the whole batch through
  `workbench.sendMany`, which fires the follow dialog ONCE with the real newly-opened count. The
  right-click `entity` menu keeps the one-shot single Send. Open pieces are annotation-only: tapping
  one just notes "already on the Workbench" (no state-dependent navigation - one rule for tap).
- **Art size is a continuous dial** (range slider, `SIZE_RANGE` 4-36rem, fail-closed `clampSize`):
  dragging repaints live via the cascading `--card-w` var; release persists. View + size persist
  per-user through `AppContext.prefs` (`library.view`, `library.size`).

## The Workbench room (home by default - the IDE)
Pieces are SENT from the Library and open as TABS: the shell's tab strip is the tab bar, and this
room shows the active piece's editor pane (today a truthful read-only inspector: real art, real
tagline/description/personality; the writable editor replaces the pane's body next slice).
- Open pieces are shell-owned (`AppContext.workbench`: pieces/active/send/sendMany/remove/isOpen/
  focus/onChange) so tabs persist across app switches; the "on the workbench" marks in every Library
  view read the same state. `send` (single) and `sendMany` (batch) share one follow path so the
  dialog always reports the true count opened.
- Sending honors the FOLLOW setting (`workbench.follow`): "ask" pops the dialog ("N items were
  sent to the Workbench. Follow?" Yes/No + "Never ask me this again"), "always" jumps there,
  "never" stays with a status note. Changeable in Settings.
- `workbench.open` opens a piece AND lands on its editor with no follow prompt - the path every
  create button uses ("New persona" etc.): the click itself already says where the user is going,
  the same reasoning that lets "Open beside" skip the prompt. `send` stays the ask-me path for
  Library send flows.
- The manifest flag `editsPieces` marks the room tabs focus into. The home app on boot is the
  user's `homeApp` setting.
- **The recents rail** (a low deck along the bottom - "wanna bring this one up?") offers recently
  imported/opened pieces as one-click sends. Recency is the honest later-of two signals: a piece's
  `importedAt` stamp (set on every save) and its last-opened time (a per-piece epoch-ms map
  persisted in settings `workbench.recents`, bumped by `workbench.send`/`focus`, capped at 60).
  Currently-open pieces are excluded. Ranking is pure and unit-tested (`workbench/recents-core.ts`);
  the rail reads `workbench.recents()` off the shell store. The rail collapses from its label
  (hide/show, persisted as `workbench.recentsOpen`) so the editor pane can take the room.
- CHARACTERS EDIT (slice 1). Bones transcribed from RoleCall's CharacterEditorBento, skin is house:
  a fixed Identity card (name/tagline/full name/title/age/pronouns) plus reorderable prose cards
  (description, personality, scenario, first message, example messages) whose order persists to
  `presentation.fieldOrder` using RC's ids verbatim (cross-app order interop; unrendered ids keep
  their saved positions). Explicit save only: Save button + Ctrl+S, dirty flag, beforeunload guard;
  saving round-trips the WHOLE body so untouched fields (escrow, behavior, media) survive
  structurally unchanged, pinned by editor-core tests. Fields the editor does not write yet stay visible
  in a read-only tail. One `CharacterEditor` stays mounted (hidden via CSS) per open character, so
  its React state IS the unsaved draft across tab switches; closing the tab unmounts it, which is
  the discard. Pure logic in `workbench/editor-core.ts` (tested), the React component in
  `workbench/Editor.tsx`. Other kinds keep the read-only inspector until their editors land.
- **SPLIT VIEW - anything can sit beside anything.** The shell store carries a second visible key
  (`splitKey`, never equal to `activeKey`); "Open beside" on the `entity` menu pins any piece into
  a second pane next to the active one (opening it first if needed - the explicit gesture skips the
  follow prompt). Focusing the pinned piece SWAPS the panes (both stay visible); closing the primary
  promotes the pinned piece; the pinned tab wears an inset accent bar. The pane-key rules are pure
  and unit-tested (`shell/store-core.ts`: `focusKeys`/`removeKeys`/`besideKeys`). Apps read
  `workbench.beside()/openBeside()/closeSplit()` off the ctx. The capability lives in the shell -
  no editor owns it, every current and future kind inherits it.
- **THE FLUID-LAW CONTAINER SEAM.** The workbench stage and every piece pane declare
  `container-type: inline-size`, and the editor family (Character, Pack, Lorebook, Workshop)
  collapses via `@container` queries against the PANE, never `@media` against the viewport - a
  half-width split, a future drawer, and a phone all compose the same way (design/DECISIONS.md,
  the fluid law). A stage too narrow for two readable panes stacks the split vertically.
- **LOREBOOKS EDIT (the binder, vs-lorebook-binder-2 1:1 - LOCKED).** The
  character editor's sibling: ONE ENTRY OWNS THE SCREEN. `workbench/LorebookEditor.tsx` merges
  one-concept skins (chassis + `lore/entry-page` + `lore/entry-toc` + `lore/entry-rail` + the dial/
  key skins; a class name lives in exactly ONE module). Header: the book's SPINE CHIP (monogram,
  name, entries · ~tokens/budget, a "book rules" link opening an InkDialog with the book form),
  the Writing-for select (presentation only; the book never forks), Save. LEFT: the quiet TOC
  (`entry-toc.tsx`: search across titles+keys, grouped with counts - "Always on" + the rest;
  category folders slot in later - active row wears the accent bar, disabled entries strike
  through, + New entry). CENTER (`entry-page.tsx`): the entry masthead (ENTRY N OF M pager, ~tok,
  On/Off, name in display type, a COMPUTED "Fires on: …" line - never a stored field) and the
  dossier cards: KEYS (primary + "only together with" side by side, AND-any logic select always
  visible, Simple/Advanced tabs in the card head; advanced picks a chip and edits its riders via
  `trigger-editor.tsx`/`trigger-edit.ts`), TIMING & CHANCE directly under Keys (a fold whose
  summary line honestly states what it hides: sticky/cool/delay, recursion segments, group), 
  PLACEMENT (one row of position pills, `position-picker.tsx`), THE PASSAGE (big serif textarea,
  {{user}}/{{char}} inserts, char/~token count), a folded CREATOR NOTE card, and PLATFORM CARDS -
  the character editor's native-fields doctrine applied to lore: ONE FILE PER PLATFORM under
  `lore/platforms/` (sillytavern/rolecall/novelai/risu; registry.ts is the one stated seam;
  platforms with no long tail have no file - deny by absence), each rendering a platform-NAMED
  folded card surfaced only by its Write-for lens (Hoplight shows them all; RoleCall has no lens -
  the Hoplight card covers its wire). The lens select lists each platform separately - SillyTavern,
  Chub, and Lumiverse are three lenses on the codec-grounded ownership matrix
  (`core/lore/platform-fields.ts`), never one smushed tab. RIGHT
  (`entry-rail.tsx`): the fine print - Order & survival label/value rows (order, priority, always
  keep, chance, speaks-as, scan depth, whole-words/case tri-states, move/copy/delete), the
  sample-match try-a-line, and quiet health tips for the focused entry. Session is pure and
  unit-tested (`lore/session.ts`: one focusedId; TOC click and pager both go through
  `selectEntry`). The RC codec (`formats/rolecall/lorebook.ts`) remains the field-coverage
  checklist; token estimates are the core's honest gauge (`estimateEntryTokens`/
  `estimateBookTokens`, ~4 chars/token, always rendered with "~").
- The app dock collapses to marks-only via the strip at its foot (persisted as `shell.dockSlim`);
  it is the same visual language as the locked narrow-screen mode, just user-driven. Tiles carry
  hover titles so the slim dock stays discoverable.

## The Press room (batch export - the staged set prints)
The staging grammar applied to export: the Library browses, pieces get STAGED for the Press
(right-click "Stage for the Press", or the room's own left rail of unstaged-piece stamps), and the
room works only its staged queue - no studio browser inside. The queue is shell-store state
(`pressQueue` + `ctx.press`), so it survives app switches.
- **Bundles** (`press/press-bundles.ts`, pure + tested): a staged character travels as a bundle - his
  `body.knowledgeRefs` lorebooks ride along automatically (resolved against the whole studio, even
  when never staged), droppable per run ("drop from this run" / "ride again"); staged books already
  riding a bundle are not doubled as solos. Everything else rides solo.
- **Readiness on every card** (`press/readiness-core.ts`, pure + tested): characters are read
  against the run target's coverage claims (`/api/coverage` carries - the same ground truth as the
  editor lens): "8 of 23 filled - empty: nickname, personality, +12 more" with an
  open-in-the-editor fix link. Lorebooks get the can-it-ever-fire check (`lorebookKeyGap`: entries
  with no triggers and not constant). No claims = an honest nothing, never fake green.
- **One target per run** (`press/press-core.ts`: `groupPlatforms` folds extension-map hosts -
  Marinara/Chub print characters as a CCv3 card, their native character file), per-card filename +
  flavor (.json/.txt/.md only where the wire format is text), skip rows declared before the run,
  per-row honest results (printed with carries / skipped with the reason / failed with the error),
  one zip out.
- Deferred, stated: delivery ledger + saved jobs, drag reorder, rehearse-bytes drawer, offer-rail
  readiness dots.

## Settings (drop-in sections)
Settings is built from section modules: one file in `src/ui/apps/settings/sections/` exporting a
`SettingsSection` (id, label, order, `Component: (props: { ctx }) => JSX.Element`);
`sections/registry.ts` is the one stated seam. Tabs derive from the registry (`src/ui/apps/settings/
index.tsx`); every control is call-and-response against live settings (theme/accent repaint
instantly). Shipped sections: Appearance (theme, house accent via the shared SwatchRow), Studio
(home app, Library first deck, publish targets from the live registry), Workbench (follow behavior).

## Shared components (`src/ui/_shared/` and `src/ui/components/`)
Extracted-once UI, layered so a single implementation serves every consumer:
- `components/swatch-row/` - `SwatchRow` (+ the `HOUSE_PALETTE` constant), the house color-swatch
  row. Preset tiles are the fast path; with `allowCustom` a final `custom` tile opens `PaintPicker`
  (solid mode) for any color. Controlled: `value` in, `onChange(hex)` out. Consumers: setup accent
  step, Settings Appearance, later the editor's per-entity accent.
- `components/color-picker/` - `ColorPicker`, the on-brand HSV surface (saturation/value square, hue
  strip, hex field; no OS dialog). HSV, not hex, is its internal state (hex is lossy at s=0/v=0).
- `_shared/color-math.ts` - the pure color math powering the picker: `normalizeHex`/`hexToHsv`/
  `hsvToHex` (fail-closed on garbage) and `dragFraction` (the pointer-drag fraction math shared by
  the SV square, the hue strip, and the gradient stop rail). Unit-tested.
- `_shared/paint.ts` - the pure Paint model: a `solid | gradient(linear|radial)` discriminated union
  with `paintToCss` and a fail-closed `normalizePaint` (a gradient needs >=2 valid stops). Unit-tested.
- `components/paint-picker/` - `PaintPicker` composes `ColorPicker` to edit a solid color or each
  stop of a gradient. `allow` gates the modes, so the same widget serves a solid-only accent and a
  full linear/radial gradient fill. Solid mode is live via the accent's custom tile; gradient mode
  (stop rail, add/drag/remove stops, linear-angle slider, true-curve preview) is built and
  model-tested, awaiting its first fill consumer (per-entity/pack background in the editor).

## Security
Loopback bind only. Uploads parse through the same fail-closed adapters as the CLI (zip-bomb caps
included). Scripts inside entities remain data everywhere. App-manifest SVGs are sanitized before
insertion in both the Dock and catalog (scripts/foreignObject/handlers stripped) because the shell
invites third-party drop-ins.
