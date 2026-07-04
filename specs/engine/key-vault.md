# Spec: Key Vault

**Package:** `packages/ai` · **Milestone:** M2 · **Status:** draft
**Depends on:** none (uses `ulid` id generation convention from `packages/core`, no schema coupling)
**VAUDEVILLE reference:** none direct. `apps/rc/src/lib/providers/crypto.ts` (RC's provider-config
encryption) is architecturally different — it is a server-mode/BIP39, browser-`CryptoKey`,
Postgres-backed scheme for a multi-tenant web app, not a local single-user OS-keychain/file
vault. Read for contrast only; nothing in it is ported. See "Sources consulted" for the
specific claims taken from it.

## Purpose

The key vault is where Vaudeville Studios stores BYOK provider credentials
(Anthropic, OpenRouter, OpenAI, Gemini, Ollama/OpenAI-compatible endpoints) and the
user's model-role mapping (which configured model handles interview turns, Doctor
treatment rewrites, Test Stage inference, and bulk audits). It is a `packages/ai`
component, has zero UI, and is consumed by the CLI (`vaud auth ...`), the agent loop,
and any feature that needs to make a model call. It never runs on a server: everything
lives on the user's machine, per ADR-006 (local-first, BYOK, no Vaudeville-operated
proxy). Two storage backends exist — the OS keychain where available, an
AES-encrypted file with a local secret everywhere else — selected automatically at
first use, with an explicit override. The vault's other job is enforcing the
never-log-keys rule: nothing that touches the vault may let a raw API key reach a log
line, an error message, an agent trace, or the spill store.

## Behavior

### Storage model

Two kinds of state, kept apart because only one of them is secret:

1. **Non-secret vault metadata** — `~/.vaud/vault.json`. Provider config records
   (id, provider kind, label, base URL, organization id, extra header *names* — never
   values that look like tokens) and the model-role mapping table. Plain JSON, safe to
   `cat`, safe to include in a bug report screenshot (labels/base URLs only).
2. **Secret material** — the API key string (and any `extraHeaders` values, since a
   header can itself carry a bearer token) for each provider config, keyed by the
   provider config's `id`. Lives only in one of the two backends below, never in
   `vault.json`.

`~/.vaud/` is outside any production folder, so it is never git-tracked and never
touched by the `.vaud/history/` snapshot mechanism (productions-and-history.md).

### Backend selection

On first vault use (`init()`), the vault probes for OS keychain support in this order:

1. Attempt to load the native keychain binding for the current platform (Windows
   Credential Manager / macOS Keychain / Linux Secret Service via libsecret).
2. If the binding loads and a trivial write-then-read round-trip on a canary entry
   (`service: "vaud", account: "__vaud_probe__"`) succeeds, backend = `os-keychain`.
3. Otherwise (binding missing, throws, or the platform has no Secret Service daemon
   running — common on headless Linux/WSL/containers), backend = `encrypted-file`,
   and the vault prints a one-time stderr warning explaining why, on the first CLI
   command of the session (`vaud: no OS keychain available, using encrypted file
   vault at ~/.vaud/vault.enc`).

The chosen backend is recorded in `vault.json` (`backend: "os-keychain" |
"encrypted-file"`) so subsequent runs don't re-probe unless the user forces it
(`vaud auth backend --use-file` / `--use-keychain`, or config key
`vault.backend` in `~/.vaud/config.json` — the config file itself is defined by
cli-ux.md, not this spec; not independently verified here, see Sources consulted).
Forcing
`os-keychain` when the probe previously failed re-runs the probe and errors clearly
if it still fails.

OPEN QUESTION: which native keychain binding ships (candidates found during spec
research: `keyring-node` via napi.rs, positioned as a maintained `keytar`-compatible
replacement — `keytar` itself is archived/unmaintained). Also open: whether that
native addon loads correctly inside a `bun build --compile` single-exe (ADR-003's
distribution model), since native `.node` addons are the traditional pain point for
single-binary bundlers. This must be resolved with a build spike before the M2
provider-adapters/vault ticket is sized, and the fallback-to-file path must work
regardless of the answer.

