/**
 * The Press's functional core (the Job Sheet, vs-press option 1): platform grouping, run planning,
 * filename minting, payload bytes, and the summary line. Pure over FormatInfo/StudioEntitySummary
 * shapes; the room (index.tsx) owns fetching, running, and the zip download edge.
 */
import type { FormatInfo, StudioEntitySummary } from "../../app-contract";

/** One target platform chip: a friendly name and its adapter per piece kind. */
export interface PressPlatform {
  friendly: string;
  /** kind -> the adapter that prints that kind on this platform */
  byKind: Record<string, FormatInfo>;
}

/**
 * Group the live format roster into target platforms by friendly name. Native formats are not
 * publish targets (the studio already speaks them); one adapter per kind wins per platform (the
 * roster never carries duplicates for the same friendly+kind today; first-in wins if it ever does).
 */
export function groupPlatforms(formats: readonly FormatInfo[]): PressPlatform[] {
  const byFriendly = new Map<string, PressPlatform>();
  for (const f of formats) {
    if (f.native) continue;
    const entry = byFriendly.get(f.friendly) ?? { friendly: f.friendly, byKind: {} };
    if (entry.byKind[f.kind] === undefined) entry.byKind[f.kind] = f;
    byFriendly.set(f.friendly, entry);
  }
  return [...byFriendly.values()].sort((a, b) => a.friendly.localeCompare(b.friendly));
}

export type RunStatus = "wait" | "ok" | "warn" | "fail" | "skip";

export interface RunRow {
  id: string;
  kind: string;
  name: string;
  status: RunStatus;
  /** the honest line under the row: skip reason or the failure message */
  note?: string;
  /** neutral facts under an ok row (what the piece carries), never a warning */
  info?: string;
  /** filled once printed: the file's name inside the zip */
  filename?: string;
  /** the adapter that prints this row; absent on skip rows */
  targetId?: string;
}

/**
 * Plan a run: one row per picked piece. A kind the platform cannot print becomes a skip row up
 * front (honest before the run, not a surprise after), everything else waits its turn.
 */
export function planRun(picked: readonly StudioEntitySummary[], platform: PressPlatform): RunRow[] {
  return picked.map((p) => {
    const adapter = platform.byKind[p.kind];
    if (!adapter) {
      return {
        id: p.id,
        kind: p.kind,
        name: p.name,
        status: "skip",
        note: `${platform.friendly} has no ${p.kind} format`,
      };
    }
    return { id: p.id, kind: p.kind, name: p.name, status: "wait", targetId: adapter.id };
  });
}

/** Sanitize a piece name into a zip-safe base (same discipline as the single-export download). */
const safeBase = (name: string): string =>
  (name.trim() || "piece").replace(/[-<>:"/\|?* ]/g, "_").slice(0, 80);

/** Mint a unique filename inside the run's zip; collisions count up (adrian.json, adrian-2.json). */
export function mintFilename(name: string, extension: string, taken: Set<string>): string {
  const ext = extension.replace(/^\./, "") || "bin";
  const base = safeBase(name);
  let candidate = `${base}.${ext}`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}.${ext}`;
  taken.add(candidate);
  return candidate;
}

/** Export payload -> bytes for the zip (text encodes as UTF-8; b64 decodes; empty is a fail). */
export function payloadBytes(payload: { text?: string; bytesB64?: string }): Uint8Array | null {
  if (typeof payload.text === "string") return new TextEncoder().encode(payload.text);
  if (payload.bytesB64) {
    const bin = atob(payload.bytesB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return null;
}

/** The footer's honest tally. Only states that occurred get named; "wait" means the run is live. */
export function foldSummary(rows: readonly RunRow[]): string {
  if (rows.length === 0) return "nothing picked yet";
  const count = (s: RunStatus): number => rows.filter((r) => r.status === s).length;
  const waiting = count("wait");
  const bits: string[] = [];
  const printed = count("ok") + count("warn");
  if (printed > 0) bits.push(`${printed} printed`);
  if (count("warn") > 0) bits.push(`${count("warn")} with notes`);
  if (count("fail") > 0) bits.push(`${count("fail")} failed`);
  if (count("skip") > 0) bits.push(`${count("skip")} skipped`);
  if (waiting > 0) bits.push(`${waiting} waiting`);
  return bits.length > 0 ? bits.join(" · ") : `${rows.length} on the sheet`;
}

/** The user-pickable output flavor: the format's normal extension, or plain-text wrappers. */
export type FileFlavor = "normal" | "txt" | "md";

/** Flavor picking is offered only for text wire formats; a .charx as .md would be a lie. */
export const flavorChoosable = (normalExt: string): boolean => {
  const e = normalExt.replace(/^\./, "").toLowerCase();
  return e === "json" || e === "txt" || e === "md";
};

/** The extension a row actually prints with. */
export const flavorExtension = (normalExt: string, flavor: FileFlavor): string =>
  flavor === "normal" ? normalExt : flavor;
