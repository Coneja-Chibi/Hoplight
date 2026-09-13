---
id: reference/updates
title: Updates and version rollback
audience: dev
summary: The Updates settings tab, a version timeline built from each release's commit log, and a one-button switch that updates OR rolls back. How the switch works for a source checkout vs an installed build, and the safety rails (refuse a dirty tree, single-flight, restart-outcome marker, refuse a data-losing rollback). Off-network except a button-press GitHub read.
tags: [updates, rollback, releases, versioning, self-update]
related: [reference/security/remote-access, reference/architecture]
---

# Updates and version rollback

Settings > Updates. Shows every release newest-first with how far behind you are, and, for each, its
number, headline change, and full commit log. From any row you can move to that version: newer = update,
older = roll back. It reads GitHub only when you open the page or press a button; nothing runs on its own.

## The timeline (read-only, live-proven)

- `GET /api/updates/releases` fetches the repo's releases from a FIXED GitHub URL (no caller input in the
  host/path, so no SSRF), with a 5-minute in-memory cache + ETag so a curious user cannot burn GitHub's
  unauthenticated hourly limit; a 403/429 answers with a "try again in N min" (`src/ui/server-updates.ts`).
- The pure core (`src/ui/_shared/version-history.ts`) parses the payload into the timeline. Commit data
  comes ONLY from a fenced ` ```commits ` block each release ships (emitted by `.github/workflows/release.yml`,
  `<shorthash> <subject>` per line); a release without the block renders "commit log unavailable", never a
  guess from the install-guide prose. Every version comparison goes through `compareVersions`, so the bare
  running version ("0.1.8") still matches its tag ("v0.1.8").

## The switch (built + unit-proven; the apply path is not yet live-provable)

`POST /api/updates/switch` is host-only (refused to any remote/LAN device), validates the target as a real
release tag (blocking a "--force"-shaped value before it reaches a git argv), refuses the current version,
starts ONE switch behind a single-flight lock, and returns 202. The client polls `GET /api/updates/switch-status`.

- **Source checkout** (`src/ui/switch/source-engine.ts`): refuses a dirty TRACKED tree and NAMES the files
  (never stashes your work), captures the exact prior ref, checks out the tag, reinstalls, and relaunches.
  On any failure it restores that prior ref + reinstalls, so a failed switch lands back where it started.
- **Installed build** (`src/ui/switch/packaged-engine.ts`): downloads the asset that matches this binary
  (https + GitHub-host allowlist on the URL and every redirect hop, size cap), verifies it against the
  release's `SHA256SUMS`, stages it, and opens the folder. It does NOT swap the running executable
  underneath itself, that auto-swap is the one path that can brick an install and cannot be tested without
  a real packaged install, so it is deferred to its own change; this safe path still does the whole
  download + verify.

The restart-outcome marker (`src/ui/_shared/pending-switch.ts`) is written to settings BEFORE a source
relaunch, so the next boot confirms the outcome (success/failed) via `GET /api/updates/pending`, which
clears it on read so a closed popup never re-shows. NOTE: a rollback to a version older than this feature
cannot show that popup (that old code has none), so the confirm screen says so and becomes the receipt.

What is proven: the guard rails and the read-only timeline are verified live (current-version refused,
injection blocked, a real switch attempt correctly refused the dirty tree and named the files with no
checkout). The apply path (checkout -> reinstall -> reboot -> success popup) is unit-tested and reasoned but
not yet live-provable: it can only run once the feature exists inside a shipped release.

## Rollback safety

- A rollback that crosses a release which changed how the studio is stored is refused
  (`classifyDataChange` + `SCHEMA_BUMPS` in `src/ui/_shared/switch-decision.ts`). `SCHEMA_BUMPS` is empty
  today (`CANONICAL_SCHEMA_VERSION` has never moved), so no rollback is refused yet, but the guard fails
  closed the day one lands.
- A storage-shape tripwire test (`src/ui/switch/storage-shape-tripwire.test.ts`) pins a hash of the files
  that define the on-disk shape, so a storage change cannot ship without a deliberate schema bump or a
  `SCHEMA_BUMPS` entry.
- Your studio folder (pieces, settings, keys) is never touched by a switch; only the program changes.
