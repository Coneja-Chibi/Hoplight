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
  (`src/ui/server-remote.test.ts`).
- The full LAN path (code -> cookie -> pending -> host approval -> served; host-only routes refused to an
  approved device) has been verified live end-to-end at the listener boundary, and the Tailscale path has
  been verified live from a phone reaching the studio.
