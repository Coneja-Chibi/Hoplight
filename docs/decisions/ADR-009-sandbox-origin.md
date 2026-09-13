# ADR-009: Distinct origin for test-bench execution

**Status:** accepted in design; packaged-host proof BLOCKED; 2026-07-09
**Context owners:** `src/sandbox/lua/`, `src/sandbox/regex/`, `src/ui/server.ts`, `src/ui/sandbox-host.ts`, desktop entries
**Audit IDs:** SANDBOX-001 (Plan 017)

## Context

The Risu Test Bench runs untrusted Lua inside a dedicated Worker with Plan 016 resource
ceilings (timeout, heap, host-state, wire size). Regex previews also run in a dedicated,
terminable Worker with a 750 ms wall-clock ceiling. Plan 005 authenticates the loopback API
with a per-launch bearer (`X-Vaude-Token` / `meta[name=vaude-session]`).

Historically the worker module was served from the **same** loopback origin as the UI and
`/api/*`. A same-origin Worker is an availability boundary (killable thread), not an origin
boundary. If a future engine, bundler, WebView, or bridge bug unexpectedly exposes web
capabilities, same-origin placement increases blast radius: the worker could theoretically
call same-origin APIs, read same-origin storage, or observe credentials that belong only to
the trusted UI.

This is defense-in-depth architecture, not evidence of a current same-origin exploit.

## Packaged-host acceptance

Before a public Windows release, perform this short check against the freshly built
`dist/Vaude.exe` (not the development server): open the Workshop Test Bench and run
`return 42`, then run a Regex Bench preview. Both must finish without a worker-load error. Record the build version
and result in the release notes. The automated suite already proves the distinct loopback
authority, its allowlist/CSP/CORS behavior, API denial, token absence, and protocol; this
acceptance check specifically covers the installed WebView2 runtime.

## Threat model (in scope)

| Asset | Risk if sandbox shares the app origin |
| --- | --- |
| Per-launch API token | Leak into script state, worker globals, messages, logs, URLs |
| Mutating `/api/*` routes | Cross-origin-less fetch with ambient authority |
| Studio filesystem via API | Write/delete through authenticated routes |
| Trusted cookies / localStorage | Shared with worker if same origin |

Out of scope for this ADR: arbitrary untrusted native-code isolation, giving Lua DOM/fetch/fs
access, auto-running scripts on import.

## Decision

**Chosen boundary: second loopback listener (distinct port = distinct origin).**

1. Primary UI/API server remains on the configured port (`127.0.0.1:<ui>`), Host/Origin/token
   gated as in Plan 005.
2. A **sandbox-only** server binds `127.0.0.1` on an **ephemeral** port. It serves only:
   - `GET /sandbox/worker.js` (module worker bundle)
   - `GET /sandbox/regex-worker.js` (regex execution worker bundle)
   - `GET /sandbox/glue.wasm` (wasmoon glue)
   - CORS preflight for the UI origin (module workers load cross-origin)
3. Sandbox host **must not** expose `/api`, studio paths, index HTML with the session token,
   arbitrary static files, or source maps containing secrets.
4. UI HTML injects `meta[name="vaude-sandbox-origin"]` with the sandbox origin (public, not a
   secret). The API token stays only in `meta[name="vaude-session"]` and trusted `apiFetch`.
5. Browser UI loads both workers from the sandbox origin when the meta is present; Bun tests keep
   module-relative worker paths (no document).
6. The Lua wire protocol is a **versioned value-only** tagged union (`src/sandbox/lua/protocol.ts`):
   JSON-like primitives only, allowlisted keys, Plan 016 size budgets before accept, no token
   fields, no functions/handles/ports except the Worker message channel itself.
7. The regex worker also accepts values only and rejects oversized input, more than 500 rules,
   malformed rule rows, and malformed run options before calling the core engine.

### Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| Same port, different path (`/sandbox/*` only) | Same origin; cookies, storage, and credentialed same-origin fetch still apply. |
| iframe `sandbox` **with** `allow-same-origin` | Restores origin privilege; not a boundary. |
| CORS headers alone on the main server | CORS is not authentication; does not isolate the worker origin. |
| Helper child process (pipe protocol) | Valid long-term option for packaged WebView if origins collapse; deferred until measured need. Higher packaging cost. |

### Origin / alias notes

- Distinct ports on `127.0.0.1` yield distinct origins (`http://127.0.0.1:A` vs `:B`).
- Host checks on `/api` remain exact (`127.0.0.1:<uiPort>`); `localhost` aliases and wrong ports
  fail closed (Plan 005).
- Sandbox origin is never trusted for API calls: even if a script guesses route names, missing
  token + wrong Origin still 403.

## Measured results (this environment)

| Check | Result |
| --- | --- |
| Unit: sandbox handler allowlist | Automated: only the two workers + wasm; `/api/*` and traversal return 404 |
| Unit: value protocol reject cases | Automated: wrong version, unknown type, secret keys, oversized |
| Unit: worker run without token in messages | Automated via protocol encode/parse |
| Packaged asset build | Automated by `bun run scripts/build-desktop.ts` |
| Packaged WebView2 origin probe (Windows) | **Not run in this implementation pass** |
| `self.crossOriginIsolated` / storage visibility in WebView | **Not measured** |
| Credentialed API fetch from sandbox-origin worker in packaged host | **Not measured** |

## Rollback / packaging

- `startUi` starts both listeners; `stop()` tears both down.
- Packaged exe: same dual-listen path; sandbox serves both packaged worker bundles + wasm.
- If sandbox listen fails, UI can fall back to the matching same-origin worker path on the primary
  server (degraded; not claimed isolated). Prefer fail-visible logs over silent false isolation.
- Re-run the origin probe when WebView, bundler, server, or packaging dependencies change.

## Consequences

- Real origin separation is implementable and tested at the HTTP/handler layer in Bun.
- **Packaged-host proof remains BLOCKED** until a WebView2 smoke matrix records distinct
  authority, no shared storage/token, API denial from the sandbox origin, and CSP probes.
- Do not claim "full sandbox isolation" in release notes until that matrix is green.
- Plans 005 (token) and 016 (quotas) remain load-bearing layers; origin isolation is additive.

## STOP / honesty

This ADR deliberately does **not** assert that the shipped WebView collapses authorities safely.
Until packaged measurements exist, Plan 017 status is **BLOCKED** for full Done criteria while
the code path (sandbox host + protocol + token absence) ships as defense-in-depth scaffolding.
