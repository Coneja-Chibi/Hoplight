---
id: reference/security/secrets-and-keys
title: Secrets and keys
audience: dev
summary: How Vaudeville Studios is designed to hold BYOK provider keys, keep them out of logs and exports, and how the shipping loopback server gates its API with a per-launch bearer plus Host and Origin checks.
tags: [security, byok, keys, vault, loopback, csp]
related: [reference/architecture, reference/concepts/safe-rendering, reference/cli]
---

# Secrets and keys

This page covers two things at two different maturity levels, and the split matters more than any single
claim on it:

- **The key vault** (where BYOK provider keys live) is a **draft spec**, not shipping code.
  `specs/engine/key-vault.md:3` marks it `status: draft`, milestone M2, package `packages/ai`. That
  package does not exist in the tree yet. Everything in the "Where keys live" section below is the
  committed design, written in the future tense on purpose. Do not read it as a description of running
  code.
- **The loopback UI server** (`src/ui/server.ts`, `src/ui/server-security.ts`, `src/ui/sandbox-host.ts`)
  **is** shipping code with automated Bun tests. The "Loopback server" and "Sandbox origin" sections
  describe present behavior and cite the exact enforcing lines.

Where a defense is proven at only one layer, or is scaffolding not yet measured, this page says so in the
same breath. See `@fig defenses` for the whole picture at a glance.

@fig defenses

## Where keys live (the vault, spec only)

Vaudeville Studios is bring-your-own-key: the user supplies Anthropic, OpenRouter, OpenAI, Gemini, or any
OpenAI-compatible endpoint credential, and there is no Vaudeville-operated inference, account, or proxy
(`docs/decisions/ADR-006-ai-and-agent.md:7-9`; `specs/engine/key-vault.md:13-24`). The vault is specified
as a `packages/ai` component with zero UI, consumed by the CLI and the agent loop, that never runs on a
server (`specs/engine/key-vault.md:16-24`).

### Two kinds of state, kept apart

The spec splits state so that only one half is ever secret (`specs/engine/key-vault.md:30-42`):

- **Non-secret metadata** in `~/.vaud/vault.json`: provider kind, label, base URL, organization id, and
  the *names* of any extra headers, never values that could carry a token. Plain JSON, safe to read.
- **Secret material**: the API key string, plus any `extraHeaders` values (a header can itself carry a
  bearer), keyed by the provider config id. This lives only in one of the two backends below, never in
  `vault.json`.

The type system is designed to enforce the split: `ProviderConfig` (safe) and `ProviderSecret`
(`{ apiKey, extraHeaders? }`, never logged) are distinct types, and only `getApiKey` plus backend
internals ever hold a `ProviderSecret` (`specs/engine/key-vault.md:161-167, 192-196`).

### Two backends, chosen at first use

On first vault use the spec probes for OS keychain support and records the choice
(`specs/engine/key-vault.md:46-64`):

1. **OS keychain** (Windows Credential Manager, macOS Keychain, Linux Secret Service via libsecret) when
   a native binding loads and a canary write-then-read round-trip succeeds. One entry per config:
   `service = "vaud"`, `account = providerConfig.id`, secret = JSON-stringified
   `{ apiKey, extraHeaders? }` (`specs/engine/key-vault.md:77-82`).
2. **Encrypted file** everywhere else (headless Linux, WSL, containers with no Secret Service daemon),
   with a one-time stderr warning (`specs/engine/key-vault.md:52-56`):
   - `~/.vaud/vault.key`: 32 bytes from `crypto.randomBytes(32)`, generated once, permissions restricted
     to the owner (`chmod 600` on POSIX, an owner-only ACL on Windows). This is the local secret, not a
     passphrase, and is not stretched by a KDF (`specs/engine/key-vault.md:84-96`).
   - `~/.vaud/vault.enc`: one AES-256-GCM encrypted JSON blob, fresh random 96-bit IV per write, the GCM
     auth tag appended to the ciphertext. Writes are atomic: encrypt to a temp file, `fsync`, rename over
     the target, so a crash mid-write cannot corrupt the previous good state
     (`specs/engine/key-vault.md:92-101`).

A corrupted or partially-restored `vault.enc` fails the GCM auth tag check on decrypt. The spec requires
the vault to refuse to load and raise `DECRYPT_FAILED`, never to silently regenerate a key or proceed
with an empty vault (`specs/engine/key-vault.md:288-294`).

