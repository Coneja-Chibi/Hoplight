/**
 * The pure mapping from a session's TurnEvents onto what the screen shows: the transcript lines, the
 * live phase (waiting / thinking / typing), the open backstage cluster of tool moves, and whether
 * any tool has run this turn. Time is injected (now), never read, so this stays testable without a
 * clock. Extracted from the shell so the aliveness behavior is tested directly.
 *
 * Thinking (DECISIONS #25): reasoning deltas accumulate the live thought; it lands as a foldable
 * "thought" line the moment anything else happens. Tools (DECISIONS #26): from the first tool-start,
 * moves gather in a live BACKSTAGE cluster (the tool row IS the status, one performer on stage); the
 * model speaking or the turn ending SEALS the cluster into a foldable "backstage" line. Once a tool
 * has appeared, the stagehand never re-enters the turn (toolsSeen suppresses it).
 */
import type { TurnEvent } from "../session";

export type RenderLine =
  | { role: "you"; text: string }
  | { role: "say"; text: string }
  | { role: "tool"; text: string }
  | { role: "error"; text: string }
  | { role: "thought"; text: string; seconds: number; open: boolean }
  | { role: "backstage"; moves: string[]; seconds: number; open: boolean };

export type Live =
  | { phase: "idle" }
  | { phase: "waiting" }
  | { phase: "thinking"; text: string; since: number }
  | { phase: "typing"; text: string };

/** One move in the open backstage cluster; summary undefined means it is still running. */
export interface ToolMove {
  name: string;
  summary?: string;
}

export interface TurnView {
  lines: RenderLine[];
  live: Live;
  label: string;
  tools: { moves: ToolMove[]; since: number } | null;
  toolsSeen: boolean;
}

export const EMPTY_TOOLS = null;

/** A finished thought bows out of the live slot into a collapsed transcript line. */
const landThought = (view: TurnView, now: number): TurnView => {
  if (view.live.phase !== "thinking") return view;
  const seconds = Math.max(1, Math.round((now - view.live.since) / 1000));
  return {
    ...view,
    lines: [...view.lines, { role: "thought", text: view.live.text, seconds, open: false }],
    live: { phase: "waiting" },
  };
};

/** An open backstage cluster seals into a collapsed transcript line carrying its moves and duration. */
const sealTools = (view: TurnView, now: number): TurnView => {
  if (!view.tools) return view;
  const seconds = Math.max(1, Math.round((now - view.tools.since) / 1000));
  const moves = view.tools.moves.map((move) => move.summary ?? `${move.name} (interrupted)`);
  return {
    ...view,
    lines: [...view.lines, { role: "backstage", moves, seconds, open: false }],
    tools: null,
  };
};

/** Land any open thought and seal any open cluster: the wind-down before a plain line is pushed. */
const quiesce = (view: TurnView, now: number): TurnView => sealTools(landThought(view, now), now);

/** Fold one event into the view. Total: unknown events leave the view unchanged. */
export function applyTurnEvent(view: TurnView, event: TurnEvent, now: number): TurnView {
  switch (event.type) {
    case "begin":
      return { ...view, label: event.label, tools: null, toolsSeen: false };
    case "delta": {
      if (event.kind === "reasoning") {
        const text = (view.live.phase === "thinking" ? view.live.text : "") + event.text;
        const since = view.live.phase === "thinking" ? view.live.since : now;
        return { ...view, live: { phase: "thinking", text, since } };
      }
      const landed = landThought(view, now);
      const text = (landed.live.phase === "typing" ? landed.live.text : "") + event.text;
      return { ...landed, live: { phase: "typing", text } };
    }
    case "tool-start": {
      // The model stopped thinking to act: land the thought, open the cluster, and drop the stagehand.
      const landed = landThought(view, now);
      const tools = landed.tools ?? { moves: [], since: now };
      return {
        ...landed,
        tools: { ...tools, moves: [...tools.moves, { name: event.name }] },
        toolsSeen: true,
        live: { phase: "idle" },
      };
    }
    case "tool": {
      if (view.tools) {
        // Settle the running move (first without a summary), or append if none is running.
        const moves = [...view.tools.moves];
        const running = moves.findIndex((move) => move.summary === undefined);
        if (running >= 0) moves[running] = { ...moves[running]!, summary: event.summary };
        else moves.push({ name: event.name, summary: event.summary });
        return { ...view, tools: { ...view.tools, moves } };
      }
      // A standalone tool with no cluster (e.g. /test) lands as a plain teal row.
      const landed = landThought(view, now);
      return { ...landed, lines: [...landed.lines, { role: "tool", text: event.summary }] };
    }
    case "say": {
      const settled = quiesce(view, now);
      return { ...settled, lines: [...settled.lines, { role: "say", text: event.text }], live: { phase: "waiting" } };
    }
    case "stopped": {
      const settled = quiesce(view, now);
      return { ...settled, lines: [...settled.lines, { role: "say", text: event.reason }] };
    }
    case "error": {
      const settled = quiesce(view, now);
      return { ...settled, lines: [...settled.lines, { role: "error", text: event.message }] };
    }
    default:
      return view;
  }
}

/** A turn that ends mid-thought or mid-tool still lands its traces (the shell calls this after runTurn). */
export const settleTurn = (view: TurnView, now: number): TurnView => ({
  ...quiesce(view, now),
  live: { phase: "idle" },
});

/** Toggle a foldable trace (thought or backstage) open/closed: by line index, else the most recent. */
export function toggleTrace(view: TurnView, index?: number): TurnView {
  const foldable = (line: RenderLine): boolean => line.role === "thought" || line.role === "backstage";
  const at = index ?? view.lines.map((line, i) => (foldable(line) ? i : -1)).filter((i) => i >= 0).at(-1);
  if (at === undefined) return view;
  const line = view.lines[at];
  if (!line || (line.role !== "thought" && line.role !== "backstage")) return view;
  const lines = [...view.lines];
  lines[at] = { ...line, open: !line.open };
  return { ...view, lines };
}
