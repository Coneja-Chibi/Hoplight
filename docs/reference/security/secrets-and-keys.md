---
id: reference/security/secrets-and-keys
title: Secrets, provider credentials, and local API authority
audience: dev
summary: How Kit encrypts BYOK provider configurations, constrains provider egress, and how the Studio gates its local API with a per-launch bearer plus Host and Origin checks.
tags: [security, byok, keys, vault, loopback, csp]
related: [reference/architecture, reference/concepts/safe-rendering, reference/cli]
---

# Secrets and keys

This page covers three separate authorities: Kit's encrypted provider vault, provider egress locked to
the endpoint the user configured, and the Studio's per-launch local API bearer. Where a defense is
incomplete or not measured in the packaged host, this page says so in the same section. See
`@fig defenses` for the whole picture at a glance.

@fig defenses

## Kit provider vault (shipping source preview)

Kit is bring-your-own-provider. Importing, editing, inspecting, validating, converting, and deterministic
analysis do not need a key. Provider-backed turns use the provider or OpenAI-compatible endpoint the user
selected; Hoplight operates no inference account or proxy. The current provider roster is discovered from
`src/kit/providers/spokes/`, and unknown providers or keyed providers without a key fail before a request is
made (`src/kit/providers/adapters.ts:12-31`; `src/kit/providers/egress.ts:18-29`).

This is shipping source, but Kit itself is still a source-checkout preview. Run it with `bun run kit`.
`package.json` is private and exposes that source entry, while the GitHub release workflow currently
publishes `Hoplight.exe` and the `hoplight-*` CLI binaries, not a Kit binary (`package.json:4-15`;
`.github/workflows/release.yml:47-105, 148-161`).

### What the vault seals

Saved providers live at `~/.hoplight/kit-vault.json`, or under `HOPLIGHT_HOME` when that override is set
(`src/kit/providers/config.ts:31-35`). The current implementation does **not** split public metadata from
secret material. It encrypts the whole `Vault` document: every saved `ProviderConfig`, including its API
key, base URL, extra headers, options, and label, plus the active provider id. The file on disk contains
only a versioned `{ v, backend, payload }` envelope. A round-trip test proves that neither the API key nor
the provider name appears in that file as plaintext (`src/kit/providers/vault.ts:13-18, 81-99`;
`src/kit/providers/vault.test.ts:40-51`).

The decrypted provider list is cached in process memory after the first successful open. Writes encrypt a
temporary sibling, apply owner-only mode `0600` where the platform supports it, and rename it over the
vault. That protects the prior file from a partial write, but the implementation does not currently fsync
the temporary file or its directory (`src/kit/providers/vault.ts:20-33, 81-92`).

### Backends and present platform boundary

The security-owned registry has three explicit backends, in seal-priority order. Opening an existing blob
always uses the backend id recorded in that blob; it never tries a different backend after a failure
(`src/kit/keystore/registry.ts:1-30`; `src/kit/keystore/keystore.ts:9-23`).

1. **Windows DPAPI.** On Windows, the vault is sealed with `ProtectedData` in `CurrentUser` scope. The
   plaintext travels to a hidden, non-interactive PowerShell child over stdin as base64, not in process
   arguments. The result can be opened only by the same Windows user context
   (`src/kit/keystore/backends/dpapi.ts:1-6, 33-66`).
2. **Local key file.** The universal fallback, selected wherever no OS-native backend can run. Kit
   generates a 256-bit key on first use and stores it at `~/.hoplight/kit.identity` as a versioned
   104-byte blob with an HMAC integrity check, owner-only mode `0600` where the filesystem supports it.
   The vault is then encrypted with AES-256-GCM under that key. The key is re-read per operation and
   never held in memory, so a file moved or deleted underneath a running Kit is noticed rather than
   silently sealed against a key that no longer exists on disk
   (`src/kit/keystore/backends/identity-file.ts:1-40, 120-190`; `src/kit/keystore/aes.ts:26-42`).
3. **Master passphrase.** Derives a 256-bit key with scrypt from a caller-supplied passphrase, using a
   fresh random salt. It reports itself **unavailable** so it is never auto-selected, because nothing in
   Kit collects a passphrase; it stays registered so a vault already sealed with it still opens
   (`src/kit/keystore/backends/passphrase.ts:1-6, 41-52`).

