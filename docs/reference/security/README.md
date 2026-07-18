---
id: reference/security/README
title: Security threat model and defense layers
audience: dev
summary: The assets vaud protects, the untrusted inputs it faces, and each defense layer with its honest tested or scaffolded status.
tags: [security, threat-model, sandbox, redos, sanitization, byok, loopback]
related:
  - reference/architecture
  - decisions/ADR-006-ai-and-agent
  - decisions/ADR-009-sandbox-origin
  - specs/engine/key-vault
---

# Security

vaud ingests untrusted files (character cards with embedded scripts, PNG and ZIP payloads, regex rules,
Risu Lua) and holds the user's provider API keys. Security is a first-class story, so this page states
each defense and its honest status: what is enforced and covered by a code-layer suite, versus what is
scaffolded but not yet measured. Overclaiming in a security document is a defect worse than a gap. Where
a defense is proven at only one layer, that is said in the same breath.

## Threat model

**Assets.** The user's provider API keys and connection secrets; the local filesystem and the studio
folder the user owns; the trusted UI origin and its per-launch session token; the user's machine and its
attention (availability).

**Adversary.** Content authored by someone else and opened by the user: a card whose fields carry
embedded scripts, a PNG or ZIP that may be a decompression bomb, a regex rule that may backtrack
catastrophically, a Risu Lua script. The transport is the user importing, editing, previewing, or
running that content, never a remote attacker reaching an exposed port. The server is loopback only, a
local forge, never an exposed service (`src/ui/server.ts:411`).

**Trust boundary.** Trust ends at every file and every request. Untrusted input is parsed once into the
canonical model, capabilities are denied by absence, and every gate fails closed. The two known-soft
edges are named explicitly below: packaged-host origin isolation is not yet measured (ADR-009), and the
key vault is a draft spec with no implementation in the tree.

@fig routes

## The layers

### 1. Parse, not execute

Every format converts through one canonical superset model, never format to format directly
(`docs/reference/architecture.md:9`). Import reads a file into that model; conversion is import then
export. A card's app-specific scripts, extension blocks, and layout are not first-class canonical
fields: they ride in the escrow envelope as opaque data (`docs/reference/architecture.md:55-72`). The
server evaluates nothing: scripts in entities are data, nothing is ever evaluated server-side
(`src/ui/server.ts:8-9`).

Cross-format conversion is contained-loss by design. Only the canonical body crosses; one app's private
junk, including any executable payload, is deliberately not copied into another app's file. vaud never
blind-copies one app's fields or executable payloads into another
(`docs/reference/architecture.md:70-72`). The adapter contract makes a cross-kind call unrepresentable,
so a lorebook can never be handed to a character writer (`docs/reference/architecture.md:104-111`).

Status: enforced by the adapter contract and the escrow envelope in `src/core`, and held by the
project-wide Round-Trip Law that same-format re-emit is byte-for-byte. This layer covers import and
conversion; the one place code does run is the Lua Test Bench, layer 5.

### 2. Decompression caps on archives

`src/core/archive.ts` inflates untrusted ZIP containers (charx, byaf, lumiverse, sprite packs) through
`unzipBounded`, which checks compressed size, original size, entry count, and aggregate size before
inflation where fflate's filter allows, then rechecks actual lengths after (`src/core/archive.ts:62-118`).
Card containers cap at 96 MiB archive, 512 entries, 64 MiB per entry, 96 MiB aggregate
(`src/core/archive.ts:30-36`); packs are tighter at 48 MiB and 256 entries (`src/core/archive.ts:39-45`).
A missing `originalSize` is treated as a lower bound, so a lying header still caps on compressed size
(`src/core/archive.ts:55-60`). Any breach throws `ArchiveLimitError`, and a required entry is never
silently dropped (`src/core/archive.ts:8-14`, `:66-104`).

Status: enforced pre-inflate and post-inflate; suite at `src/core/archive.test.ts`.

### 3. ReDoS-guarded regex

A synchronous JS `RegExp` cannot be interrupted mid-execution, so the only real defense against
catastrophic backtracking is refusing the dangerous pattern before it ever compiles
(`src/core/regex/validate.ts:6-9`). `validateRule` is that gate: it rejects patterns over a complexity
hard cap of 50 and rejects AST shapes proven dangerous (nested unbounded quantifiers, overlapping
alternation under a star, quantified backreferences), returning the culprit span
(`src/core/regex/validate.ts:19`, `:88-116`). `apply.ts` never runs a pattern this module rejects
(`src/core/regex/apply.ts:214-227`).

The engine adds a per-rule timeout (100ms default, 500ms max), a match cap of 1000, and a set-level time
budget (`src/core/regex/apply.ts:28-30`, `:41-46`). Read the limit honestly: that timeout guards the
match loop between and around matches (`src/core/regex/apply.ts:172-179`, `:183-190`). It cannot
interrupt a single pathological match inside one native `RegExp` call, which is exactly why the
pre-compile refusal in layer 3 is load-bearing, not the timeout.

