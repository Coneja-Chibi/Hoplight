---
id: guide/security
title: Security and privacy
audience: user
summary: What keeps your content and your keys on your machine, why a downloaded card cannot run code on its own, and the few places where a protection is partial and we say so.
tags: [security, privacy, sandbox, api-keys, local-first]
related: [guide/getting-started, guide/importing, guide/regex, reference/architecture]
---

# Security and privacy

Hoplight runs on your machine and nowhere else. It also opens files other people made: character cards with embedded scripts, PNGs and zips, regex sets you downloaded from a stranger. Those are the two facts this page is about. Your work stays yours, and an untrusted file stays inert until you deliberately decide otherwise.

This is a security page, so it errs toward honesty over comfort. Where a protection is real, it says so and points at what backs it. Where a protection is partial, it says that too.

## Your content stays under your control

- **The primary server is local by default.** When you open the studio it binds `127.0.0.1`, the
  local-only address, and prints it (`127.0.0.1:8321` by default). A remote listener exists only when
  you explicitly enable Remote access and complete its separate approval flow.
- **There are no accounts.** No sign-in, no cloud, nothing to breach somewhere else.
- **There is no telemetry or background content upload.** Hoplight does not operate an inference
  proxy or analytics service.
- **Your pieces are plain files.** Everything you import or edit lives as JSON in a studio folder you can open, read, and back up yourself (`~/Documents/Hoplight Studio` unless you point it elsewhere).

One honest limit: local means not uploaded, not encrypted at rest. Your studio folder is readable JSON on your own disk on purpose, so anyone who can already read your files can read your pieces. Guard the folder the way you guard the rest of your documents.

Hoplight does make deliberate network calls at specific user-facing boundaries:

- Kit sends model context to the provider endpoint you configured when you submit a provider-backed
  turn.
- Updates reads fixed GitHub release endpoints when you open update information or start a version
  switch.
- Remote access uses the listener and tunnel you explicitly enable.
- The private-mesh link needs a helper program that is not bundled with the app. If you press
  **Download the extra piece**, Hoplight fetches it from its own GitHub releases and checks it against
  a fingerprint built into your copy before writing anything to disk. A file that does not match is
  thrown away, not quarantined. This is the only download Hoplight turns into a program it runs, it
  never happens on its own, and LAN mode needs no download at all.

Importing, editing, converting, and deterministic analysis do not require a provider and make no
provider call.

## A card cannot run itself

A card you download is read, not run. The scripts a card can carry are handled three different ways, and only one of them ever executes anything.

- **Regex sets are data.** A regex rule is applied as a budgeted find-and-replace, never `eval`, never a payload. The real protection is that a pattern which looks dangerous is refused before it can run; the time limit that follows is a backstop, not a hard stop, and a rare pattern that slips past the check could still make things hang.
- **Macros and triggers are analyzed, not evaluated.** Embedded macros and Risu-style card triggers get read and reported, never executed. Even a `calc::` expression goes through a small hand-written number parser, not the language runtime.
- **Lua runs only in the Risu Test Bench, and only when you open it.** The one place a card's Lua actually executes is a test bench you invoke on purpose. Nothing runs Lua on import, on preview, or in the background.

@fig card-cage

When you do open the Test Bench, the script runs caged: real Lua inside a WebAssembly virtual machine,
inside a web worker, with hard timeouts and memory ceilings, served from a **separate loopback origin**
whose little server serves only the Lua worker, the regex worker, and `glue.wasm`, answers `404` to
every `/api` path, and carries none of your session token.

The honest caveat: that separate-origin boundary is proven by the automated tests at the HTTP layer, and it is deliberately **not** yet measured inside the packaged Windows app (this is tracked in ADR-009, and its packaged-host check is still open). So we say the Test Bench is opt-in and limited. We do not say it is fully isolated or that it cannot be escaped, and we will not until that measurement exists.

## Other files stay bounded

Untrusted input does not get to exhaust your machine on the way in.

- **Uploads and request bodies are size-capped**, and reject anything oversized at the door.
- **Zip and PNG reading is bounded**, so an archive bomb that tries to balloon into gigabytes hits the cap and stops.
- **Parsing fails closed.** A malformed card is rejected rather than half-read. Kit's gated change
  apply path saves and then re-reads the target to verify the intended content landed; ordinary
  Studio saves use revision checks to reject stale editor writes.
- **File names are contained.** Piece ids are validated and resolved strictly inside your studio folder, so a card that tries to escape the folder with a crafted name is blocked before any file is touched.

## Converting never copies one app's code into another

When you convert a card from one app's format to another, Hoplight carries across the portable content and nothing else. Each app's private extras, its extension blocks, its trigger scripts, its bespoke layout, stay behind. They are kept safe in an escrow copy attached to your piece, so a same-format round-trip loses nothing, but they are never blind-copied into a different app's file.

This is on purpose. It is why a conversion cannot smuggle one app's executable payload into another app's card. What crosses is the shared, readable core; what does not cross is reported to you.

## About API keys

Provider-backed Kit is optional and bring-your-own-key.

- The converter, inspection, validation, editing, and deterministic checks work without a key.
- Kit stores provider configurations in its local vault. Windows uses the operating-system credential
  backend. A portable passphrase-encrypted backend exists in code, but the current settings flow does
  not yet collect and supply that passphrase, so first-run vault setup is incomplete on platforms
  without the Windows backend.
- A credential is sent only as authentication to the endpoint configured for that provider. It is not
  inserted into model messages, tool observations, canonical pieces, exports, transcripts, or the
  privacy ledger.
- Provider requests validate the configured host before every network hop. Redirects to another host,
  HTTPS downgrades, and redirect chains beyond five hops are refused before the next request.
- There is no Hoplight inference service, account, or proxy between you and the configured provider.

The Studio also mints a fresh session token each time it launches, uses it to gate mutations, and
never saves it to disk.

## What we do not claim

- The desktop binaries are unsigned, so Windows SmartScreen and macOS Gatekeeper will warn on first run. That is a missing paid certificate, not a sign of tampering; verify the SHA-256 checksums shipped with each release.
- The Test Bench origin boundary is not yet measured in the packaged app, as described above.
- Your studio folder is not encrypted at rest, as described above.
- Kit does not yet expose the passphrase setup and unlock flow needed to use its portable vault
  backend on non-Windows systems.

Found a hole? Report it privately first, to **chibiconeja@gmail.com** (also in the repo's `SECURITY.md`). You get a reply, a fix as fast as the severity warrants, and credit in the release notes if you want it.