**The local key file is deliberately weaker than DPAPI and is labeled as such.** Its key sits on disk
beside the vault it opens, so any reader of the vault can also read the key. It defends against
exposure - a credential surviving as plaintext in a backup, a synced folder, or a casual scan - not
against an attacker who already holds the user's account. It ranks below every OS-native backend for
exactly that reason. macOS Keychain and Linux Secret Service backends are not implemented; on those
platforms the local key file is what runs today.

Every write verifies its own seal before committing: `writeVault` re-opens the sealed blob and compares
it to the plaintext before renaming over the live vault, so a change of backend between saves fails as
a rejected write rather than silently replacing readable keys with unreadable ones
(`src/kit/providers/vault.ts:81-96`).

The Kit settings screen still calls the vault without an `Unlock` and has no passphrase prompt
(`src/kit/render/settings/settings-screen.tsx:37-52, 105-145`); with the local key file in the roster
that is no longer a platform blocker, since selection resolves to a backend needing no input. On any
platform, familiar provider environment variables can supply an active provider without writing it to
the vault at all (`src/kit/providers/config.ts:37-55`; `src/kit/providers/vault.ts:65-68`).

### Provider egress boundary

Every provider spoke receives the same guarded fetch. A built-in spoke fixes its provider host; a custom
or local spoke derives one host from the configured base URL. Before the network, Kit rejects an unknown
provider, a missing required key, or a request whose URL host differs from that one allowed host
(`src/kit/providers/egress.ts:18-55`; `src/kit/providers/adapters.ts:12-31`). Model discovery uses the
same gate.

A provider credential necessarily travels to that configured endpoint as request authentication. It is
not added to the model conversation, tool observation, session transcript, canonical entity, or export.
The model does receive the conversation and any studio or documentation observations Kit reads to answer
the user's request. `/privacy` records the provider and token counts for each send, not the request body
or credential (`src/kit/providers/egress-ledger.ts:1-8, 69-80`).

The host check covers the request URL handed to guarded fetch. The wrapper currently delegates redirect
handling to the runtime and does not manually inspect each redirect hop
(`src/kit/providers/egress.ts:40-55`). Do not describe it as a redirect-by-redirect allowlist until that
behavior is implemented and tested.

### Recovery limitations

Vault encryption is intentionally fail-closed once a valid sealed envelope reaches its backend: an
unknown backend tag throws, DPAPI decryption failure throws, and a wrong passphrase or failed GCM
authentication throws (`src/kit/keystore/keystore.ts:15-18`; `src/kit/keystore/keystore.test.ts:18-52`).
DPAPI also binds recovery to the Windows user context. There is no vault export, recovery-key, backend
migration, or credential-rotation flow today. Losing the Windows profile means re-entering the provider
configuration.

**One documented exception, and only one.** A local key file that is structurally invalid - wrong size,
wrong magic, wrong version, or a failed HMAC - is holding a key that is already unrecoverable, so the
vault sealed under it cannot be opened by any caller, retry, or passphrase. Failing closed there would
protect nothing while leaving the user permanently unable to save a provider. Kit therefore moves the
damaged file aside under a dated `.damaged-*` name, writes a fresh key, moves the now-unopenable vault
aside as `.unopenable-*`, and returns an empty vault carrying a `notice` that names both paths. Neither
file is deleted, so recovery from the original bytes remains possible, and the settings screen surfaces
the notice rather than showing an unexplained empty list
(`src/kit/keystore/backends/identity-file.ts:120-190`; `src/kit/providers/vault.ts:44-84`;
`src/kit/providers/vault-recovery.test.ts`).

This applies to structural damage only. An I/O failure such as a permissions error or a disconnected
mount may succeed on retry, so it is surfaced rather than treated as damage - replacing a key because a
volume was briefly unreadable would cause exactly the loss this is meant to avoid. Any other unopenable
vault, including tampered ciphertext under a healthy key or a vault from another Windows profile, still
throws and is left untouched on disk.

One weaker edge remains: `readSealed` currently treats an unreadable file, malformed outer JSON, or an
object that is not a sealed envelope as if no vault existed. Only a well-shaped envelope that fails to
decrypt reaches the loud failure path (`src/kit/providers/vault.ts:25-33, 71-79, 95-99`). Until the read
boundary distinguishes "missing" from "present but unreadable," users should not be told that every form
of vault corruption is surfaced.