### Never logged

The spec treats never-logging keys as a hard invariant, because vault consumers include the agent loop,
whose traces and transcripts users paste into bug reports (`specs/engine/key-vault.md:134-167`):

- Exactly three functions return raw key material: `getApiKey`, `getSecret`, and `resolveRole`. Every
  other read path omits `apiKey` and `extraHeaders` values **entirely**, not masked with a partial
  suffix, because a masked suffix is still key material.
- A shared `redactSecrets(obj)` helper deep-strips key-shaped fields, applied at the agent loop's spill
  store boundary rather than trusted to each caller (`specs/engine/key-vault.md:156-157, 268-271`).
- `VaultError` carries `providerConfigId` and `label`, never the key, even on `DECRYPT_FAILED`
  (`specs/engine/key-vault.md:161-167`).
- The CLI reads the key through hidden, non-echoing input and never prints it back, including in `--json`
  output (`specs/engine/key-vault.md:158-160`).

### Never in an export

The vault is structurally outside the export path, which is a stronger guarantee than a scrub pass would
be. The vault is a `packages/ai` component consumed by the CLI and agent loop
(`specs/engine/key-vault.md:16-24`); the UI server's export route operates on canonical entities
(`src/ui/server.ts:296-301`), and a canonical entity has no key field. Keys are not filtered out of an
export at export time; they were never in the entity graph an export walks. The vault's `redactSecrets`
helper guards the agent loop's spill store, a different boundary
(`specs/engine/key-vault.md:156-157`).

### Not yet decided

Honest open questions from the spec, unresolved at the time of writing
(`specs/engine/key-vault.md:67-74, 320-329`):

- Which native keychain binding ships, and whether a native `.node` addon loads inside a
  `bun build --compile` single-executable. The fallback-to-file path must work regardless.
- Whether an environment-variable key override for CI is supported in v1.
- Per-platform keychain size limits and whether an oversize secret forces file mode.

## The loopback server (shipping)

The visual app runs a local server bound to `127.0.0.1` only: `Bun.serve({ port, hostname: "127.0.0.1",
... })` (`src/ui/server.ts:425`). It is a thin shell over the same engine the CLI uses. Nothing in an
uploaded entity is ever evaluated server-side; scripts inside cards are data
(`src/ui/server.ts:1-12`).

### The per-launch bearer

A fresh bearer token is minted once per launch: `randomBytes(32).toString("base64url")`, created in
`createSecurityContext` and marked "never log or persist" (`src/ui/server-security.ts:18-32`). It is
injected into served HTML as an escaped `<meta name="vaude-session">` tag by `injectSessionMeta`
(`src/ui/server-security.ts:102-111`), which the trusted UI reads to authenticate its own API calls. The
token stays in that meta tag and the trusted `apiFetch` path; it is never handed to the sandbox origin
(see below, and `src/ui/sandbox-host.ts:100-102`).

### The /api/* gate

Every `/api/*` route runs through `checkApiRequest` before any handler
(`src/ui/server.ts:197-201`, definition `src/ui/server-security.ts:199-230`). The gate is scoped to
`/api/*`; static assets (HTML, JS, wasm, icons) serve ungated because they are not secret.

`checkApiRequest` enforces, in order:

1. **Fail closed before bind.** If the expected Host, expected Origin, or token is not yet filled in, it
   returns `503` (`src/ui/server-security.ts:204-206`).
2. **Host on every method.** `hostAllowed` accepts an exact `host:port` match, or a loopback-equivalent
   spelling (`127.0.0.1`, `localhost`, `[::1]`) **on the same port**; anything else returns `403`
   (`src/ui/server-security.ts:52-56, 207-208`). This is the DNS-rebinding defense: it rejects requests
   whose Host is an attacker-controlled hostname resolved to loopback.
3. **GET and HEAD carry no token.** An `<img src>` sends no custom headers, so demanding a token on reads
   would leave image loads usable as a blind existence oracle. Instead these methods are refused only
   when `Sec-Fetch-Site` is `cross-site`, a browser-set header a page cannot forge
   (`src/ui/server-security.ts:210-219`).
4. **POST demands Origin and token.** The Origin must be loopback-equivalent to the expected origin, and
   a null Origin fails closed (`originAllowed`, `src/ui/server-security.ts:59-64, 221-224`). The token is
   compared with `crypto.timingSafeEqual` in constant time, and a zero-length token compares false
   (`tokensEqual`, `src/ui/server-security.ts:131-136, 225-226`).
