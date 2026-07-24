/**
 * LAN remote-access manager: owns the LanHost (connect code + approvals) and the LAN listener lifecycle,
 * and exposes the host-side controls (enable/disable, approve/deny/kick, status). The Tailscale sidecar
 * manager is its mesh counterpart; this is the local, no-account path. Host-only by construction: these
 * methods are reached only through the trusted /api/remote/lan/* routes.
 */
import { networkInterfaces } from "node:os";
import { LanHost, type LanSession } from "./lan-host";
import { startLanServer, type LanServerHandle } from "./lan-server";

export interface LanStatus {
  on: boolean;
  code: string;
  url: string;
  fingerprint: string;
  pending: LanSession[];
  connected: LanSession[];
}

export interface LanManager {
  /** Turn on LAN access: fresh code, start the listener. Returns the code (shown to the host once). */
  enable(): Promise<LanStatus>;
  disable(): Promise<void>;
  status(): LanStatus;
  approve(id: string): void;
  deny(id: string): void;
  kick(id: string): void;
}

export interface LanManagerOptions {
  /** builds the app handler for approved sessions (createHandler with lanApproved: true). */
  makeAppHandler: () => (req: Request) => Promise<Response>;
  port: number;
  certDir: string;
  now: () => number;
}

/** The host's primary LAN IPv4 (first non-internal), for the URL a device opens. Empty if none. */
export function lanHostIp(): string {
  const ifaces = networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal) return ni.address;
    }
  }
  return "";
}

export function createLanManager(opts: LanManagerOptions): LanManager {
  const lanHost = new LanHost({ now: opts.now });
  let server: LanServerHandle | null = null;
  let code = "";

  const off = (): LanStatus => ({ on: false, code: "", url: "", fingerprint: "", pending: [], connected: [] });

  const enable = async (): Promise<LanStatus> => {
    if (server) return status();
    code = await lanHost.reset();
    server = await startLanServer({
      lanHost,
      appHandler: opts.makeAppHandler(),
      port: opts.port,
      certDir: opts.certDir,
      hostIp: lanHostIp(),
    });
    return status();
  };

  const disable = async (): Promise<void> => {
    server?.stop();
    server = null;
    code = "";
  };

  const status = (): LanStatus => {
    if (!server) return off();
    return {
      on: true,
      code,
      url: server.origin,
      fingerprint: server.fingerprint,
      pending: lanHost.pending(),
      connected: lanHost.connected(),
    };
  };

  return {
    enable,
    disable,
    status,
    approve: (id) => lanHost.approve(id),
    deny: (id) => lanHost.remove(id),
    kick: (id) => lanHost.remove(id),
  };
}