## The loopback server (shipping)

The visual app runs a local server bound to `127.0.0.1` only: `Bun.serve({ port, hostname: "127.0.0.1",
... })` (`src/ui/server.ts:456-462`). It is a thin shell over the same engine the CLI uses. Nothing in an
uploaded entity is ever evaluated server-side; scripts inside cards are data
(`src/ui/server.ts:1-12`).

### The per-launch bearer

A fresh bearer token is minted once per launch: `randomBytes(32).toString("base64url")`, created in
`createSecurityContext` and marked "never log or persist" (`src/ui/server-security.ts:17-32`). It is
injected into served HTML as an escaped `<meta name="vaude-session">` tag by `injectSessionMeta`
(`src/ui/server-security.ts:102-111`), which the trusted UI reads to authenticate its own API calls. The
token stays in that meta tag and the trusted `apiFetch` path; it is never handed to the sandbox origin
(see below, and `src/ui/sandbox-host.ts:124-128, 196-197`). The bearer-bearing index document is not
itself bearer-gated; the default listener's loopback bind is what limits which machines can fetch it.

### The /api/* gate

Every `/api/*` route runs through `checkApiRequest` before any handler
(`src/ui/server.ts:180-191`, definition `src/ui/server-security.ts:199-230`). The gate is scoped to
`/api/*`. JavaScript, wasm, CSS, and icons are non-secret assets and serve without this gate. `/` and
`/index.html` also serve without it, but they are a different case: `createHandler` injects the
per-launch bearer into that HTML before returning it (`src/ui/server.ts:130-141, 170-178`). The default
listener therefore relies on its `127.0.0.1` bind to keep the token-bearing shell off other machines.
Any local process or other client that can reach that listener can fetch the HTML and read its bearer;
the bearer is not an authentication gate for the page that contains it.

`checkApiRequest` enforces, in order:

1. **Fail closed before bind.** If the expected Host, expected Origin, or token is not yet filled in, it
   returns `503` (`src/ui/server-security.ts:204-206`).
2. **Host on every method.** `hostAllowed` accepts an exact `host:port` match, or a loopback-equivalent
   spelling (`127.0.0.1`, `localhost`, `[::1]`) **on the same port**; anything else returns `403`
   (`src/ui/server-security.ts:51-64, 207-208`). This is the DNS-rebinding defense: it rejects requests
   whose Host is an attacker-controlled hostname resolved to loopback.
3. **GET and HEAD carry no token.** An `<img src>` sends no custom headers, so demanding a token on reads
   would leave image loads usable as a blind existence oracle. Instead these methods are refused only
   when `Sec-Fetch-Site` is `cross-site`, a browser-set header a page cannot forge
   (`src/ui/server-security.ts:210-219`).
4. **POST and PATCH demand Origin and token.** The Origin must be loopback-equivalent to the expected origin, and
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
  `Sec-Fetch-Site` passes the read gate (`src/ui/server-security.ts:210-218`). The read gate is
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
(`src/ui/sandbox-host.ts:201-217`; `docs/decisions/ADR-009-sandbox-origin.md:44-62`). This is
defense-in-depth: a same-origin Worker is a killable thread, not an origin boundary, so if a future
WebView or bundler bug exposed web capabilities, same-origin placement would widen the blast radius
(`docs/decisions/ADR-009-sandbox-origin.md:14-20`).

The sandbox host fails closed by construction:

- It serves only `/sandbox/worker.js`, `/sandbox/regex-worker.js`, and `/sandbox/glue.wasm`; every other path returns a `404` with a
  locked-down CSP (`SANDBOX_ALLOWLIST`, `deny`, `src/ui/sandbox-host.ts:29-57, 136-198`). No `/api`, no
  index HTML, no session token, no traversal aliases.
- CORS is limited to the exact UI origin (plus its loopback aliases) so only the trusted UI can construct
  the cross-origin module Worker (`src/ui/sandbox-host.ts:36-45, 124-154`).
- The API token is never injected into anything this host serves
  (`src/ui/sandbox-host.ts:124-128, 196-197`; `docs/decisions/ADR-009-sandbox-origin.md:53-56`).

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
(`src/ui/server.ts:464-479`; `docs/decisions/ADR-009-sandbox-origin.md:96-97`).
