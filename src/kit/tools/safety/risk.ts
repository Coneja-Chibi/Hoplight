/**
 * risk: the heart of the trust boundary. It maps a tool's access class onto a risk level and a human
 * reason, exhaustively and fail-closed. read is safe; write is caution; delete/egress/exec/unknown are
 * danger, with exec and unknown the non-negotiable floor (never auto-allowed anywhere, enforced in
 * gate-core). Total and tolerant: an out-of-range access fails toward danger and never throws. args is
 * accepted for the reason and future refinement only and NEVER lowers a level, a boundary can only get
 * stricter from its input, never looser.
 */
import { assertNever } from "./assert-never";

export type ToolAccess = "read" | "write" | "delete" | "egress" | "exec" | "unknown";
export type RiskLevel = "safe" | "caution" | "danger";

export interface RiskVerdict {
  readonly level: RiskLevel;
  readonly access: ToolAccess;
  readonly reason: string;
}

const ACCESSES = new Set<ToolAccess>(["read", "write", "delete", "egress", "exec", "unknown"]);
const isToolAccess = (v: unknown): v is ToolAccess =>
  typeof v === "string" && ACCESSES.has(v as ToolAccess);

const reasonFor = (access: ToolAccess, name: string): string => {
  switch (access) {
    case "read":
      return "reads a piece without changing anything";
    case "write":
      return "creates or updates a piece";
    case "delete":
      return "removes a piece - cannot be undone yet";
    case "egress":
      return "sends data off this machine";
    case "exec":
      return "runs an opaque payload - never auto-allowed";
    case "unknown":
      return name
        ? `unrecognized tool "${name}" - treated as dangerous`
        : "unrecognized tool - treated as dangerous";
    default:
      return assertNever("reasonFor", access);
  }
};

const levelFor = (access: ToolAccess): RiskLevel => {
  switch (access) {
    case "read":
      return "safe";
    case "write":
      return "caution";
    case "delete":
    case "egress":
    case "exec":
    case "unknown":
      return "danger";
    default:
      return assertNever("levelFor", access);
  }
};

/** Classify a dispatch into a risk verdict. Total and tolerant: an unrecognized access fails toward
 *  danger/unknown and never throws. args is never allowed to lower the resulting level. */
export function classifyRisk(access: ToolAccess, args?: unknown, name = ""): RiskVerdict {
  void args; // reserved for second-need refinement (SSRF host / wildcard-target); never lowers a level
  if (!isToolAccess(access)) {
    return { level: "danger", access: "unknown", reason: reasonFor("unknown", name) };
  }
  return { level: levelFor(access), access, reason: reasonFor(access, name) };
}
