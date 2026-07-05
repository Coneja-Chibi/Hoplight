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
  only door (inspect/export/studio/formats). The shell owns theme, tabs, tray, and the status bar.
- **Tokens are one CSS source**: `src/ui/theme/tokens.css`, transcribed from `design/DECISIONS.md`
  (both themes, the stamp, the seam). Apps consume tokens; hardcoding colors or layout pixels in an
  app is a review rejection (fluid law).

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
`GET /apps/<id>.js` bundled app · `GET /api/formats` · `POST /api/inspect` (bytes + x-filename) ->
receipt + canonical entity · `POST /api/export` {entity, targetId} (cross-kind fails closed) ·
`GET /api/studio/list|get` · `POST /api/studio/save`.

## Security
Loopback bind only. Uploads parse through the same fail-closed adapters as the CLI (zip-bomb caps
included). Scripts inside entities remain data everywhere. App-manifest SVGs are sanitized before
insertion (scripts/foreignObject/handlers stripped) because the dock invites third-party drop-ins.
