---
id: reference/security/script-sandbox
title: The Lua script sandbox
audience: dev
summary: How vaud runs an untrusted card script in a terminable worker on a distinct loopback origin, behind a versioned value-only wire protocol and resource budgets that clamp downward only, with an honest account of what is enforced versus what is not yet measured.
tags: [security, sandbox, lua, worker, isolation, protocol, resource-limits, adr-009]
related: [reference/concepts/safe-rendering, reference/entities/character, reference/formats/risu, reference/architecture]
---

# The Lua script sandbox

Character cards can carry executable content: Risu trigger scripts, virtual scripts, and low-level
Lua. vaud ingests those from untrusted files and never runs them on import. A script only executes
when the operator deliberately puts it on the Workshop Test Bench, and even then it runs inside a
layered sandbox: a terminable worker, on a distinct loopback origin, behind a value-only wire
protocol, under resource budgets that can only be tightened, not loosened.

This page describes what the code enforces. It is deliberately honest about what is not yet proven.
Origin isolation is implemented and unit-tested at the HTTP and handler layer, but the packaged
WebView2 host that ships to users is not yet measured. Per ADR-009 that acceptance is BLOCKED (Plan
017), so this page does not claim full isolation anywhere. See [What is not yet proven](#what-is-not-yet-proven).

@fig lifecycle

## Scripts are data until you stage them

Card behavior rows are classified, never executed. The classifier core states this plainly: it splits
a condition or effect row into a known or advanced shape and nothing more, `Nothing here executes
anything; rows are data` (`src/entities/character/behavior.ts:6`). The import receipt tells the
operator the same thing: a card that carries scripts is flagged, and the scripts are `saved as text
and will never run unless you put them on the test stage` (`src/ui/receipt.ts:86`).

## Worker isolation (the kill switch)

Each run happens in its own Worker, and the real stop mechanism is termination. `runLuaSandboxed`
is documented to `Never hang, never throw` (`src/sandbox/lua/run-in-worker.ts:118`): it spawns a
module worker (`run-in-worker.ts:173`), arms a host wall-clock timer, and on either completion or
deadline calls `worker.terminate()` before resolving (`run-in-worker.ts:175-181`). If the deadline
fires first, the worker is terminated mid-run and the result is a `timeout`
(`run-in-worker.ts:182-196`).

The timeout is enforced twice. Inside the VM, wasmoon's `functionTimeout` aborts a pure-Lua infinite
loop with a `LuaTimeoutError` (`src/sandbox/lua/engine.ts:30-31`, wired at `engine.ts:76`). Outside
the VM, the host timer terminates the whole worker thread regardless of what the Lua is doing
(`run-in-worker.ts:182-196`). A same-origin worker is, in ADR-009's words, `an availability boundary
(killable thread), not an origin boundary` (`docs/decisions/ADR-009-sandbox-origin.md:15-16`); the
termination path is that availability boundary, and it holds independently of the origin question
below.

Each run carries a monotonic run id (`run-in-worker.ts:139`). A response whose `runId` does not match
the run in flight is dropped as `stale / spoofed generation` (`run-in-worker.ts:200`).

## The distinct sandbox origin (ADR-009)

The worker bundle and its wasm glue are served from a second loopback listener bound to an ephemeral
port, which yields a distinct origin from the UI and `/api/*`
(`docs/decisions/ADR-009-sandbox-origin.md:43-62`). That sandbox-only server serves only
`GET /sandbox/worker.js` and `GET /sandbox/glue.wasm`, and must not expose `/api`, studio paths,
index HTML carrying the session token, or source maps (`ADR-009:49-56`). The sandbox origin is
published to the UI as `meta[name="vaude-sandbox-origin"]`; the per-launch API token stays only in
`meta[name="vaude-session"]` and the trusted `apiFetch` path (`ADR-009:56`).

The browser resolver reads that meta and prefers the sandbox origin. `readSandboxOrigin` accepts a
value only when it starts with `http://127.0.0.1:` (`run-in-worker.ts:66-75`). `workerHref` loads the
worker from that origin when present; when the meta is absent it falls back to the same-origin
`/sandbox/worker.js`, which the code and ADR both mark as `degraded; not claimed isolated`
(`run-in-worker.ts:77-86`, `ADR-009:96-97`). The intent of the distinct origin is blast-radius
reduction: if a future engine, bundler, WebView, or bridge bug exposed web capabilities, a
same-origin worker could reach same-origin APIs, storage, or credentials, whereas a distinct origin
cannot (`ADR-009:9-18`). This is defense-in-depth architecture, not evidence of a current same-origin
exploit (`ADR-009:20`).

The distinct-origin design is real and is tested at the Bun HTTP and handler layer. It is not yet
measured in the packaged WebView2 runtime. That gap is stated in full below.

@fig assurance

## The wire protocol (versioned, value only)

Only JSON-like values cross the worker boundary. The protocol is a versioned tagged union
(`SANDBOX_PROTOCOL_VERSION = 1`, `src/sandbox/lua/protocol.ts:15`); a message on the wrong version is
rejected (`protocol.ts:283-285`). Every message is runtime-validated in both directions and fails
closed on any schema violation (`parseRunRequest` at `protocol.ts:280-312`, `parseRunResponse` at
`protocol.ts:372-421`).

Three checks make the wire safe to trust:

- Value-only. `assertJsonLike` allows null, finite numbers, strings, booleans, arrays, and plain
  objects only; it rejects functions, symbols, bigint, undefined, non-finite numbers, non-plain
  prototypes, and anything nested deeper than 32 (`protocol.ts:161-184`). No functions, DOM handles,
  ports other than the worker channel, proxies, object URLs, or app objects can ride across.
- Key allowlists. Each message type is validated against an exact key allowlist
  (`protocol.ts:34-68`, enforced by `assertAllowlistKeys` at `protocol.ts:146-155`), and state is
  restricted to `chatVars`, `chat`, `meta`, `log` (`protocol.ts:205-215`).
- Credential keys are forbidden. `FORBIDDEN_KEYS` blocks `token`, `authorization`, `cookie`,
  `password`, `secret`, `vaude-session`, `bearer`, and siblings (`protocol.ts:18-32`), and
  `assertNoForbiddenKeys` additionally rejects `__proto__`, `constructor`, and `prototype`
  (`protocol.ts:138-144`). Before it posts, the host runs `messageContainsForbiddenKeys` as a second
  pass and refuses to send a message that still carries a credential-shaped key
  (`run-in-worker.ts:163-170`, `protocol.ts:424-434`).

The API token is never placed on a message, and the protocol has no field that could carry it. This
is enforced by construction and by the forbidden-key sweep, and is unit-tested (`ADR-009:59-62`,
`ADR-009:85-86`).

## Resource budgets (clamped, never upward)

`RELEASE_LUA_LIMITS` is the authoritative ceiling (`src/sandbox/lua/limits.ts:69-88`):

| Budget | Release ceiling | Field |
| --- | --- | --- |
| Wall-clock timeout | 5,000 ms | `timeoutMs` |
| Lua heap (wasmoon `setMemoryMax`) | 64 MiB | `memoryMaxBytes` |
| Script source | 2 MiB | `maxSourceBytes` |
| Request wire state | 4 MiB | `maxRequestBytes` |
| Response wire state | 4 MiB | `maxResponseBytes` |
| Aggregate host state (vars + log + chat + meta) | 2 MiB | `state.maxHostStateBytes` |

Per-field caps sit under the aggregate: chat-var count and key/value sizes, log count and entry size,
chat message count and size, and meta field size (`limits.ts:75-87`). Byte caps are UTF-8 counts via
`TextEncoder`, inclusive: exactly `maxBytes` is accepted, `maxBytes + 1` is rejected
(`limits.ts:5-8`). The Lua heap ceiling is a VM-only cap; it does not cover host-side JS arrays, maps,
JSON strings, or worker message copies, which is precisely why the separate source, wire, and
host-state byte caps exist (`limits.ts:1-8`).

Budgets clamp downward only. `resolveLuaRunLimits` merges caller overrides under the release ceiling
via `clampInt`: a request for a higher timeout or heap is clamped to the release max, a lower value
(for adversarial tests) passes through, and missing fields take the release default
(`limits.ts:64-68`, `limits.ts:160-244`). The clamp is applied independently at three layers, so a
hostile `postMessage` cannot raise a ceiling: the host resolves limits before sending
(`run-in-worker.ts:120-124`), the worker re-resolves from the received message
(`src/sandbox/lua/worker.ts:53-57`, documented as `re-clamped here so a hostile postMessage cannot
raise ceilings`, `worker.ts:6-7`), and the engine clamps again when it is built
(`engine.ts:66-70`). The worker runs Lua on the same authoritative deadline as the host kill switch,
with `no 120s leash above release max` (`worker.ts:110-116`).

Enforcement is at the edges. Source size, host-state shape, and request wire size are asserted before
the message is posted (`run-in-worker.ts:131-137`), re-asserted inside the worker
(`worker.ts:71-95`), and the response wire size is asserted before the parent accepts it
(`run-in-worker.ts:223-228`). Over-budget input yields a bounded `resource` result with a machine
reason (`assertSourceWithinBudget`, `assertWireWithinBudget`, `assertStateWithinBudget` at
`limits.ts:246-346`); it never allocates attacker-sized state first.

## Lua engine hardening (deny by absence)

The Lua VM is wasmoon (PUC-Lua 5.4), built fresh per run and hardened by opening nothing by default
(`src/sandbox/lua/engine.ts:1-9`, `engine.ts:66-86`). The engine is created with
`openStandardLibs: false` and `injectObjects: false` (`engine.ts:73-78`), then only the pure,
side-effect-free libraries are loaded: base, table, string, math, coroutine, utf8
(`SAFE_LIBS`, `engine.ts:14-21`). `io`, `os`, `debug`, and `package` are never opened. After the safe
libs load, the base globals that reach the host or load bytecode are deleted: `load`, `loadfile`,
`dofile`, `loadstring`, `require`, `collectgarbage` (`STRIPPED_GLOBALS`, `engine.ts:24`, applied at
`engine.ts:79-82`). The memory ceiling is set with `setMemoryMax`, which is why the engine is built
with `traceAllocations: true` (`engine.ts:73-83`).

Host capabilities are the only things a card can reach, and they are injected as named Lua globals
(`engine.ts:84`); anything not injected does not exist in the VM, `Absent names do not exist in the
card (deny-by-absence)` (`engine.ts:34`). On the Test Bench the injected surface is the JSON helpers
plus the Risu host API, bound to the run's state and budgets (`worker.ts:97-99`). There is no DOM,
fetch, filesystem, or network global; those were explicitly out of scope for the sandbox
(`ADR-009:40-41`).

## The privileged flag (a warning, not a trigger)

A Risu card can request Risu's low-level script API (`lowLevelAccess`). vaud surfaces that request as
a boolean and does nothing else with it. The canonical field documents its exact status: it is `a
warning marker for the UI and a sandbox gating input, never an execution trigger`
(`src/entities/character/schema.ts:312-314`). The reader that sets it is explicit that `its scripts
must never auto-run` (`src/formats/risu/index.ts:73-78`), and the import receipt renders the warning
as `It asks for deep access - we do not grant that` (`src/ui/receipt.ts:88`). The request is surfaced,
never honored; setting the flag grants no capability and starts no execution.

## What is not yet proven

This section mirrors the code base's own STOP/honesty posture. Do not read anything above as a claim
of full isolation.

Proven and enforced: the worker kill switch (host terminate plus in-VM timeout), the three-layer
resource clamp and byte caps, the value-only wire protocol in both directions, the absence of any
token field on the wire, and the sandbox-host handler allowlist (worker and wasm only; `/api/*` and
traversal return 404). ADR-009 records these as automated in this environment (`ADR-009:80-90`).

Not yet measured, per ADR-009's measured-results table (`ADR-009:80-90`):

- The packaged WebView2 origin probe has `Not run in this implementation pass` (`ADR-009:88`).
- `self.crossOriginIsolated` and storage visibility in the WebView are `Not measured`
  (`ADR-009:89`).
- A credentialed API fetch from the sandbox-origin worker in the packaged host is `Not measured`
  (`ADR-009:90`).

Because of those gaps, distinct-origin isolation is implemented and tested only at the Bun HTTP and
handler layer, and the same-origin fallback path is degraded, not isolated (`run-in-worker.ts:77-86`,
`ADR-009:96-97`). ADR-009's own conclusion governs this page: `Packaged-host proof remains BLOCKED`
and `Do not claim full sandbox isolation until that matrix is green`
(`ADR-009:100-106`, STOP/honesty at `ADR-009:108-112`). The origin-isolation code ships as
defense-in-depth scaffolding; the token layer (Plan 005) and the resource quotas (Plan 016) are the
load-bearing layers that are actually proven, and origin isolation is additive on top of them
(`ADR-009:106`).
