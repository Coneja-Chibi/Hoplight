/**
 * Remote-access HTTP surface + boot wiring, split out of server.ts so that core file stays under the
 * size cap and remote access reads as one concept. Three pieces:
 *   - isHostOnlyRoute: the paths a tailed-in / LAN-served device must never reach (management + host
 *     control). The per-request GATES stay in server.ts's createHandler; this is just the path list.
 *   - handleRemoteRoutes: the /api/remote/* control plane (Tailscale + LAN). Returns null for a
 *     non-remote path so createHandler's own route table continues; never 404s on its own.
 *   - setupRemoteAccess: boot wiring. Creates the sidecar + LAN managers, binds the untrusted listener
 *     the sidecar proxies into, and resumes on boot if the user left remote access on. The trusted
 *     handler factory is INJECTED (makeHandler) so this module never imports server.ts back.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SettingsStoreLike } from "../studio/contracts";
import { SETTING_KEYS } from "../studio/settings-shape";
import { createSidecarManager, type SidecarManager } from "./remote/sidecar-manager";
import { createLanManager, type LanManager } from "./remote/lan-manager";
import { AuxDownloadError, fetchPinnedAux, platformKey } from "./remote/aux-download";
import type { AuxHelperStatus } from "./remote/sidecar-status";
import { auxSidecarInstalled, auxSidecarPath, installAuxSidecar, readAuxMarker } from "./remote/aux-install";
import { SIDECAR_PINS, SIDECAR_REPO } from "./remote/sidecar-pins";
import { json, err, readJsonCapped, openInBrowser } from "./server-security";

/** The UNTRUSTED loopback port the sidecar reverse-proxies remote traffic into (a second Bun.serve binds
 *  it and serves the app gated by the shared secret the sidecar stamps). */
const UNTRUSTED_PORT = 8788;
const UNTRUSTED_UPSTREAM = `127.0.0.1:${UNTRUSTED_PORT}`;
/** LAN mode's listener port (bound on 0.0.0.0 with a self-signed cert when the host turns LAN on). */
const LAN_PORT = 8790;

/**
 * Locate the Tailscale sidecar binary, or null when this build does not carry one.
 *
 * TWO CANDIDATES, and the second one is the bug fix. `import.meta.url` is correct from source (the
 * repo's own sidecar/ folder, where `bun sidecar/build.ts` puts the binary) and USELESS once compiled:
 * inside a standalone Bun executable it points at the virtual filesystem, so the old single-candidate
 * version resolved to `B:\sidecar\sidecar.exe` and could never hit. Every packaged studio therefore
 * failed to start remote access no matter what was installed beside it. `process.execPath` is the real
 * exe on disk, so the packaged lookup is a sibling `sidecar/` folder next to Hoplight.exe.
 *
 * Returns null rather than a hopeful path: the caller renders "unavailable" up front instead of
 * offering a control that spawns a guess and translates the OS error afterwards.
 */
export function sidecarCandidates(execPath: string = process.execPath): string[] {
  const name = process.platform === "win32" ? "sidecar.exe" : "sidecar";
  return [
    // from source: the authoritative location, and the one a developer just built into
    fileURLToPath(new URL(`../../sidecar/${name}`, import.meta.url)),
    // packaged: beside the executable the user actually launched
    join(dirname(execPath), "sidecar", name),
    // downloaded on request through the aux-package button, verified against a baked hash before it was
    // written. Last, so a helper someone deliberately placed beside the exe still wins.
    auxSidecarPath(),
  ];
}

function resolveSidecarBin(): string | null {
  return sidecarCandidates().find((p) => existsSync(p)) ?? null;
}

/** Routes that are HOST-ONLY: remote-access management, version updates, plus host/app control. Refused to
 *  any remote or LAN-served device, these are the local owner's controls, never a tailed-in guest's. */
export function isHostOnlyRoute(p: string, method: string): boolean {
  return (
    p.startsWith("/api/remote/") ||
    p.startsWith("/api/updates/") || // version timeline + switch: never a guest's to drive
    p === "/api/update-check" || // even the outbound GitHub ping is the host's alone
    p === "/api/open" ||
    p === "/api/shutdown" ||
    p === "/api/restart" ||
    (p === "/api/settings" && method !== "GET" && method !== "HEAD")
  );
}

/**
 * LOOPBACK-ONLY routes: a different rationale from isHostOnlyRoute's ownership boundary (those are
 * the local owner's CONTROLS; these are uploads sized for a desk, not a network). An archive import
 * streams straight to disk with almost no ceiling (LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes, 5 GiB) -
 * accepted from a tailed-in or LAN-served device, that is a disk-fill vector, not a feature. Its own
 * list, checked before isHostOnlyRoute's caller reaches the route at all.
 */
