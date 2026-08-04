/**
 * What a crossing costs, arranged so a person can answer "should I write this file?".
 *
 * WHY THIS IS NOT A DraftReview. A draft changes one piece and the honest picture is before-and-after
 * per field. A crossing rewrites a piece into another engine's dialect, and the honest picture is
 * per-thing fate: this one dies, these forty are respelled, the rest arrive intact. Forcing that into
 * before/after rows loses the only distinction that matters, which is whether a change costs anything.
 *
 * THE SHAPE CAME FROM RUNNING ONE. A real preset crossing RoleCall to SillyTavern reported 133
 * rewrites, 2 removals and 0 dead macros. A panel built for the loss report we assumed would have led
 * with three empty categories and buried the only event that actually happened. So rewrites get their
 * own band: they are not losses, but 133 strings coming out spelled differently is not nothing either,
 * and someone searching the exported file for the old spelling will find none of it.
 *
 * PURE. Takes a report, returns rows. No conversion, no filesystem, no rendering.
 */
import type { ContentKind } from "../../entities/capabilities";
import type { MacroChange } from "../../core/preset/macros/translate";

/**
 * How much a row costs the reader.
 *
 *   removed    it is gone on the other side; someone has to decide what to do about it
 *   rewritten  same meaning, different spelling; nothing to decide, but worth knowing
 *   carried    arrives intact
 */
export type CrossingSeverity = "removed" | "rewritten" | "carried";

export interface CrossingRow {
  readonly severity: CrossingSeverity;
  /** What it is on the source side. */
  readonly from: string;
  /** What becomes of it on the target side. */
  readonly to: string;
  /** How many of this exact shape. Absent for a one-off, which is every removal. */
  readonly count?: number;
  /** Which block it lives in, so a reader knows what to open. Removals carry it; groups cannot. */
  readonly where?: string;
}

export interface CrossingReview {
  readonly kind: "crossing";
  readonly target: { readonly kind: ContentKind; readonly id: string };
  /** The target format, named as a person would say it. */
  readonly to: string;
  readonly rows: readonly CrossingRow[];
  /** True when the source's own escrow will not be written into the file. */
  readonly escrowDropped: boolean;
  readonly warningCount: number;
}

export interface CrossingInput {
  readonly target: { readonly kind: ContentKind; readonly id: string };
  readonly to: string;
  readonly changes: readonly MacroChange[];
  /** Things that arrive intact, already counted by the caller: blocks, setting groups. */
  readonly carried?: readonly { readonly label: string; readonly count: number }[];
  readonly escrowDropped?: boolean;
  readonly warningCount?: number;
}

/** Enough removals to see the shape of the problem; more than this and the panel is a list, not a
 *  decision. The overflow row keeps the true total visible so nothing is silently truncated. */
const MAX_REMOVED = 6;

/**
 * The macro family a token belongs to, for grouping rewrites.
 *
 * Grouped rather than listed because 48 individually-listed `{{random}}` rewrites is a wall that says
 * exactly what one row and a count says. Removals are never grouped: each one is a decision.
 */
const familyOf = (token: string): string => {
  const name = /\{\{\s*([a-z_][a-z0-9_]*)/i.exec(token)?.[1];
  return name ? `{{${name.toLowerCase()}}}` : token.slice(0, 24);
};

/**
 * The block a change lives in, as a person would name it.
 *
 * The translator reports a path - `prompts[Language Selector].content` - which is precise and reads
 * like a stack trace. What a reader needs is the block they have to open, so the path is reduced to
 * the name inside the brackets and everything else is dropped. A path in an unexpected shape is
 * passed through rather than mangled.
 */
const blockOf = (where: string): string => /\[([^\]]+)\]/.exec(where)?.[1] ?? where;

/**
 * Build the ledger.
 *
 * `same` changes are dropped entirely: a macro that means the same thing and is spelled the same way
 * is not an event, and showing it would bury the two that are.
 */
export function reviewCrossing(input: CrossingInput): CrossingReview {
  const rows: CrossingRow[] = [];

  // Removals first, and never collapsed: each is a thing somebody has to decide about.
  const removed = input.changes.filter((c) => c.kind === "absent" || c.kind === "collision");
  for (const change of removed.slice(0, MAX_REMOVED)) {
    rows.push({
      severity: "removed",
      from: change.from,
      to: change.kind === "collision" ? "left as-is · needs review" : "removed · no such macro",
      ...(change.where ? { where: blockOf(change.where) } : {}),
    });
  }
  if (removed.length > MAX_REMOVED) {
    rows.push({
      severity: "removed",
      from: `${removed.length - MAX_REMOVED} more`,
      to: "removed · no such macro",
    });
  }

  // Rewrites, grouped by family and ordered by how many, so the biggest change reads first.
  const families = new Map<string, { to: string; count: number }>();
  for (const change of input.changes) {
    if (change.kind !== "rewrite" && change.kind !== "flatten") continue;
    const key = familyOf(change.from);
    const seen = families.get(key);
    if (seen) seen.count += 1;
    else families.set(key, { to: change.kind === "flatten" ? "expanded inline" : "respelled", count: 1 });
  }
  for (const [family, { to, count }] of [...families].sort((a, b) => b[1].count - a[1].count)) {
    rows.push({ severity: "rewritten", from: family, to, count });
  }

  // Carried rows read as a quantity, not a name with a multiplier: "150 blocks", never "blocks x150".
  // The count belongs in the phrase because nothing happened to them and there is no per-item fate.
  for (const carried of input.carried ?? []) {
    const phrase = `${carried.count} ${carried.label}`;
    rows.push({ severity: "carried", from: phrase, to: phrase });
  }

  return {
    kind: "crossing",
    target: input.target,
    to: input.to,
    rows,
    escrowDropped: input.escrowDropped === true,
    warningCount: input.warningCount ?? 0,
  };
}

/** Does this crossing cost anything a person must decide about? Drives the frame colour. */
export const crossingIsLossy = (review: CrossingReview): boolean =>
  review.rows.some((row) => row.severity === "removed");

/** One line for a transcript or a summary, when the full panel is not on screen. */
export function summarizeCrossing(review: CrossingReview): string {
  const count = (severity: CrossingSeverity): number =>
    review.rows
      .filter((row) => row.severity === severity)
      .reduce((sum, row) => sum + (row.count ?? 1), 0);
  const removed = count("removed");
  const rewritten = count("rewritten");
  const parts = [
    removed > 0 ? `${removed} removed` : null,
    rewritten > 0 ? `${rewritten} rewritten` : null,
  ].filter(Boolean);
  return parts.length === 0
    ? `${review.target.kind}/${review.target.id} crosses to ${review.to} unchanged`
    : `${review.target.kind}/${review.target.id} → ${review.to}: ${parts.join(", ")}`;
}