`src/core/regex/ast/redos.ts` is a warning lens for the editor, tuned for precision over recall; it reads
structure and runs nothing, and it is not the gate (`src/core/regex/ast/redos.ts:6-9`, `:25`).

Status: enforced by `validateRule` before compile plus the runtime budgets; suites at
`src/core/regex/validate.test.ts`, `apply.test.ts`, and `ast/redos.test.ts`.

### 4. Sanitized rendering

Stored field markup is rendered through marked then DOMPurify, sanitizing last, and the output goes
straight to `innerHTML` with no post-sanitize mutation (`src/ui/_shared/render-markup.ts:9-11`). Active,
form, embedding, and auto-fetch tags are forbidden outright (`script`, `iframe`, `object`, `embed`,
`form`, `img`, `video`, `style`, and more, `src/ui/_shared/render-markup.ts:31-53`); data attributes are
off; anchors are re-hardened with a scheme allowlist and `rel`/`target`; fetch attributes are stripped
from any survivor (`src/ui/_shared/render-markup.ts:87-120`).

The security decisions live in a pure, DOM-free policy so they are testable without a DOM
(`src/ui/_shared/render-policy.ts:1-8`): a 200k input cap (`:20`), an http/https/mailto scheme allowlist
(`:66`), an inline-style property allowlist (`:85-92`), and a value filter that blocks `url()`, `var()`,
`@import`, and `expression()` indirection (`:98-99`). Sealed previews carry their own restrictive CSP as
the load-bearing egress barrier (`src/ui/_shared/render-policy.ts:83`); untrusted portrait bytes are
served with `content-security-policy: default-src 'none'; sandbox` and `nosniff`
(`src/ui/server.ts:320-327`).

Status: the pure policy has a suite at `src/ui/_shared/render-policy.test.ts`; the DOM half at
`render-markup.test.ts` runs client-side only.

### 5. The Lua sandbox and its resource budgets

Lua is the one untrusted input vaud executes, and it runs only when the user opens the Risu Test Bench,
never automatically on import (`docs/decisions/ADR-009-sandbox-origin.md:9-10`, `:40-41`).

**Capability by absence.** The wasmoon (PUC-Lua 5.4) engine opens no standard libraries by default and
loads only the pure set (base, table, string, math, coroutine, utf8), never io, os, debug, or package
(`src/sandbox/lua/engine.ts:13-21`). The bytecode and host-reaching base globals (`load`, `loadfile`,
`dofile`, `loadstring`, `require`, `collectgarbage`) are stripped after the libs open
(`src/sandbox/lua/engine.ts:23-24`, `:81-82`). Anything not injected as a capability does not exist in
the card (`src/sandbox/lua/engine.ts:5`, `:84`).

**Resource budgets.** Wall-clock timeout, Lua heap ceiling, source size, wire size, and per-field
host-state caps are typed and enforced (`src/sandbox/lua/limits.ts:1-8`, `:36-62`). Release defaults are
a 5s deadline, a 64 MiB heap, 2 MiB source, and a 2 MiB host-state footprint
(`src/sandbox/lua/limits.ts:69-88`). Callers may request lower values for adversarial tests; higher
values are clamped to these ceilings and never trusted upward (`src/sandbox/lua/limits.ts:66-68`,
`:160-244`).

**The real kill switch.** Each run happens in a Worker with a hard wall-clock deadline; when it hits, the
worker is terminated (`src/sandbox/lua/run-in-worker.ts:1-3`, `:179`, `:182-196`). Source and wire state
are validated against budgets before `postMessage`, and the function never hangs or throws
(`src/sandbox/lua/run-in-worker.ts:118`, `:132-134`).

**Value-only wire.** The parent-worker boundary is a versioned, value-only tagged union: JSON-like
primitives, arrays, and plain records only, with an allowlist of keys and an explicit forbidden-key set
covering token, cookie, authorization, and session spellings
(`src/sandbox/lua/protocol.ts:15-32`, `:138-184`). Every received message is validated and fails closed;
functions, handles, non-plain prototypes, and `__proto__`/`constructor` keys are rejected
(`src/sandbox/lua/protocol.ts:140`, `:161-184`). The per-launch API token never enters a message
(`src/sandbox/lua/run-in-worker.ts:11-12`, `:162-170`).

Status: budgets, worker kill, and the value-only protocol have suites at `src/sandbox/lua/limits.test.ts`,
`run-in-worker.test.ts`, and `protocol.test.ts`. These run in Bun. What is not yet proven for this layer
is the packaged-host origin boundary, layer 6.

### 6. Distinct-origin sandbox isolation (packaged-host proof BLOCKED)

