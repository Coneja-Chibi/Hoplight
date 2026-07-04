# ADR-003: Distribution — single executable + self-updater; installer later

**Status:** accepted (Chi, 2026-07-02)

## Decision

1. **Primary (v0.1):** single-file executables per OS (win x64, mac arm64/x64,
   linux x64) built by `bun build --compile`, attached to **GitHub Releases**.
   Download one file, run it. No Node, no git, no install steps.
2. **Self-updater:** `vaud upgrade` checks GitHub Releases, downloads the new
   binary, verifies the SHA-256 checksum (checksums file signed with minisign),
   swaps itself atomically. The app face later reuses the same mechanism with a UI.
   Passive behavior: at most one non-blocking "new version" notice per day; never
   auto-install without consent.
3. **Later:** signed desktop installers via the Tauri bundler when `apps/studio`
   ships (M6). Package managers (winget/scoop/brew) when someone asks; the manifests
   are cheap once Releases are stable.
4. **npm:** core packages published for embedders; `npx vaud` works but is the
   secondary path, not the documented default.

## Why

- SillyTavern's node+git install is the single most cited onboarding pain in this
  hobby. "Download one file" is the marketing headline, so it must be the engineering
  truth.
- GitHub Releases: free bandwidth and the audience already lives there.

## Consequences

- Release CI builds a matrix of binaries + checksums + signature on every tag.
- Windows SmartScreen will complain about unsigned exes; buy a code-signing cert
  when there's budget, document the "More info -> Run anyway" path until then
  (M1 ticket).
- Binary size (Bun embeds its runtime, ~50-90MB) is accepted; document it.
