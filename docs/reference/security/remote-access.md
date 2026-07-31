---
id: reference/security/remote-access
title: Remote access: Tailscale and LAN
audience: dev
summary: How hoplight lets you reach the studio from another device over a private Tailscale link or the local network, and the gates that keep everyone else out. Two listeners (trusted loopback, untrusted sidecar-fed), an owner-only Tailscale gate, and a connect-code + per-device-approval LAN gate. Off by default; driven entirely from Settings, never a terminal.
tags: [security, remote-access, tailscale, lan, sidecar, owner-gate, connect-code]
related: [reference/security/script-sandbox, reference/architecture]
---

# Remote access: Tailscale and LAN

Remote access lets the studio's owner reach it from their own phone or another computer. It is **off by
default**, driven entirely from Settings > Remote access (never a terminal), and comes in two independent
modes that can each be on or off:

- **Tailscale** (`src/ui/remote/sidecar-manager.ts`, `sidecar/main.go`): a private, encrypted link over
  the owner's own tailnet. No router changes, no ports opened to the internet.
- **LAN** (`src/ui/remote/lan-*.ts`): a no-account path for devices on the same local network, gated by a
  connect code the owner reads off-screen and a per-device approval the owner grants in the app.

Neither mode ever exposes the studio to the open internet, and every device is gated before it is served.

## Containers and SSH forwarding

Running Hoplight in a container or on a headless machine does not require a browser inside that
environment. The `hoplight ui` startup receipt prints:

- the local Studio URL;
- one copyable SSH command with a forward for the Studio port; and
- when the isolated Lua/regex listener started, a second forward in that same command for its random
  sandbox port.

Run the printed command on the computer with the browser, replace `user@server`, keep the tunnel open,
and browse to the printed `http://localhost:<ui-port>` address. Browsing to the server or container IP
is intentionally refused by the trusted listener's Host gate. The HTML shell can still arrive before
the first `/api/settings` request is refused, so the browser now turns that otherwise opaque 403 into
the same localhost and SSH instructions. It offers one button for the Studio and another deep link
that opens the forwarded Studio directly on Settings > Remote access. A third button copies the
one-port recovery command. The normal host-only API gates still decide whether those controls may
change anything.

A one-port tunnel is enough for ordinary Studio work. It is not enough for the Lua and regex test
benches because ADR-009 puts their workers on a second, ephemeral loopback origin. Forward both ports
from the startup receipt to use those benches remotely. Tailscale and LAN access serve the approved
Studio surface, but they do not turn the sandbox-only listener into a general remote endpoint.

This guidance does not broaden `hostAllowed`, expose a new listener, or weaken the existing token and
Origin checks. It makes the two-listener architecture visible at the point where a user needs it.

## Two listeners, one trust boundary

The app binds two loopback listeners (`src/ui/server-remote.ts`, `src/ui/server.ts`):

- **Trusted** `127.0.0.1:<port>` (default 8321): the local owner's own browser. Gated by a loopback
  Host/Origin check plus a per-launch session token on state-changing requests
  (`checkApiRequest`, `src/ui/server-security.ts`).
- **Untrusted** `127.0.0.1:8788`: the ONLY thing that reaches it is the Tailscale sidecar, which
  reverse-proxies already-owner-gated remote traffic here. Gated by a per-boot shared secret the sidecar
  stamps on every forwarded request (`checkRemoteApiRequest`), plus the session token on writes.

The shared secret is a CSPRNG value generated once per launch (`setupRemoteAccess`,
`src/ui/server-remote.ts`), passed to the sidecar via an **environment variable, never argv** (argv is
world-readable in the process table), and:

- the **untrusted** listener REQUIRES it (a local process or DNS-rebinding page has no secret, so it fails
  closed);
- the **trusted** listener REFUSES it on any path, before routing: a request carrying the sidecar secret
  is by definition sidecar-proxied remote traffic and has no business at the local door
  (`createHandler`, `src/ui/server.ts`).

## The Tailscale owner gate

The sidecar (`sidecar/main.go`) embeds Tailscale via `tsnet` and, for every remote request, calls `WhoIs`
on the caller's tailnet address and admits it only if it is the **studio owner's own account**:

