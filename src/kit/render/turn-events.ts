/**
 * The pure mapping from a session's TurnEvents onto what the screen shows: the transcript lines,
 * the live phase (waiting / thinking / typing), and who is answering. Time is injected (now), never
 * read, so this stays testable without a clock. Extracted from the shell so the aliveness behavior
 * is tested directly, no terminal or model required.
 *
 * Thinking (DECISIONS #25): reasoning deltas accumulate the live thought; the moment anything else
 * happens (reply text, a tool, the end of the turn) the thought LANDS as a persistent "thought"
 * transcript line carrying its duration, collapsed by default and toggleable.
 */
import type { TurnEvent } from "../session";

export type RenderLine =
  | { role: "you"; text: string }
  | { role: "say"; text: string }
  | { role: "tool"; text: string }
  | { role: "error"; text: string }
  | { role: "thought"; text: string; seconds: number; open: boolean };

export type Live =
  | { phase: "idle" }
  | { phase: "waiting" }
  | { phase: "thinking"; text: string; since: number }
  | { phase: "typing"; text: string };

export interface TurnView {
  lines: RenderLine[];
  live: Live;
  label: string;
}

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

/** Fold one event into the view. Total: unknown events leave the view unchanged. */
export function applyTurnEvent(view: TurnView, event: TurnEvent, now: number): TurnView {
  switch (event.type) {
    case "begin":
      return { ...view, label: event.label };
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
    case "say": {
      const landed = landThought(view, now);
      // The turn may continue into tools after a say, so the live row returns to waiting.
      return {
        ...landed,
        lines: [...landed.lines, { role: "say", text: event.text }],
        live: { phase: "waiting" },
      };
    }
    case "tool": {
      const landed = landThought(view, now);
      return {
        ...landed,
        lines: [...landed.lines, { role: "tool", text: event.summary }],
        live: { phase: "waiting" },
      };
    }
    case "stopped": {
      const landed = landThought(view, now);
      return { ...landed, lines: [...landed.lines, { role: "say", text: event.reason }] };
    }
    case "error": {
      const landed = landThought(view, now);
      return { ...landed, lines: [...landed.lines, { role: "error", text: event.message }] };
    }
    default:
      return view;
  }
}

/** A turn that ends mid-thought still lands its trace (the shell calls this after runTurn). */
export const settleTurn = (view: TurnView, now: number): TurnView => ({
  ...landThought(view, now),
  live: { phase: "idle" },
});

/** Toggle a thought trace open/folded: by line index when given, else the most recent trace. */
export function toggleThought(view: TurnView, index?: number): TurnView {
  const at =
    index ?? view.lines.map((line, i) => (line.role === "thought" ? i : -1)).filter((i) => i >= 0).at(-1);
  if (at === undefined) return view;
  const line = view.lines[at];
  if (!line || line.role !== "thought") return view;
  const lines = [...view.lines];
  lines[at] = { ...line, open: !line.open };
  return { ...view, lines };
}