ADR-009 adds a defense-in-depth origin boundary: a second loopback listener on an ephemeral port serves
only the worker bundle and `glue.wasm`, with no `/api`, no session token, no index HTML, and no studio
paths (`docs/decisions/ADR-009-sandbox-origin.md:45-62`; `src/ui/sandbox-host.ts:1-7`, `:30`, `:162-164`).
A same-origin Worker is an availability boundary, not an origin boundary, so this reduces blast radius if
a future engine, bundler, or WebView bug exposes web capabilities
(`docs/decisions/ADR-009-sandbox-origin.md:14-20`).

This is honest only when scoped. The origin separation is implemented and tested at the HTTP and handler
layer in Bun: the allowlist, the value-protocol reject cases, and token absence are automated
(`docs/decisions/ADR-009-sandbox-origin.md:80-87`). The packaged WebView2 origin probe,
`self.crossOriginIsolated` and storage visibility, and credentialed API fetch from the sandbox origin in
the installed host are not measured (`docs/decisions/ADR-009-sandbox-origin.md:88-90`). Plan 017 is
therefore BLOCKED for full Done criteria, and release notes must not claim full sandbox isolation
(`docs/decisions/ADR-009-sandbox-origin.md:104-112`).

If the sandbox listener fails to bind, the UI falls back to a same-origin worker on the primary server.
That mode is degraded and is explicitly not claimed isolated (`docs/decisions/ADR-009-sandbox-origin.md:96-97`;
`src/sandbox/lua/run-in-worker.ts:7-8`; `src/ui/server.ts:440-445`).

Status: HTTP-layer authority, allowlist, CSP, and CORS are automated; the packaged WebView2 origin proof
is not measured and remains BLOCKED.

### 7. Loopback-only, token-gated local server

The UI server binds `127.0.0.1` only (`src/ui/server.ts:425`). Security lives in
`src/ui/server-security.ts`: a per-launch bearer token from `randomBytes(32)`
(`src/ui/server-security.ts:26-32`); a Host check on every `/api` method and an Origin plus token check on
every POST, compared with `timingSafeEqual` (`src/ui/server-security.ts:200-230`, `:131-135`). The
Host/Origin gate exists to stop DNS-rebinding from attacker hostnames
(`src/ui/server-security.ts:45-48`). GET and HEAD cannot demand a token (an `<img src>` sends no headers),
so cross-site requests are refused via the browser-set `Sec-Fetch-Site` header instead
(`src/ui/server-security.ts:210-219`); a POST with a missing Origin fails closed
(`src/ui/server-security.ts:224`). Request bodies are capped (64 MiB inspect, 32 MiB JSON) with a
streaming reader that returns 413 on overflow (`src/ui/server-security.ts:14-15`, `:142-182`). Opening an
external link is POST-only, re-validated to http or https via `safeExternalUrl`, and spawned with an argv
array rather than a shell string (`src/ui/server.ts:347-360`; `src/ui/server-security.ts:264-276`).

Status: enforced in `server-security.ts`, extracted from the server specifically so the gate is unit
testable; the security surface is re-exported for tests (`src/ui/server.ts:56-68`).

### 8. BYOK key vault (designed, not yet built)

Everything in this layer is specification, not shipped code. `specs/engine/key-vault.md` is a draft for
milestone M2 (`specs/engine/key-vault.md:3-4`), it describes a `packages/ai` component that does not exist
in the current tree, and a search for its public surface (`KeyVault`, `getApiKey`, `redactSecrets`)
returns nothing. Treat the following as intent, measured by no test.

The design keeps keys local per ADR-006 (BYOK, no vaud-operated inference or proxy,
`docs/decisions/ADR-006-ai-and-agent.md:7-10`). It calls for two backends, the OS keychain where
available, else an AES-256-GCM encrypted file with a random local secret
(`specs/engine/key-vault.md:22-24`, `:84-101`), with owner-only file permissions and atomic writes. It
specifies a never-log-keys invariant enforced by a `redactSecrets` helper applied at the spill boundary,
and a type-level split between `ProviderConfig` (safe) and `ProviderSecret` (never logged)
(`specs/engine/key-vault.md:134-167`).

Status: designed only. Not implemented, not measured. No present-tense protection should be claimed for
key storage until the M2 vault ships with the redaction and never-log suites its own test plan names
(`specs/engine/key-vault.md:338-367`).

## Status at a glance

@fig status

## What this document does not claim

- Not "fully isolated" or "fully sandboxed." The Lua origin boundary is proven at the HTTP layer, not in
  the packaged WebView2 host; that proof is BLOCKED (`docs/decisions/ADR-009-sandbox-origin.md:104-112`).
- Not "cannot be exploited" or "completely safe." These layers reduce blast radius and fail closed; they
  are defense in depth, not a proof of impossibility.
- The regex per-rule timeout does not interrupt a single catastrophic native `RegExp` match. The
  pre-compile refusal is the actual defense (`src/core/regex/validate.ts:6-9`).
- The key vault's protections are specified, not implemented. Nothing in the tree stores keys yet.
- Where the sandbox listener cannot bind, the same-origin fallback is degraded and not isolated.
