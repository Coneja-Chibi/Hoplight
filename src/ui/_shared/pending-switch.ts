/**
 * The restart-outcome marker: written to settings just before a version switch relaunches, read on the
 * next boot to decide what the confirmation popup shows. Pure core (reducer + tolerant reader); the
 * settings persistence is the shell. Comparisons via compareVersions (bare vs v-prefixed).
 */
import { compareVersions } from "./update-check";

export interface PendingSwitch {
  readonly from: string;
  readonly to: string;
  /** epoch ms when the switch was initiated */
  readonly at: number;
}

export type SwitchOutcome =
  | { kind: "success"; from: string; to: string }
  | { kind: "failed"; from: string; to: string }
  | { kind: "none" };

/** A pending marker older than this is stale (a switch days ago, or one that never resolved): discard. */
export const PENDING_SWITCH_TTL_MS = 15 * 60 * 1000;

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Tolerant reader for the persisted marker (survives round-trips through older versions). null if absent. */
export function readPendingSwitch(raw: unknown): PendingSwitch | null {
  if (!isRec(raw)) return null;
  const from = typeof raw.from === "string" ? raw.from : "";
  const to = typeof raw.to === "string" ? raw.to : "";
  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : 0;
  if (!from || !to || at <= 0) return null;
  return { from, to, at };
}

/**
 * Decide what the post-restart popup shows. `running` is the version that actually booted: landing on
 * `to` is success, still on `from` is a failed switch (nothing changed, back where we started), an expired
 * marker or one matching neither version is stale/alien and discarded. Pure.
 */
export function reducePendingSwitch(
  marker: PendingSwitch | null,
  running: string,
  now: number,
): SwitchOutcome {
  if (!marker) return { kind: "none" };
  if (now - marker.at > PENDING_SWITCH_TTL_MS) return { kind: "none" };
  if (compareVersions(running, marker.to) === 0) return { kind: "success", from: marker.from, to: marker.to };
  if (compareVersions(running, marker.from) === 0) return { kind: "failed", from: marker.from, to: marker.to };
  return { kind: "none" };
}
