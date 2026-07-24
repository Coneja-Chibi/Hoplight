/**
 * LAN remote-access host state: the connect code (argon2-hashed), per-IP attempt throttling, and the
 * device session/approval lifecycle. This IS the security of LAN mode, on a local network there is no
 * Tailscale identity to gate on, so a device must present the connect code AND be approved by the host
 * before it is served. In-memory: a fresh code and empty session set every time LAN mode is enabled.
 *
 * The pure pieces (formatConnectCode, normalizeCode, throttleDelayMs) are exported and directly tested;
 * LanHost is the thin stateful shell over them (argon2 + a clock, both injectable).
 */
import { randomBytes } from "node:crypto";

export type LanSessionStatus = "pending" | "approved";

export interface LanSession {
  readonly id: string; // random session id (the cookie value)
  readonly label: string; // friendly label shown to the host (the device IP for now)
  readonly ip: string;
  readonly status: LanSessionStatus;
  readonly createdAt: number; // epoch ms
}

// Unambiguous alphabet (no 0/O, 1/I/L) for a code a human reads off one screen and types on another.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Format random bytes into a typable code like "7K4-2QF-9MX" (3 groups of 3). Rejection sampling (skip
 *  bytes at or above the largest multiple of the alphabet size) removes modulo bias, so every character
 *  is uniform. Pass a generous byte supply; padding is only a never-in-practice safety net. Pure. */
export function formatConnectCode(bytes: Uint8Array): string {
  const limit = 256 - (256 % CODE_ALPHABET.length); // reject bytes >= this to keep the draw uniform
  const chars: string[] = [];
  for (let i = 0; i < bytes.length && chars.length < 9; i++) {
    const b = bytes[i]!;
    if (b >= limit) continue;
    chars.push(CODE_ALPHABET[b % CODE_ALPHABET.length]!);
  }
  while (chars.length < 9) chars.push(CODE_ALPHABET[0]!);
  return `${chars.slice(0, 3).join("")}-${chars.slice(3, 6).join("")}-${chars.slice(6, 9).join("")}`;
}

/** Normalize a user-entered code (uppercase, strip separators/spaces) for comparison. Pure. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

const THROTTLE_BASE_MS = 1000;
const THROTTLE_CAP_MS = 60_000;
/** A device that entered the code but was never approved is dropped after this long. */
const PENDING_TTL_MS = 15 * 60 * 1000;

/** The delay before an IP with `fails` prior failures may try the code again (exponential, capped).
 *  Per-IP (never a global lockout, which would let one bad device lock the owner out). Pure. */
export function throttleDelayMs(fails: number): number {
  if (fails <= 0) return 0;
  return Math.min(THROTTLE_BASE_MS * 2 ** (fails - 1), THROTTLE_CAP_MS);
}

interface Attempt {
  fails: number;
  nextAllowedAt: number;
}

export interface LanHostOptions {
  /** injected clock (Date.now); tests pass a controllable one. */
  now: () => number;
}

export class LanHost {
  /** The plaintext code, kept so the host UI can show it. Never sent to a connecting device. */
  code = "";
  private codeHash = "";
  private sessions = new Map<string, LanSession>();
  private attempts = new Map<string, Attempt>();
  private readonly now: () => number;

  constructor(opts: LanHostOptions) {
    this.now = opts.now;
  }

  /** Generate a fresh code, hash it, and clear all sessions/attempts. Returns the plaintext code. */
  async reset(): Promise<string> {
    this.code = formatConnectCode(randomBytes(32)); // generous supply for rejection sampling
    this.codeHash = await Bun.password.hash(normalizeCode(this.code), { algorithm: "argon2id" });
    this.sessions.clear();
    this.attempts.clear();
    return this.code;
  }

  /** Verify a code from an IP, throttled per IP. On success the IP's failure count resets. */
  async verifyCode(ip: string, input: string): Promise<{ ok: boolean; retryAfterMs: number }> {
    const a = this.attempts.get(ip) ?? { fails: 0, nextAllowedAt: 0 };
    const wait = a.nextAllowedAt - this.now();
    if (wait > 0) return { ok: false, retryAfterMs: wait };
    const ok = this.codeHash !== "" && (await Bun.password.verify(normalizeCode(input), this.codeHash));
    if (ok) {
      this.attempts.delete(ip);
      return { ok: true, retryAfterMs: 0 };
    }
    const fails = a.fails + 1;
    const delay = throttleDelayMs(fails);
    this.attempts.set(ip, { fails, nextAllowedAt: this.now() + delay });
    return { ok: false, retryAfterMs: delay };
  }

  /** Create a pending session for a device that entered the code correctly. It is not served until the
   *  host approves it. Caps pending sessions per IP so the code alone cannot flood the approval list. */
  createPending(ip: string, label: string): string {
    this.sweepExpired();
    const pendingFromIp = [...this.sessions.values()].filter(
      (s) => s.status === "pending" && s.ip === ip,
    ).length;
    if (pendingFromIp >= 5) {
      // drop the oldest pending session from this IP before adding another
      const oldest = [...this.sessions.values()]
        .filter((s) => s.status === "pending" && s.ip === ip)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) this.sessions.delete(oldest.id);
    }
    const id = randomBytes(24).toString("base64url");
    this.sessions.set(id, { id, label: label || ip, ip, status: "pending", createdAt: this.now() });
    return id;
  }

  approve(id: string): void {
    const s = this.sessions.get(id);
    if (s && s.status === "pending") this.sessions.set(id, { ...s, status: "approved" });
  }

  /** Deny a pending device or kick an approved one; both just drop the session. */
  remove(id: string): void {
    this.sessions.delete(id);
  }

  status(id: string): LanSessionStatus | null {
    this.sweepExpired();
    return this.sessions.get(id)?.status ?? null;
  }

  pending(): LanSession[] {
    this.sweepExpired();
    return [...this.sessions.values()].filter((s) => s.status === "pending");
  }

  /** Drop pending sessions that were never approved within the TTL. Approved sessions never expire here
   *  (they are ended by a host kick or by disabling LAN mode). Idempotent, cheap, called on read/create. */
  private sweepExpired(): void {
    const cutoff = this.now() - PENDING_TTL_MS;
    for (const [id, s] of this.sessions) {
      if (s.status === "pending" && s.createdAt < cutoff) this.sessions.delete(id);
    }
  }

  connected(): LanSession[] {
    return [...this.sessions.values()].filter((s) => s.status === "approved");
  }
}
