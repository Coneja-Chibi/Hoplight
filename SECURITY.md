<div align="center">

<img src="docs/media/vaudeville-v.png" alt="" width="56">

<sub>· A CONEJA-CHIBI PRODUCTION ·</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hoplight-wordmark-dark.png">
  <img src="docs/media/hoplight-wordmark-light.png" alt="Hoplight" width="320">
</picture>

</div>

---
# Security Policy

## Reporting a vulnerability

Email **chibiconeja@gmail.com** with a description and, if you have one, a reproduction. Please
report privately before disclosing publicly.

What to expect:

- An acknowledgment within a few days
- A fix on Mainstage as fast as severity warrants
- Credit in the release notes if you want it

## Scope

Hoplight is a local-first app: a loopback-only server plus a CLI, no accounts, no cloud. Reports
most valuable here:

- Path escape from the studio folder (id validation, archive extraction)
- Anything that lets a web page reach the local API despite the token, Origin, and
  Sec-Fetch-Site checks
- Content-Security-Policy bypasses in the served shell
- Card payloads (Lua, macros, regex, archives) achieving execution or resource exhaustion
  despite the sealed-data rule and decompression caps
- Escapes from the test-bench sandbox: out of the wasmoon Lua VM, out of its worker, or off the
  isolated sandbox origin (which serves only `worker.js` + `glue.wasm` and 404s all `/api/*`)
- Corruption of user pieces despite atomic writes and escrow

Out of scope: issues requiring an attacker who already runs code on the same machine as the user.

## Posture

The technical safety model is summarized in the README's FAQ ("What's been done to keep this
thing safe?"). Short version: loopback bind, per-launch session token, fetch-metadata refusal,
hashed-script CSP, path containment, atomic writes, fail-closed parsing, bounded decompression,
no automatic execution of card payloads, no telemetry or background content upload. Deliberate
network access is limited to the model-provider endpoint the user configures, fixed GitHub release
endpoints used for update operations and for the optional remote-access helper, and remote access the
user explicitly enables. The helper is the only download that becomes an executable: it is fetched on
an explicit host-only request, verified against a SHA-256 pinned in the repository before any bytes
reach disk, and discarded on mismatch. ~2,000 tests run in CI on every commit, including the
path-containment, server-security, sandbox, round-trip, and Go sidecar authorization suites.
