/**
 * The sessions state machine: the one canonical on-disk shape and every pure op over it. A Session is
 * a per-turn log of the exact ModelMessage deltas the model saw (lossless wire history); the rendered
 * transcript and any export are pure projections of these messages, never stored here. Clock and id
 * are injected (now, newId) so every op is deterministic and testable without a clock. Total: each op
 * returns a whole new Session, never mutates its input, never throws. Mirrors the recall.ts shape.
 */
import type { ModelMessage } from "../providers/provider";
import { truncateGraphemes } from "../_shared/graphemes";

/** Where a fork branched from: the parent's id and how many of its turns were copied. */
export interface ForkParent {
  readonly id: string;
  readonly turn: number;
}

/** One turn: the user's opening text (for titles + rewind previews) and the exact wire messages it
 * produced (user + assistant + tool messages), captured as the delta the loop appended to history. */
export interface SessionTurn {
  readonly input: string;
  readonly messages: readonly ModelMessage[];
  readonly at: number;
}

/** The canonical session record. version gates the parse boundary; title null means derive at read. */
export interface Session {
  readonly version: 1;
  readonly id: string;
  readonly title: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly parent: ForkParent | null;
  readonly turns: readonly SessionTurn[];
  /**
   * The preset the rail was following, so resuming puts it back.
   *
   * Resume restored the conversation and left the rail shut, which is not a restore failure -
   * this was never written down. A session is what you were working ON as well as what was said,
   * and coming back to a preset you had open is the difference between resuming and re-finding.
   *
   * OPTIONAL AND ADDITIVE. Sessions written before this exist on disk and must keep loading, so
   * an absent field reads as null rather than denying the file.
   */
  readonly rail: string | null;
}

const TITLE_CAP = 48;
const FALLBACK_TITLE = "Untitled session";

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

/** A fresh, empty session stamped with one clock reading (created == updated) and no parent. */
export const emptySession = (id: string, now: number): Session => ({
  version: 1,
  id,
  title: null,
  createdAt: now,
  updatedAt: now,
  parent: null,
  turns: [],
  rail: null,
});

/** Package a completed turn: its opening input, the wire delta it produced, and when it landed. */
export const buildTurn = (
  input: string,
  messages: readonly ModelMessage[],
  now: number,
): SessionTurn => ({ input, messages, at: now });

/** Append a turn and advance updatedAt to that turn's timestamp (the session's last activity). */
export const appendTurn = (session: Session, turn: SessionTurn): Session => ({
  ...session,
  turns: [...session.turns, turn],
  updatedAt: turn.at,
});

/**
 * Remember which preset the rail is on. Null closes it, which is a real state worth storing:
 * somebody who shut the rail should not have it reopen on them next time.
 */
export const withRail = (session: Session, presetId: string | null): Session =>
  session.rail === presetId ? session : { ...session, rail: presetId };

/** Truncate to the first `keep` turns, dropping the tail. Clamped to [0, length]; keeping all (or
 * more) is a no-op that leaves the session untouched so an out-of-range scrub never mutates. */
export const rewindTo = (session: Session, keep: number, now: number): Session => {
  const bound = clamp(keep, 0, session.turns.length);
  if (bound >= session.turns.length) return session;
  return { ...session, turns: session.turns.slice(0, bound), updatedAt: now };
};

/** Branch a new session from the first `keep` turns of the source, recording the parent link. The
 * source is never mutated (slice copies); keep is clamped so an index-0 fork yields a valid blank. */
export const forkFrom = (
  session: Session,
  keep: number,
  newId: string,
  now: number,
): Session => {
  const bound = clamp(keep, 0, session.turns.length);
  return {
    version: 1,
    id: newId,
    title: null,
    createdAt: now,
    updatedAt: now,
    parent: { id: session.id, turn: bound },
    turns: session.turns.slice(0, bound),
    // A fork inherits what was on screen: branching from a conversation about a preset lands you on
    // that preset, which is the point of branching there rather than starting fresh.
    rail: session.rail,
  };
};

/** Set (or clear) the user title without touching turns or lineage. Blank clears back to derived. */
export const renameSession = (session: Session, title: string, now: number): Session => {
  const trimmed = title.trim();
  return { ...session, title: trimmed.length > 0 ? trimmed : null, updatedAt: now };
};

/** A one-line title from the first turn's input: whitespace collapsed, capped, else a stable fallback. */
export const deriveTitle = (turns: readonly SessionTurn[], cap: number = TITLE_CAP): string => {
  const first = turns[0]?.input.replace(/\s+/g, " ").trim() ?? "";
  if (!first) return FALLBACK_TITLE;
  return truncateGraphemes(first, cap);
};
