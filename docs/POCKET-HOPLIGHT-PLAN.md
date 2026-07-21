# Pocket Hoplight: the studio, fully client-side, installable from GitHub Pages

**Goal:** someone with only an iPad opens a URL, adds it to their home screen, and runs the whole
studio: import, edit, convert, export. No PC, no server, no app store. Data never leaves the device.

**The architecture bet (decided, do not relitigate without new facts):** the engine core is pure
TypeScript and the UI already talks to one seam. Instead of reimplementing the API surface, the
POCKET build runs the existing `createHandler` (src/ui/server.ts) inside a **Service Worker**, over
an **OPFS-backed studio store**. Every `fetch("/api/...")` from the page, including bare
`<img src="/api/studio/portrait...">` URLs, hits the SW and gets the same Response the desktop
server would produce. One handler, three shells (exe, dev server, service worker).

## Ground facts (surveyed 2026-07-21)

- `StudioStore` public surface is 5 methods: `studioPath / list / read / delete / save` (273
  lines); fs primitives confined to `mkdir readdir access unlink` + `atomic-file.ts`
  (`open rename unlink`). `SettingsStore` is smaller. OPFS (iPadOS 17+, Android Chrome) covers all
  of it; atomic-replace maps to OPFS `createWritable()` which is already atomic-on-close.
- `createHandler(store, settings, packaged, sec, sandboxOriginRef?, lifecycle?)`: packaged mode
  serves everything from baked in-memory assets (no fs); lifecycle and dev-watch are optional and
  desktop-only; the sandbox host is a separate origin server (see Cuts below).
- Session-token security (`X-Hoplight-Token`) models "only local processes can reach loopback".
  In the SW world the origin sandbox IS that boundary; the sec gate adapts, it does not weaken
  (same-origin only, reject cross-origin).
- Lua Test Stage already runs wasmoon in a worker (browser-targeted); regex workers likewise.

## Phases (each gates on green tests + a live iPad-viewport probe via Playwright)

- **P1. Store twins.** Extract the store contracts (`StudioStoreLike`, `SettingsStoreLike`,
  structural interfaces), point `createHandler` at them, add `OpfsStudioStore` /
  `OpfsSettingsStore` (src/studio/opfs/). Conformance suite runs against a shared spec with the
  fs-backed store under bun and a memory shim; the OPFS twin is live-proven in the browser (bun
  has no OPFS).
- **P2. The worker shell.** `src/pocket/sw.ts`: installs, precaches the baked site, routes
  same-origin `/api/*` through `createHandler` (packaged mode, pocket lifecycle no-ops), serves
  everything else from the precache (offline-first). `/api/version` gains `mode: "pocket"`; the
  About row prescription: "Updates arrive on their own the next time you are online" (SW update
  flow), no download button, no git pull.
- **P3. The site bake.** `scripts/build-pocket.ts`: reuses the desktop bake (assets + static
  format registry), emits `dist/pocket/` with `index.html`, hashed bundles, `sw.js`,
  `manifest.webmanifest` (beam-V icons from build/), iOS meta tags. No CDN, no external hosts
  (matches the CSP posture).
- **P4. Ship it from the train.** `release.yml` gains a `build-pocket` job; Pages deploy
  (actions/deploy-pages) on every release. The README installation table gains an "iPad / any
  browser" row; RELEASE-NOTES-INSTALL.md likewise.
- **P5. Pocket honesty pass.** Storage is evictable by Safari: request `navigator.storage.
  persist()`, and add the one-tap "Download my whole studio (zip)" backup + restore in Settings
  (this is also just a good desktop feature). Loud first-run note in pocket mode: where the data
  lives, how to back it up. Copy nuance in README ("loaded from a URL, runs and stores entirely on
  your device; there is no backend").
- **P6. iPad polish.** Playwright iPad-viewport walk of the promises table core flows; touch
  target and safe-area audit; fix what it finds.

## Cuts (v1, deliberate, say so in the UI)

- **Lua Test Stage OFF in pocket v1**: the desktop sandbox isolates via a separate ORIGIN; a SW
  cannot mint one. Pocket v1 hides the Test Stage entry points ("needs the desktop studio") rather
  than weakening isolation. Revisit: sandboxed iframe + credentialless, its own design pass.
- **No LAN/companion mode in this arc** (separate feature, separate security design).
- Update check stays manual-button (GitHub API allows CORS) but is redundant with SW auto-update;
  keep the row honest per mode.

## Risks pinned

- Safari OPFS quirks (sync access only in workers is FINE: the SW/worker is where the store runs).
- Big files: 23MB charx inspects are memory-bound in a SW; cap gracefully (same 64MB ceiling).
- GitHub Pages path prefix (`/Hoplight/`): every asset and SW scope must be relative; the bake
  takes a `--base` flag and the train passes it.