### OS keychain backend

One keychain entry per provider config secret: `service = "vaud"`,
`account = providerConfig.id`, secret = JSON-stringified `{ apiKey, extraHeaders? }`.
Keychains are the right place for this because the OS already handles
per-user-session unlock, and (on macOS/Windows) per-application access prompts.

### Encrypted-file backend

- `~/.vaud/vault.key` — 32 random bytes (`crypto.randomBytes(32)`), generated once on
  first fallback-backend use. File permissions restricted to the owner (`chmod 600`
  on POSIX; an ACL granting only the current user on Windows, applied via the same
  primitive the updater already needs for atomic-swap permission handling per
  ADR-003). This file is the "local secret" ADR-006/02-ARCHITECTURE.md refer to. It is
  never derived from a user-typed passphrase in v1 — see edge case 5 and the open
  question below on whether a passphrase-unlock mode is added later.
- `~/.vaud/vault.enc` — one AES-256-GCM–encrypted JSON blob:
  `{ providerConfigId: { apiKey: string, extraHeaders?: Record<string,string> } }`,
  encrypted with a fresh random 96-bit IV per write, key = `vault.key` contents
  directly (not passphrase-stretched, since `vault.key` is already high-entropy
  random bytes, not a passphrase — no KDF needed). Layout on disk:
  `{ iv: base64, ciphertext: base64 }` (ciphertext includes the GCM auth tag,
  matching Node's `crypto` module convention of appending `getAuthTag()` output).
- Writes are atomic: encrypt to `vault.enc.tmp`, `fsync`, rename over `vault.enc`.
  This is the same pattern the updater ADR uses for its self-swap and exists for the
  same reason — a crash mid-write must never corrupt the previous good state.

OPEN QUESTION: whether a v1.1 passphrase-unlock mode (derive the AES key from a
user passphrase via scrypt/argon2 instead of a random local file) is worth adding for
users who explicitly don't trust local-file-permission-only protection (e.g. shared
machines). Not required for M2; ADR-006 only commits to "encrypted file."

### Provider configs

A `ProviderConfig` is one saved credential + connection info for one provider
"slot." A user can have multiple configs for the same provider kind (e.g. two
OpenRouter keys under different labels, or several OpenAI-compatible local servers).
Fields: `provider` (one of the ADR-006 launch set: `anthropic`, `openrouter`,
`openai`, `gemini`, `openai-compatible` — the last one covers Ollama/LM Studio/
koboldcpp per ADR-006 §1, distinguished from the frontier providers only by requiring
`baseUrl`), `label` (user-chosen display name), `baseUrl` (required for
`openai-compatible`, optional override for the others), `organizationId` (OpenAI
only, optional), `extraHeaders` (optional, for providers/proxies needing custom
auth headers beyond a bearer token).

### Model-role mapping

Per ADR-006 §4, four roles plus a fallback: `interview`, `treatment`, `test`,
`audit`, `default`. Each role maps to at most one `{ providerConfigId, model,
params? }` tuple at a time. `resolveRole(role)` looks up the role directly; if
unmapped, it falls back to the `default` role's mapping; if `default` is also
unmapped, it returns `null` and the caller (CLI or agent loop) is responsible for
prompting the user to configure a key — this is "the first key ask happens at the
first AI moment, never at install" from ADR-006 §2. Nothing in the vault itself
blocks non-AI commands; `listProviderConfigs()`/`getModelRoleMapping()` work with
zero configs.

### Never-log-keys rule

This is a hard invariant, not a style preference, because vault consumers include
the agent loop, whose tool traces and transcripts are things users may paste into
bug reports or share:

