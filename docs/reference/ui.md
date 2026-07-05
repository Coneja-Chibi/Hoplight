# The visual app (vaud ui)

`vaud ui [port] [studioDir]` boots the local studio: a loopback-only Bun server (default
`127.0.0.1:8321`) serving the shell and a JSON API that is a thin skin over the same engine the CLI
uses. One engine, two shells - no format logic exists in the UI layer.

## Hyper-modularity (the build's spine)
- **Apps are drop-in folders**: `src/ui/apps/<name>/index.ts` default-exports a `VaudeApp`
  (`src/ui/app-contract.ts`): a manifest (tile title, flat-ink SVG mark, accent, order, optional
  `comingSoon`) plus `mount(ctx)`. The server discovers them with `Bun.Glob` (`_`-prefixed folders
  skipped) and bundles each for the browser on demand. Drop a folder in, restart, the dock gains a
  tile - identical doctrine to `src/formats/`.
- **Apps never touch the engine or the filesystem**: they receive an `AppContext` whose `api` is the
  only door (inspect/export/studio/formats). The shell owns theme, the Workbench tabs, and the status bar.
- **Tokens are one CSS source**: `src/ui/theme/tokens.css`, transcribed from `design/DECISIONS.md`
  (both themes, the stamp, the seam). Apps consume tokens; hardcoding colors or layout pixels in an
  app is a review rejection (fluid law).

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
  `firstRunLanding` (the Library's two doors); later boots open the lowest-order app. The theme
  button persists to settings (localStorage is only a pre-paint cache).

## The right-click system
One context menu for the whole app (`src/ui/_shared/context-menu.ts`), extended by REGISTRATION:
- a surface marks an element as a TARGET: `ctx.menus.attach(el, () => ({ type, label, data }))`
  (deepest attached element wins; a document-level `shell` target is the always-there fallback)
- a feature contributes items: `ctx.menus.register(type, provider)` (any number of providers per
  type; each provider's items form a section; empty/null = deny by absence). Returns an
  unregister for app cleanup.
- shell-owned providers: `entity` (Send / Show / Remove on the Workbench - the one-shot single path,
  works in every room), `app` (dock tiles), `shell` (Go home / Import files / Switch theme). Adding a
  menu later (Open in editor, Export, Delete) = one register() call; nothing central is edited.

## Dev live-reload
`vaud ui` (or `bun run dev`) watches `src/ui/` and pushes a reload over SSE (`/dev/reload`) to
every open page; bundles are built fresh per request, so edits appear on save. The packaged exe
serves baked bundles and 404s the stream (the client goes quiet). Zero dependencies.

## The card-type chip
Summaries carry `sourceFormat` + `sourceVariant` (the first non-vaud escrow entry). The Library
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
bundled step · `GET|POST /api/settings` (POST replaces the whole document; parse is fail-closed) ·
`GET /api/formats` (includes `native`) · `POST /api/inspect` (bytes + x-filename) -> receipt +
canonical entity · `POST /api/export` {entity, targetId} (cross-kind fails closed) ·
`GET /api/studio/list|get` · `GET /api/studio/portrait?kind&id` (the entity's art: the escrowed
PNG carrier, else a data-URI `body.media.portrait`; 404 when none) · `POST /api/studio/save`.

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
- **Multi-select is staging** (Chi, 2026-07-06 - restored after the IDE rework dropped it): tapping a
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
- The manifest flag `editsPieces` marks the room tabs focus into. The home app on boot is the
  user's `homeApp` setting.

## Settings (drop-in sections)
Settings is built from section modules: one file in `src/ui/apps/settings/sections/` exporting a
`SettingsSection` (id, label, order, render); `sections/registry.ts` is the one stated seam. Tabs
derive from the registry; every control is call-and-response against live settings (theme/accent
repaint instantly). Shipped sections: Appearance (theme, house accent via the shared swatches),
Studio (home app, Library first deck, publish targets from the live registry), Workbench (follow
behavior).

## Security
Loopback bind only. Uploads parse through the same fail-closed adapters as the CLI (zip-bomb caps
included). Scripts inside entities remain data everywhere. App-manifest SVGs are sanitized before
insertion (scripts/foreignObject/handlers stripped) because the dock invites third-party drop-ins.