5. Any other method returns `405` (`src/ui/server-security.ts:229`).

### What the gate does not do

Stated plainly, because overclaiming here would be a defect:

- **`localhost` and `[::1]` on the correct port are accepted, not rejected.** Only a wrong port or a
  foreign hostname fails closed (`src/ui/server-security.ts:45-56`). The code's own reasoning: all three
  loopback spellings resolve to the same bound interface, so rejecting `localhost` would paper-cut a user
  with a bookmark while protecting nothing. The gate stops attacker hostnames, not loopback aliases
  (`docs/decisions/ADR-009-sandbox-origin.md:72-78`).
- **GET and HEAD are not token-gated.** A header-less client (curl, an older browser) that sends no
  `Sec-Fetch-Site` passes the read gate (`src/ui/server-security.ts:210-219`). The read gate is
  deliberately weaker than the mutation gate. Reads that expose entity data rely on the loopback bind and
  the cross-site refusal, not on the bearer.

### Body caps

Request bodies are streamed with a hard byte cap and a `413` on overflow: `INSPECT_BODY_MAX` is 64MB,
`JSON_BODY_MAX` is 32MB (`src/ui/server-security.ts:14-15`). `readBodyCapped` checks `Content-Length`
early when present and also enforces a running total as it reads, so a lying or absent length header
still cannot exceed the cap (`src/ui/server-security.ts:142-182`). This is the same fail-closed posture
the upload adapters use against zip bombs.

## The sandbox origin (shipping code, packaged proof BLOCKED)

Untrusted Lua from the Risu Test Bench runs in a Worker served from a **second** loopback listener on an
ephemeral port, which is a distinct origin from the UI and `/api/*`
(`src/ui/sandbox-host.ts:167-184`; `docs/decisions/ADR-009-sandbox-origin.md:44-62`). This is
defense-in-depth: a same-origin Worker is a killable thread, not an origin boundary, so if a future
WebView or bundler bug exposed web capabilities, same-origin placement would widen the blast radius
(`docs/decisions/ADR-009-sandbox-origin.md:14-20`).

The sandbox host fails closed by construction:

- It serves only `/sandbox/worker.js` and `/sandbox/glue.wasm`; every other path returns a `404` with a
  locked-down CSP (`SANDBOX_ALLOWLIST`, `deny`, `src/ui/sandbox-host.ts:29-57, 162-163`). No `/api`, no
  index HTML, no session token, no traversal aliases.
- CORS is limited to the exact UI origin (plus its loopback aliases) so only the trusted UI can construct
  the cross-origin module Worker (`src/ui/sandbox-host.ts:36-45, 104-131`).
- The API token is never injected into anything this host serves
  (`src/ui/sandbox-host.ts:100-102`; `docs/decisions/ADR-009-sandbox-origin.md:53-56`).

### What is proven, and what is not

This is scaffolding additive to the token (Plan 005) and the sandbox resource quotas (Plan 016), not a
replacement for them (`docs/decisions/ADR-009-sandbox-origin.md:106`).

- **Proven:** the allowlist, CORS behavior, value-only wire protocol, API denial, and token absence are
  covered by automated Bun tests at the HTTP and handler layer
  (`docs/decisions/ADR-009-sandbox-origin.md:80-90, 100-102`).
- **Not measured:** packaged WebView2 origin isolation. Whether the installed WebView collapses the two
  loopback authorities, whether `crossOriginIsolated` and storage stay separate, and whether a
  credentialed API fetch from the sandbox origin is actually blocked in the packaged host are all
  unmeasured. Plan 017 is **BLOCKED** for its full done criteria until a WebView2 smoke matrix records
  those results (`docs/decisions/ADR-009-sandbox-origin.md:88-90, 103-112`).

Do not describe the sandbox as fully isolated, fully sandboxed, or exploit-proof. Until the packaged
matrix is green, it is defense-in-depth scaffolding whose HTTP-layer behavior is tested and whose
in-WebView authority separation is not. If the sandbox listener fails to bind, the UI falls back to a
same-origin Worker, which is explicitly degraded and not claimed isolated
(`src/ui/server.ts:440-445`; `docs/decisions/ADR-009-sandbox-origin.md:96-97`).
