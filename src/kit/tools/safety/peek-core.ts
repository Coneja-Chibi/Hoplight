/**
 * peek-core: turn a tool's untrusted (name, args) into a compact, redacted, bounded preview for the
 * confirm pause. Pure and clock-free. Secrets are stripped (any key that looks like a credential renders
 * as ***), the detail is length-capped (bomb protection against unbounded args), and a non-object args
 * value degrades to a labeled placeholder rather than throwing. The verdict supplies the level and the
 * human reason; this core only shapes the readable summary.
 */
import type { RiskLevel, RiskVerdict } from "./risk";

export interface PeekView {
  readonly title: string; // "verb target", e.g. "delete lorebook/old-notes"
  readonly detail: string; // key args, redacted and bounded; "" when the target says it all
  readonly level: RiskLevel;
  readonly reason: string;
}

const MAX_DETAIL = 160; // cap the args line: never dump unbounded untrusted JSON
const MAX_VALUE = 40; // cap any single value before the whole-line cap
const SHOW_FIELDS = 3; // show at most this many arg fields, then "+N fields"
const SECRET_KEY = /(key|token|secret|password|authorization|apikey)/i;

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, Math.max(0, max - 3))}...`;

const str = (v: unknown): string => (typeof v === "string" && v.length > 0 ? v : "");

/** A plain (non-array) object, or null for anything else. Tolerant reader over untrusted args. */
const plainObject = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** A short, safe rendering of one arg value. Strings quoted and capped; containers summarized. */
const fmtValue = (v: unknown): string => {
  if (typeof v === "string") return `"${truncate(v, MAX_VALUE)}"`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v === null) return "null";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{...}";
  return "?";
};

interface Target {
  readonly label: string;
  readonly consumed: readonly string[];
}

/** Pull a human target from the common arg keys (kind/id, then id, then path, then name). */
const extractTarget = (obj: Record<string, unknown>): Target => {
  const kind = str(obj.kind);
  const id = str(obj.id);
  if (kind && id) return { label: `${kind}/${id}`, consumed: ["kind", "id"] };
  if (id) return { label: id, consumed: ["id"] };
  const path = str(obj.path);
  if (path) return { label: path, consumed: ["path"] };
  const name = str(obj.name);
  if (name) return { label: name, consumed: ["name"] };
  return { label: "", consumed: [] };
};

/** The args line: the fields left after the target, redacted and bounded. */
const describeArgs = (obj: Record<string, unknown>, consumed: readonly string[]): string => {
  const keys = Object.keys(obj);
  if (keys.length === 0) return "no arguments";
  const consumedSet = new Set(consumed);
  const rest = keys.filter((k) => !consumedSet.has(k));
  if (rest.length === 0) return ""; // the title already carries the whole story
  const shown = rest
    .slice(0, SHOW_FIELDS)
    .map((k) => `${k}: ${SECRET_KEY.test(k) ? "***" : fmtValue(obj[k])}`);
  const extra = rest.length - shown.length;
  const overflow = extra > 0 ? `   +${extra} field${extra === 1 ? "" : "s"}` : "";
  return truncate(`${shown.join("   ")}${overflow}`, MAX_DETAIL);
};

/** Summarize a dispatch into a legible, credential-free, bounded preview. Never throws. */
export function summarizePeek(name: string, args: unknown, verdict: RiskVerdict): PeekView {
  const obj = plainObject(args);
  const target = obj ? extractTarget(obj) : { label: "", consumed: [] as string[] };
  const title = target.label ? `${name} ${target.label}` : name;
  const detail = obj
    ? describeArgs(obj, target.consumed)
    : args === undefined || args === null
      ? "no arguments"
      : "(unrecognized args)";
  return { title, detail, level: verdict.level, reason: verdict.reason };
}