export function isLoopbackOnlyRoute(p: string): boolean {
  return p === "/api/inspect-archive";
}

export function auxHelperStatus(): AuxHelperStatus {
  // An empty pin table is the honest default (nothing published for this platform yet), so "offered" is
  // simply whether this platform is in it. Same answer from source, from the CLI and from the packaged app,
  // because the pins are committed rather than baked into one build.
  const pin = SIDECAR_PINS[platformKey()];
  const marker = readAuxMarker();
  const installed = auxSidecarInstalled();
  return {
    offered: Boolean(pin),
    installed,
    // Reported only when a helper is actually there; a marker left behind by a removed one would name a
    // version the user does not have.
    ...(installed && marker ? { installedTag: marker.tag } : {}),
    platform: platformKey(),
  };
}

/**
 * Fetch, verify and install the helper. Every refusal is reported as a sentence a user can act on; the
 * AuxDownloadError reason keeps the phrasing out of string-matching.
 */
async function downloadHelper(): Promise<Response> {
  const pin = SIDECAR_PINS[platformKey()];
  if (!pin) return err("no helper is published for your platform", 501);
  try {
    const bytes = await fetchPinnedAux(SIDECAR_REPO, pin);
    installAuxSidecar(bytes, pin);
    return json({ ok: true, path: auxSidecarPath(), ...auxHelperStatus() });
  } catch (e) {
    if (e instanceof AuxDownloadError) {
      // The technical detail stays on the host's console; the caller gets the actionable sentence.
      console.warn(`remote: helper download refused (${e.reason}):`, e.message);
      return err(
        e.reason === "hash-mismatch"
          ? "The downloaded helper did not match what this build expects, so it was discarded. Nothing was installed."
          : e.reason === "wrong-host" || e.reason === "insecure-url"
            ? "The download was refused because it did not come from the expected place. Nothing was installed."
            : "The helper could not be downloaded. Nothing was installed.",
        502,
      );
    }
    console.warn("remote: helper download failed:", e instanceof Error ? e.message : e);
    return err("The helper could not be downloaded. Nothing was installed.", 502);
  }
}

export interface RemoteRouteDeps {
  /** remote-access sidecar manager; absent in tests and when the binary is missing */
  remote?: SidecarManager;
  /** LAN manager, present only on the trusted handler (LAN management is host-only) */
  lan?: LanManager;
  settings: SettingsStoreLike;
}

/**
 * The remote-access control plane. The sidecar's data plane lives on a separate untrusted port; these
 * routes only START/STOP it and report state. Auth (trusted Origin + token) was already enforced by
 * createHandler's /api gate before this runs. Returns null for any non-remote path.
 */
export async function handleRemoteRoutes(
  req: Request,
  p: string,
  deps: RemoteRouteDeps,
): Promise<Response | null> {
  const { remote, lan, settings } = deps;

  if (p === "/api/remote/status") {
    return json(remote ? remote.getState() : { phase: "off" });
  }
  if (p === "/api/remote/enable" && req.method === "POST") {
    if (!remote) return err("remote access is unavailable in this build", 503);
    remote.enable();
    const state = remote.getState();
    // Do NOT persist an "on" that did not happen. The panel hides the Enable control while the mesh
    // helper is absent, so reaching here means a direct API call; recording intent anyway would make
    // every later boot try to resume something this build cannot start.
    if (state.phase !== "unavailable") {
      await settings.update({ [SETTING_KEYS.remoteAccessEnabled]: true });
    }
    return json(state);
  }
  if (p === "/api/remote/disable" && req.method === "POST") {
    if (!remote) return err("remote access is unavailable in this build", 503);
    await remote.disable();
    await settings.update({ [SETTING_KEYS.remoteAccessEnabled]: false });
    return json(remote.getState());
  }
  if (p === "/api/remote/devices") {
    return json(remote ? remote.getDevices() : []);
  }

  // The aux package: an explicit, one-off fetch of the remote-access helper this build was not shipped
  // with. Host-only like every /api/remote/* route (isHostOnlyRoute covers the prefix), so a tailed-in
  // guest can never make the host machine download and install an executable.
  if (p === "/api/remote/helper/status") {
    return json(auxHelperStatus());
  }
  if (p === "/api/remote/helper/download" && req.method === "POST") {
    return await downloadHelper();
  }
  if (p === "/api/remote/kick" && req.method === "POST") {
    if (!remote) return err("remote access is unavailable in this build", 503);
    const parsed = await readJsonCapped(req, 4096);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value as { nodeId?: unknown } | null;
    const nodeId = typeof body?.nodeId === "string" ? body.nodeId : "";
    if (!nodeId) return err("expected { nodeId }", 400);
    remote.kick(nodeId);
    return json({ ok: true });
  }

  // LAN mode (host-only, like all /api/remote/*): the connect-code + per-device-approval path for users
  // who do not want a Tailscale account.
  if (p === "/api/remote/lan/status") {
    return json(lan ? lan.status() : { on: false });
  }
  if (p === "/api/remote/lan/enable" && req.method === "POST") {
    if (!lan) return err("remote access is unavailable in this build", 503);
    return json(await lan.enable());
  }
  if (p === "/api/remote/lan/disable" && req.method === "POST") {
    if (!lan) return err("remote access is unavailable in this build", 503);
    await lan.disable();
    return json(lan.status());
  }
  if (
    (p === "/api/remote/lan/approve" || p === "/api/remote/lan/deny" || p === "/api/remote/lan/kick") &&
    req.method === "POST"
  ) {
    if (!lan) return err("remote access is unavailable in this build", 503);
    const parsed = await readJsonCapped(req, 4096);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value as { id?: unknown } | null;
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return err("expected { id }", 400);
    if (p.endsWith("/approve")) lan.approve(id);
    else if (p.endsWith("/deny")) lan.deny(id);
    else lan.kick(id);
    return json(lan.status());
  }

  return null;
}