1. `getApiKey(id)`, `getSecret(id)`, and `resolveRole(role)` are the only three
   functions in the public surface that return raw key material (the latter two
   because callers that need to make a provider call need the full `ProviderSecret`,
   not just the bearer token). Every other read path (`listProviderConfigs`, any
   `toString`/`toJSON` on a `ProviderConfig`, CLI table output, agent resource reads
   over `vaud://`) returns/serializes provider configs with `apiKey` and
   `extraHeaders` values omitted entirely — not masked with a partial suffix,
   omitted, because a masked suffix is still key material and this project would
   rather be over-cautious. Consumers of these three functions (provider adapters,
   the agent loop's request-building step) are responsible for never letting the
   resulting `ProviderSecret` reach a log line, trace segment, or the spill store —
   see point 2a.
2. Provider adapters (provider-adapters.md) receive the resolved key as a function
   parameter at call time and must not embed it in any object that flows into a log
   sink, the spill store, or an agent trace segment.
2a. The spill store (agent-loop.md) must refuse to persist any object containing an
    `apiKey` or `extraHeaders` key to disk; this is enforced by a shared redaction
    helper (`redactSecrets(obj)`) the vault package exports, applied at the spill
    boundary, not trusted to each caller individually.
3. CLI: `vaud auth add` prompts for the key via hidden/non-echoing input and never
   prints it back, including in `--json` output. `vaud auth list` shows
   provider/label/base URL/backend only.
4. Any error thrown by the vault (`VaultError`) carries `providerConfigId` and
   `label`, never the key, even in `DECRYPT_FAILED` cases where including the
   ciphertext would be harmless but the surrounding code path is exactly the kind of
   place a stray `console.log(config)` during debugging would leak a key — so the
   convention is enforced at the type level: `ProviderConfig` (safe) and
   `ProviderSecret` (`{ apiKey, extraHeaders? }`, never logged) are distinct types,
   and only `getApiKey`/backend-internal code ever holds a `ProviderSecret`.

## Public API sketch

```ts
// packages/ai/src/vault/types.ts

export type ProviderKind =
  | "anthropic"
  | "openrouter"
  | "openai"
  | "gemini"
  | "openai-compatible"; // Ollama / LM Studio / koboldcpp / any compatible endpoint

export interface ProviderConfig {
  id: string;               // ulid, assigned on add()
  provider: ProviderKind;
  label: string;
  baseUrl?: string;          // required when provider === "openai-compatible"
  organizationId?: string;   // openai only
  extraHeaderNames?: string[]; // names only; values live in ProviderSecret
  createdAt: string;         // ISO
  updatedAt: string;         // ISO
}

// Secret material. Never logged, never serialized outside the vault backends.
export interface ProviderSecret {
  apiKey: string;
  extraHeaders?: Record<string, string>;
}

export type ModelRole = "interview" | "treatment" | "test" | "audit" | "default";

export interface ModelRoleMapping {
  role: ModelRole;
  providerConfigId: string;
  model: string;
  params?: { temperature?: number; maxTokens?: number; [k: string]: unknown };
}

export interface ResolvedRole {
  role: ModelRole;
  usedFallback: boolean;   // true if resolved via "default" rather than the exact role
  config: ProviderConfig;
  secret: ProviderSecret;
  model: string;
  params?: ModelRoleMapping["params"];
}

export type VaultBackend = "os-keychain" | "encrypted-file";

export class VaultError extends Error {
  code:
    | "NOT_FOUND"
    | "BACKEND_UNAVAILABLE"
    | "DECRYPT_FAILED"
    | "ALREADY_EXISTS"
    | "VALIDATION";
  providerConfigId?: string;
  affectedRoles?: ModelRole[]; // set on VALIDATION errors from removeProviderConfig(force:false)
}

export interface KeyVault {
  init(): Promise<{ backend: VaultBackend }>;

  listProviderConfigs(): Promise<ProviderConfig[]>;
  getProviderConfig(id: string): Promise<ProviderConfig>; // throws NOT_FOUND

  // config.extraHeaderNames is derived by the vault from Object.keys(secret.extraHeaders)
  // if omitted; callers do not need to keep the two in sync by hand.
  addProviderConfig(
    config: Omit<ProviderConfig, "id" | "createdAt" | "updatedAt" | "extraHeaderNames">,
    secret: ProviderSecret
  ): Promise<ProviderConfig>;

  updateProviderConfig(
    id: string,
    patch: Partial<Omit<ProviderConfig, "id" | "createdAt" | "updatedAt">>
  ): Promise<ProviderConfig>;

  rotateSecret(id: string, secret: ProviderSecret): Promise<void>;

  // force=false (default): throws VaultError("VALIDATION") naming the affected
  // roles in `affectedRoles` if any ModelRoleMapping references this id, deletes
  // nothing. force=true: deletes and resolves with the affected roles (which are
  // now dangling — see edge case 7) so the caller can warn the user.
  removeProviderConfig(
    id: string,
    opts?: { force?: boolean }
  ): Promise<{ affectedRoles: ModelRole[] }>;

  getApiKey(id: string): Promise<string>; // the ONLY function returning raw key material
  getSecret(id: string): Promise<ProviderSecret>;

  listModelRoleMappings(): Promise<ModelRoleMapping[]>;
  getModelRoleMapping(role: ModelRole): Promise<ModelRoleMapping | null>;
  setModelRoleMapping(mapping: ModelRoleMapping): Promise<void>;
  clearModelRoleMapping(role: ModelRole): Promise<void>;

  resolveRole(role: ModelRole): Promise<ResolvedRole | null>;

  wipe(): Promise<void>; // removes both backends' state entirely, `vaud auth wipe`
}

export function redactSecrets<T>(value: T): T; // deep-strips apiKey/extraHeaders-shaped keys
```

## Edge cases & failure modes

1. **No OS keychain available** (headless Linux, no Secret Service daemon,
   container). Vault falls back to `encrypted-file` automatically, one-time stderr
   warning, no crash.
2. **Native keychain binding fails to load inside the compiled `vaud` binary**
   (`bun build --compile`, ADR-003). Same fallback as #1. This must be verified as
   part of the M2 vault ticket, not assumed — see the OPEN QUESTION under Behavior.
3. **Both backends have data** (e.g. user copied `~/.vaud/` between machines with
   different keychain availability, or previously forced file mode then got keychain
   working). `os-keychain` wins if the probe succeeds; the vault does not silently
   merge. `vaud auth migrate --to keychain|file` performs an explicit, logged
   (non-secret-logging) migration and only then deletes the source backend's data.
4. **Corrupted `vault.enc`** (partial write from a crash, disk corruption). GCM auth
   tag check fails on decrypt. Vault refuses to load, does not delete the file,
   raises `VaultError("DECRYPT_FAILED")` with guidance to restore from a backup or
   run `vaud auth wipe` and re-add keys. Never silently proceeds with an empty vault.
5. **`vault.key` missing but `vault.enc` present** (key file deleted, `.vaud/`
   partially restored from an old backup). Same `DECRYPT_FAILED` path as #4 — the
   vault cannot distinguish "wrong key" from "missing key" and must not try to
   regenerate a key and silently discard the encrypted blob.
6. **`resolveRole` targets a provider config that no longer exists** (vault.json and
   the secret backend fell out of sync, e.g. manual edits). Throws
   `NOT_FOUND` with the dangling `providerConfigId`; caller (CLI/agent) surfaces
   "role X points at a deleted provider config, run `vaud auth roles`."
7. **Deleting a provider config that role mappings reference.**
   `removeProviderConfig` without `force: true` throws `VaultError("VALIDATION")`
   with `affectedRoles` naming which roles would break, and deletes nothing; with
   `force: true` it deletes the secret and config, resolves with `{ affectedRoles }`
   so the caller can warn the user, and leaves the now-dangling role mappings in
   place (caught lazily by edge case 6 on next resolve) rather than silently
   rewriting the user's role mapping.
8. **One provider config used by multiple roles.** Allowed; no uniqueness
   constraint between `ModelRoleMapping.providerConfigId` values.
9. **Key rotated mid-agent-turn.** `rotateSecret` only affects future
   `getApiKey`/`resolveRole` calls; a request already in flight with the old key
   completes with the old key. No forced session restart.
10. **Concurrent `vaud` processes** (CLI command + a running agent REPL, or CLI +
    Studio once M6 lands) writing `vault.json`/`vault.enc` at once. All writes are
    atomic (temp file + rename, edge case matches the encrypted-file write path
    above); last writer wins for `vault.json`. No cross-process locking in v1 — this
    is a single-user local tool, not a multi-writer database.
11. **OS keychain per-entry size limits** (Windows Credential Manager traditionally
    caps around 2.5KB per credential blob). If a `ProviderSecret` (key +
    `extraHeaders`) would exceed the active backend's practical limit, `init`/`add`
    must detect this and fall back to the encrypted-file backend for that entry
    rather than truncate or silently fail. OPEN QUESTION: exact per-platform
    thresholds and whether the fallback is per-entry (mixed backends) or forces the
    whole vault to file mode — needs a decision before implementation, default to
    "whole vault" for simplicity unless a real fixture proves the split is needed.
12. **CI/headless scripting without a keychain session and without wanting to touch
    `~/.vaud` at all** (e.g. running `vaud convert` in CI, which needs no key, is
    already fine per ADR-006 §2). For AI commands in CI, OPEN QUESTION: whether an
    environment-variable override (e.g. `VAUD_API_KEY_<PROVIDER>`) bypassing the
    vault entirely is supported in v1. Not committed by ADR-006; flag for the M2
    ticket to decide.
13. **`vaud auth wipe`** must remove keychain entries for every known provider
    config id AND delete `vault.json`/`vault.enc`/`vault.key`, and must not error if
    some of those are already absent (idempotent).
14. **Role unmapped and no `default` mapping.** `resolveRole` returns `null`
    (not an error) — this is the expected "no AI configured yet" state ADR-006 §2
    describes, and callers turn it into the first-key-ask UX, not a crash.

## Test plan

- No format fixtures apply (this is not a codec); tests are behavioral/unit against
  both backends.
- `packages/ai/src/vault/__tests__/encrypted-file-backend.test.ts`: round-trip
  add/get/rotate/remove against a temp `~/.vaud`-equivalent directory; corrupted
  ciphertext produces `DECRYPT_FAILED` (edge case 4); missing `vault.key` produces
  `DECRYPT_FAILED` (edge case 5); atomic write survives a simulated crash between
  temp-file write and rename (assert the pre-write file is untouched if rename is
  interrupted).
- `packages/ai/src/vault/__tests__/os-keychain-backend.test.ts`: mocked native
  binding (no real OS keychain in CI); verifies the probe/fallback logic (edge cases
  1-2) by making the mock throw/succeed in each configuration.
- `packages/ai/src/vault/__tests__/model-role-mapping.test.ts`: exact-role resolve,
  fallback-to-default resolve, unmapped-and-no-default returns null (edge case 14),
  dangling providerConfigId on resolve throws NOT_FOUND (edge case 6).
- `packages/ai/src/vault/__tests__/redaction.test.ts`: `redactSecrets` strips
  `apiKey`/`extraHeaders` from nested objects and arrays; a snapshot test asserts no
  string matching a seeded fake API key ever appears in the JSON-stringified output
  of any public `KeyVault` method except `getApiKey`/`getSecret`.
- `packages/ai/src/vault/__tests__/never-log.test.ts`: spy on `console.log`/
  `console.error`/`console.warn` for the duration of a full add -> rotate -> remove
  -> wipe cycle using a seeded fake key string; assert the fake key string never
  appears in any captured log call.
- Integration: `apps/cli/src/commands/__tests__/auth.test.ts` drives `vaud auth add
  / list / remove / wipe` end to end against the file backend (CI has no real
  keychain) and asserts `--json` output never contains key material. `vaud auth test`
  (the connectivity check) is exercised in provider-adapters.md's test plan, not
  here, since it is not a vault method — this file only asserts that
  `vault.getSecret()` returns a usable `ProviderSecret` for a config the command
  would pass along.
- Round-Trip Law: not applicable (no serialize-back-to-source-format concept here).

## Non-goals

- Not a general-purpose secrets manager for arbitrary user secrets — scoped to
  provider credentials and role mappings for `packages/ai`.
- No cloud sync, no Vaudeville-operated key escrow or recovery service (consistent
  with "no Vaudeville-operated inference, no account, no proxy server," ADR-006 §1).
  Losing both `~/.vaud/vault.key` and the OS keychain entries means re-entering keys;
  this is by design, not a bug to fix later.
- Does not validate that a stored key actually works. There is no
  `testProviderConfig` method on `KeyVault` — `vaud auth test` (test plan below) is a
  CLI-level composition of `vault.getSecret()` plus a minimal request built by
  provider-adapters.md, not a vault capability. The vault's job is storage and
  resolution, not provider health.
- Does not implement the provider adapters themselves (ChatRequest/ChatResponse,
  streaming, tool-use fallback) — that is provider-adapters.md. This spec only
  covers how their credentials are stored and resolved.
- No multi-user / multi-profile vault in v1 (one `~/.vaud/` per OS user account).

## Sources consulted

- `docs/00-MASTER-PLAN.md` — locked decision "AI = BYOK + local," M2 milestone
  scope ("providers; vault; loop skeleton...").
- `docs/02-ARCHITECTURE.md:23-25` — `packages/ai` description: "key vault (OS
  keychain + encrypted file)"; `:85-90` Security & privacy invariants: "Keys: OS
  keychain where available, else AES-encrypted file with local secret," "No network
  calls except: model providers the user configured."