- Identity is compared by numeric user id: `who.UserProfile.ID == Self.UserID` (`resolveOwnerID` +
  `newProxy`). Login-name strings are not used for the decision (tsnet can return an empty login for the
  owner's own node while the numeric id is populated).
- **Fail closed** everywhere: an unresolved owner id (0) denies everyone; an unidentifiable caller (no
  `WhoIs`) is denied; a caller whose node has no stable id is denied, because a device we cannot track or
  kick is a device we will not serve.
- Identity headers forwarded upstream (`X-Tailscale-User`, `X-Tailscale-Node`) are taken from `WhoIs`,
  never from client-supplied headers, so a forged header cannot survive.

These properties are unit-tested against a fake resolver (`sidecar/main_test.go`).

## The LAN gate: connect code + per-device approval

On a local network there is no tailnet identity, so LAN mode gates on two things a stranger cannot supply
(`src/ui/remote/lan-host.ts`, the security core):

1. **A connect code** the owner reads off their screen and types on the other device. The code is drawn
   from a CSPRNG with rejection sampling to remove modulo bias, hashed with **argon2id**
   (`Bun.password`), and never sent to a connecting device. Wrong guesses are throttled **per IP** with
   exponential backoff (never a global lockout, which would let one bad device lock the owner out).
2. **Host approval.** A device that enters the right code becomes *pending* and is served nothing until
   the owner approves it in the app. Pending sessions are capped per IP and expire after 15 minutes, so
   the code alone cannot flood the approval list or leave stale entries.

The LAN listener binds `0.0.0.0:8790` with a **self-signed TLS cert** (`src/ui/remote/lan-server.ts`) so
the code and traffic never cross the wire in the clear. The cert carries the host's LAN IP and loopback in
a `subjectAltName` (a CN-only cert triggers a harsher, sometimes un-bypassable browser error), and is
regenerated if the cached one no longer covers the current IP. The private key is written with `chmod 600`
(best effort; Windows uses ACLs). The owner verifies the shown sha256 fingerprint on first connect.

### Why the session cookie is not `Secure`

The approved-session cookie is `HttpOnly; SameSite=Lax; Path=/` with **no `Secure` attribute**
(`src/ui/remote/lan-server.ts`). The listener is HTTPS-only, but a self-signed cert is not a "secure
context" in some browsers, which then silently DROP a `Secure` cookie, leaving the device stuck re-entering
the code forever. `SameSite=Lax` lets the cookie ride the reload navigation; `HttpOnly` still stands.

## Host-only surface

Whether a device tailed in over Tailscale or was approved on the LAN, it may USE the studio but must never
reach management or host control. `isHostOnlyRoute` (`src/ui/server-remote.ts`) refuses, for any
remote/LAN-served handler, every `/api/remote/*` route (turn access on/off, kick devices), `/api/open`
(open a browser on the host), `/api/shutdown`, `/api/restart`, and settings writes. Those belong to the
local owner alone.

## Kicking a device

The owner can remove any connected device from the host. Over Tailscale, the app writes a kick command to
the sidecar's stdin; the sidecar blocklists that node's stable id and denies it on the next request, even
though it is the owner's own account (`deviceTracker`, `sidecar/main.go`). On LAN, the session is dropped.

## Where the sidecar binary comes from

The sidecar is compiled Go, and it is **not** inside `Hoplight.exe`. Three locations are checked, in this
order (`sidecarCandidates`, `src/ui/server-remote.ts`):

1. the repository's own `sidecar/` folder, where `bun sidecar/build.ts` writes it - the from-source path;
2. a `sidecar/` folder beside the running executable, for anyone who places one there deliberately;
3. the aux-package cache under the per-user support directory, where a requested download installs it.

None present means the mesh path reports **`unavailable`**, its own `RemotePhase`, distinct from both `off`
and `error`. `off` is a switch the owner can flip and `error` invites a retry; a build with no helper can do
neither, so the panel states that up front and offers no Enable control rather than spawning a path that is
not there. LAN mode is unaffected and needs no helper at all.

> The second candidate is load-bearing. Deriving the path from `import.meta.url` alone is correct from
> source and meaningless once compiled - inside a standalone Bun executable it resolves onto the virtual
> filesystem (`B:\sidecar\sidecar.exe`), which cannot exist. Every packaged studio therefore failed to start
> remote access regardless of what was installed beside it, and the failure surfaced as a raw `uv_spawn`
> `ENOENT` in the settings panel. Pinned by `src/ui/server-remote.test.ts`.

## The aux package: fetching the helper on request

The helper is roughly 31 MB, so it ships as a **release asset** rather than inside the app, and the owner
fetches it with an explicit click. This is a download-and-execute path and is built as one
(`src/ui/remote/aux-download.ts`, `aux-install.ts`):

- **A SHA-256 pin is the integrity control, and it is COMMITTED** (`src/ui/remote/sidecar-pins.ts`), pinned
  like a dependency. `bun scripts/pin-sidecar.ts <tag>` reads that release's published `SHA256SUMS`,
  re-downloads each asset to confirm it matches, and rewrites the module; the result is reviewed and
  committed like any lockfile bump. An empty table offers no download.

  > Computing the pin during the build was the earlier design and it quietly split the product in two: only
  > a CI-built binary carried a hash, so the download worked for packaged users and silently did not for
  > anyone running from source. Committing it makes the answer identical everywhere. It works because the
  > helper is **not tied to an app version** - it is a separate process speaking one small stdio protocol, so
  > one known-good release serves indefinitely. The coupling is to the protocol, not the version number,
  > which is also why there is no staleness signal.
- **Verification happens on bytes in memory**, before anything is written to the path the spawner reads, so
  a tampered or truncated download cannot leave a runnable file behind. The install itself is a rename from
  a sibling staging file, so a torn write never becomes the final binary. On POSIX the helper is `0o700`.
- **HTTPS only, and the hops are inspected.** The first must be `github.com`; a redirect may only land on
  GitHub's asset family, which is required rather than optional because release downloads really do redirect
  to a signed, time-limited host. A relative `Location` is resolved against the current URL so it cannot
  smuggle in a host change.
- **The size cap is applied while reading**, not after buffering, so a response with no or an understated
  `Content-Length` cannot cost the memory the cap exists to protect.
- **Host-only.** `/api/remote/helper/*` sits under the `/api/remote/` prefix, so a tailed-in or LAN-approved
  guest cannot make the host machine download and install an executable.

The host allowlist is defence in depth, not the guarantee. If GitHub renames its asset host, this loses
availability and keeps integrity, which is the correct way round.

The installed helper is **not** re-hashed before each spawn. It lives in the owner's own per-account support
directory, so anyone able to rewrite it can equally rewrite `Hoplight.exe`; re-verifying would defend
against an attacker who already holds the account. There is deliberately no "your helper is out of date"
signal either: the pinned hash changes on every release whether the helper changed or not, so a staleness
warning derived from it would fire after every app update about a helper that works. The panel reports which
release the installed helper came from and offers to fetch it again.

## Sidecar lifecycle

The sidecar is a background process that speaks only over stdio pipes (status events out, kick commands
in). It watches its stdin: when the parent app dies, stdin hits EOF and the sidecar exits, so a crashed app
never leaves an orphan carrying a stale secret. On startup the manager also sweeps any orphan from a prior
run before spawning a fresh one (`killOrphans`, `src/ui/remote/sidecar-manager.ts`).

The binary is built as a **Windows GUI-subsystem** executable (`bun sidecar/build.ts`, `-H=windowsgui`) so
that spawning it from the window-less packaged app never pops a console window; the parent-provided pipes
still work because they are handles, independent of any console. Spawns also pass `windowsHide` as a second
layer.

## What is proven

- The Tailscale owner gate and its fail-closed cases are unit-tested (`sidecar/main_test.go`).
- The LAN code format, per-IP throttle, pending cap, and TTL are unit-tested (`src/ui/remote/lan-host.test.ts`).
- The trusted-port secret refusal and the host-only route block are tested at the handler
  (`src/ui/server-remote.test.ts`), including that a guest cannot trigger a helper download.
- The three binary locations, the `unavailable` phase, and the refusal to spawn or to persist an "on" that
  cannot happen are unit-tested (`src/ui/server-remote.test.ts`, `src/ui/remote/sidecar-manager.test.ts`).
  The packaged path resolution was also confirmed against a real compiled executable.
- Every aux-download refusal is unit-tested (`src/ui/remote/aux-download.test.ts`): pin mismatch, truncation,
  a non-GitHub or plain-http hop, a lookalike host, a relative redirect, redirect loops, and a body that
  exceeds the cap while streaming.
- The checksum reader that writes the committed pins is unit-tested (`scripts/sidecar-pin-format.test.ts`):
  it takes only the helper assets, ignores every other binary in the file, and refuses a duplicate digest
  rather than choosing between two answers.
- That the release builds and uploads a helper for every pinned platform, and that every committed pin names
  an asset the release actually publishes, is pinned by `scripts/ci-sidecar.test.ts`. Those assertions cover
  the workflow's SHAPE; that the Go cross-builds themselves succeed is proven only by a real release run.
- The full LAN path (code -> cookie -> pending -> host approval -> served; host-only routes refused to an
  approved device) has been verified live end-to-end at the listener boundary, and the Tailscale path has
  been verified live from a phone reaching the studio.
