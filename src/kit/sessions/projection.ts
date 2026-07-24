/**
 * Pure projections of a Session onto the shapes the shell needs: the model's wire history (for
 * resume), a one-line summary (for the playbill), and per-turn bounds (for the rewind rail). None of
 * these touch the render layer, so RenderLine never leaks into the sessions core. All total, no throw.
 */
import type { ModelMessage } from "../providers/provider";
import { deriveTitle, type ForkParent, type Session } from "./session-model";

/** A row in the resume playbill: the display title (user title else derived) plus glance metadata. */
export interface SessionSummary {
  readonly id: string;
  readonly displayTitle: string;
  readonly turnCount: number;
  readonly updatedAt: number;
  readonly parent: ForkParent | null;
}

/** A row in the rewind rail: the 1-based turn ordinal (also the keep-count for rewind/fork), its
 * timestamp, and a short preview of the opening input. */
export interface TurnBound {
  readonly turn: number;
  readonly at: number;
  readonly preview: string;
}

const PREVIEW_CAP = 60;

const preview = (input: string, cap: number = PREVIEW_CAP): string => {
  const clean = input.replace(/\s+/g, " ").trim();
  return clean.length > cap ? `${clean.slice(0, cap).trimEnd()}…` : clean;
};

/** The lossless wire history: every turn's messages concatenated in order. Feeds resume. */
export const toHistory = (session: Session): ModelMessage[] =>
  session.turns.flatMap((turn) => [...turn.messages]);

/** Collapse a session to its playbill row. displayTitle is the user title or the derived one. */
export const summarize = (session: Session): SessionSummary => ({
  id: session.id,
  displayTitle: session.title ?? deriveTitle(session.turns),
  turnCount: session.turns.length,
  updatedAt: session.updatedAt,
  parent: session.parent,
});

/** One bound per turn, ordinals 1..N, for the rewind rail. Empty session yields no rows. */
export const turnBounds = (session: Session): TurnBound[] =>
  session.turns.map((turn, index) => ({
    turn: index + 1,
    at: turn.at,
    preview: preview(turn.input),
  }));
