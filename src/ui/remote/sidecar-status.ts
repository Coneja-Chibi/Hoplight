/**
 * Remote-access sidecar status: the pure core that turns the Go sidecar's control channel (one JSON
 * status object per line on its stdout) into the app-facing RemoteState the UI renders and the API
 * returns. Tolerant reader: a malformed or non-status line reads as null, never throws (tsnet writes
 * its own noise to stderr, but a partial pipe read could still hand us a broken line). The imperative
 * manager (sidecar-manager.ts) owns the process + stream; this file is pure and directly tested.
 */

/** One control-channel event from the sidecar (mirror of the Go statusEvent). */
export interface SidecarEvent {
  readonly state: "starting" | "needs-login" | "needs-https" | "running" | "stopped" | "error";
  readonly authUrl?: string;
  readonly dnsName?: string;
  readonly message?: string;
}

/**
 * "unavailable" is NOT an error: it means this build carries no sidecar binary, so the mesh path cannot
 * run and nothing was ever attempted. It exists as its own phase because the two need opposite
 * treatment in the UI - an error offers "Try again", and retrying something structurally absent just
 * reproduces the same failure. Kept distinct from "off" too: off is a switch the user can flip.
 */
export type RemotePhase =
  | "off"
  | "unavailable"
  | "starting"
  | "needs-login"
  | "needs-https"
  | "connected"
  | "error";

/** The app-facing remote-access state the UI renders and the status API returns. */
export interface RemoteState {
  readonly phase: RemotePhase;
  /** Tailscale sign-in URL, present only in the "needs-login" phase. */
  readonly signInUrl?: string;
  /** the node's https URL, present only in the "connected" phase. */
  readonly url?: string;
  /** human-readable detail, present only in the "error" phase. */
  readonly error?: string;
  /**
   * Why the mesh path is unavailable, present only in the "unavailable" phase. Its own field rather
   * than reusing `error`: this object is returned to remote clients by /api/remote/status, and one
   * field carrying two meanings is how "could not start" ends up rendered as a failure that never
   * happened. Plain prose only - never a filesystem path or a spawn error (see sidecar-manager).
   */
  readonly detail?: string;
}

export const OFF: RemoteState = { phase: "off" };

/** No sidecar binary present: the feature cannot run here, and nothing was attempted. */
export const unavailableState = (detail: string): RemoteState => ({ phase: "unavailable", detail });

const SIDECAR_STATES = new Set(["starting", "needs-login", "needs-https", "running", "stopped", "error"]);

/** Parse one control-channel line into a SidecarEvent, or null when it is not a status line. */
export function parseStatusLine(line: string): SidecarEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return null; // stray noise or a partial line; ignore
  }
  if (raw === null || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.event !== "status") return null;
  if (typeof rec.state !== "string" || !SIDECAR_STATES.has(rec.state)) return null;
  return {
    state: rec.state as SidecarEvent["state"],
    ...(typeof rec.authUrl === "string" ? { authUrl: rec.authUrl } : {}),
    ...(typeof rec.dnsName === "string" ? { dnsName: rec.dnsName } : {}),
    ...(typeof rec.message === "string" ? { message: rec.message } : {}),
  };
}

/**
 * Fold one sidecar event onto the current state. Total: every event maps to a stable RemoteState.
 * Fields absent on an event are carried forward (a bare "needs-login" keeps a URL already shown).
 */
export function reduceRemoteState(prev: RemoteState, event: SidecarEvent): RemoteState {
  switch (event.state) {
    case "starting":
      return { phase: "starting" };
    case "needs-login": {
      const signInUrl = event.authUrl ?? prev.signInUrl;
      return signInUrl ? { phase: "needs-login", signInUrl } : { phase: "needs-login" };
    }
    case "needs-https":
      return { phase: "needs-https" };
    case "running": {
      const url = event.dnsName ? `https://${event.dnsName}` : prev.url;
      return url ? { phase: "connected", url } : { phase: "connected" };
    }
    case "stopped":
      return OFF;
    case "error":
      return event.message ? { phase: "error", error: event.message } : { phase: "error" };
    default:
      return assertNever(event.state);
  }
}

const assertNever = (x: never): never => {
  throw new Error(`remote: unhandled sidecar state ${JSON.stringify(x)}`);
};

/**
 * Whether the mesh helper can be fetched for this machine, and what is already installed. Lives here with
 * the other client-safe mirrors so the browser bundle never reaches into a server module for a shape.
 */
export interface AuxHelperStatus {
  /** a pin exists for THIS platform in THIS build, so a download is possible at all */
  readonly offered: boolean;
  /** a helper is already on disk at the downloaded location */
  readonly installed: boolean;
  /**
   * Which release the installed helper came from, when known. FACTUAL ONLY - it is not a staleness
   * signal, and there deliberately is no such field. Go output is not byte-identical between builds, so
   * the pinned hash changes on every release whether the helper changed or not; a "your helper is out of
   * date" derived from that would fire after every single app update, about a helper that works fine.
   * Shown so a user can answer "which one do I have", and paired with a re-download they can choose.
   */
  readonly installedTag?: string;
  /** the `${platform}-${arch}` key this machine looked itself up by */
  readonly platform: string;
}

/** A LAN device session as shown to the host (client-safe mirror of the server's LanSession). */
export interface LanSessionView {
  readonly id: string;
  readonly label: string;
  readonly ip: string;
  readonly status: "pending" | "approved";
  readonly createdAt: number;
}

/** LAN mode status for the host UI (client-safe mirror of the server's LanStatus). */
export interface LanStatus {
  readonly on: boolean;
  readonly code: string;
  readonly url: string;
  readonly fingerprint: string;
  readonly pending: LanSessionView[];
  readonly connected: LanSessionView[];
}

/** One connected remote device, as reported by the sidecar's "devices" control-channel event. */
export interface RemoteDevice {
  readonly nodeId: string;
  readonly name: string;
  readonly login: string;
  readonly lastSeen: number;
}

/** Parse a "devices" line into the device list, or null when the line is not a devices event. Tolerant:
 *  malformed entries are dropped, never thrown. */
export function parseDevicesLine(line: string): RemoteDevice[] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.event !== "devices" || !Array.isArray(rec.devices)) return null;
  const out: RemoteDevice[] = [];
  for (const d of rec.devices) {
    if (d === null || typeof d !== "object") continue;
    const dr = d as Record<string, unknown>;
    if (typeof dr.nodeId !== "string" || !dr.nodeId) continue;
    out.push({
      nodeId: dr.nodeId,
      name: typeof dr.name === "string" ? dr.name : "",
      login: typeof dr.login === "string" ? dr.login : "",
      lastSeen: typeof dr.lastSeen === "number" ? dr.lastSeen : 0,
    });
  }
  return out;
}