/** Builds a request handler for one of the remote listeners; injected so this module never imports
 *  server.ts. server.ts passes a closure over createHandler. */
export type MakeHandler = (opts: {
  remote?: SidecarManager;
  remoteSecret?: string;
  lanApproved?: boolean;
  lan?: LanManager;
}) => (req: Request) => Promise<Response>;

export interface RemoteAccessHandle {
  remote: SidecarManager;
  lan: LanManager;
  stop: () => void;
}

/**
 * Boot wiring for remote access. Creates the managers, binds the untrusted listener BEFORE resuming (the
 * sidecar proxies into it), then resumes if the user left it on. Fail-closed: a bad settings read leaves
 * it off; a listener bind failure degrades to "remote will not serve" rather than crashing the server.
 */
export function setupRemoteAccess(deps: {
  settings: SettingsStoreLike;
  studioDir: string;
  makeHandler: MakeHandler;
}): RemoteAccessHandle {
  const { settings, studioDir, makeHandler } = deps;

  // One per-boot secret shared by the sidecar (which stamps it) and the untrusted listener (which
  // requires it). Never persisted; regenerated every launch.
  const sharedSecret = randomBytes(32).toString("hex");
  const remote = createSidecarManager({
    resolveBin: resolveSidecarBin,
    untrustedUpstream: UNTRUSTED_UPSTREAM,
    sharedSecret,
    openUrl: openInBrowser,
  });

  // LAN mode's approved-session app handler is a lanApproved handler; the trusted handler (built by the
  // caller) gets `lan` for the host-only /api/remote/lan/* routes.
  const lan = createLanManager({
    makeAppHandler: () => makeHandler({ remote, lanApproved: true }),
    port: LAN_PORT,
    certDir: `${studioDir}/.hoplight-lan`,
    now: () => Date.now(),
  });

  // The UNTRUSTED remote listener: the sidecar reverse-proxies remote (owner-gated) traffic here, gated
  // by the shared secret. Bound only on loopback; only the sidecar ever reaches it. Bind before resume.
  let stopUntrusted: (() => void) | null = null;
  try {
    const untrustedServer = Bun.serve({
      port: UNTRUSTED_PORT,
      hostname: "127.0.0.1",
      idleTimeout: 120,
      fetch: makeHandler({ remote, remoteSecret: sharedSecret }),
    });
    stopUntrusted = () => untrustedServer.stop(true);
  } catch (e) {
    console.warn(
      "server: untrusted remote listener failed to bind; remote access will not serve:",
      e instanceof Error ? e.message : e,
    );
  }

  // Resume remote access if the user left it on. Fail-closed: a bad or missing read leaves it off.
  void settings.read().then((s) => {
    if (s.remoteAccessEnabled === true) remote.enable();
  });

  return {
    remote,
    lan,
    stop: () => {
      stopUntrusted?.();
      void remote.disable();
      void lan.disable();
    },
  };
}