- `docs/decisions/ADR-006-ai-and-agent.md` — full text read; specifically §1 (BYOK
  provider list, "Keys in the local vault (OS keychain, else encrypted file)"), §2
  (AI optional, first key ask at first AI moment), §4 (model roles: interview,
  treatment, test-stage inference, bulk audits, per-role model mapping, "sane
  single-model default").
- `docs/06-PRODUCTION-BIBLE.md:64` — brief row for this file: "OS keychain vs
  encrypted-file fallback, per-provider configs, model-role mapping
  (interview/treatment/test/audit), never-log-keys rule. Ground truth: ADR-006."
- `docs/06-PRODUCTION-BIBLE.md:73` — cli-ux.md brief mentions "config file
  (~/.vaud/config.json)" as that spec's territory; referenced here by name only,
  not read, since `vault.backend`'s exact key path is cli-ux.md's call to make.
- `specs/formats/canonical-model.md` — shared entity envelope pattern (id/meta
  shape) used as the convention for `ProviderConfig.id`/timestamps; confirmed no
  canonical-model coupling is required for the vault (it is not a codec/canonical
  entity).
- `specs/formats/escrow-and-roundtrip.md` — confirmed as not applicable to this spec
  (no source-format round trip involved).
- `templates/SPEC-TEMPLATE.md` — structure followed section-by-section.
- `C:\Users\chiev\Documents\VAUDEVILLE\apps\rc\src\lib\providers\crypto.ts` (read in
  full) — used only to confirm that RC's existing provider-key encryption is a
  different problem (server-stored, BIP39/WebCrypto, client-decrypts-per-request,
  multi-tenant web app) and therefore not portable ground truth for a local,
  single-user, OS-keychain-first vault; cited here so the "none direct" reference
  claim above is verifiable rather than asserted.
- Web research (technology landscape, not format facts, used only to inform the
  OPEN QUESTION on native keychain bindings): search "Node.js Bun cross platform OS
  keychain library keytar alternative 2026" surfaced `keytar` (atom/node-keytar,
  archived/unmaintained) and `keyring-node` (Brooooooklyn/keyring-node, napi.rs
  binding, described as a compatible keytar replacement) as the current candidates;
  neither is adopted by this spec, both are left as an open implementation decision.
