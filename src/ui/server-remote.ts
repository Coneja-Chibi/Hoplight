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
import { fileURLToPath } from "node:url";
import type { SettingsStoreLike } from "../studio/contracts";
import { SETTING_KEYS } from "../studio/settings-shape";
import { createSidecarManager, type SidecarManager } from "./remote/sidecar-manager";
import { createLanManager, type LanManager } from "./remote/lan-manager";
import { json, err, readJsonCapped, openInBrowser } from "./server-security";

/** The UNTRUSTED loopback port the sidecar reverse-proxies remote traffic into (a second Bun.serve binds
 *  it and serves the app gated by the shared secret the sidecar stamps). */
const UNTRUSTED_PORT = 8788;
const UNTRUSTED_UPSTREAM = `127.0.0.1:${UNTRUSTED_PORT}`;
/** LAN mode's listener port (bound on 0.0.0.0 with a self-signed cert when the host turns LAN on). */
const LAN_PORT = 8790;

/** Resolve the bundled Tailscale sidecar binary. A missing binary fails soft: the manager reports an
 *  error state rather than crashing the server. */
function resolveSidecarBin(): string {
  const name = process.platform === "win32" ? "sidecar.exe" : "sidecar";
  return fileURLToPath(new URL(`../../sidecar/${name}`, import.meta.url));
}

/** Routes that are HOST-ONLY: remote-access management plus host/app control. Refused to any remote or
 *  LAN-served device, these are the local owner's controls, never a tailed-in guest's. */
export function isHostOnlyRoute(p: string, method: string): boolean {
  return (
    p.startsWith("/api/remote/") ||
    p === "/api/open" ||
    p === "/api/shutdown" ||
    p === "/api/restart" ||
    (p === "/api/settings" && method !== "GET" && method !== "HEAD")
  );
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
    await settings.update({ [SETTING_KEYS.remoteAccessEnabled]: true });
    return json(remote.getState());
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
    binPath: resolveSidecarBin(),
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
