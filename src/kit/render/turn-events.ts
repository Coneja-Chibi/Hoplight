/**
 * The pure mapping from a session's TurnEvents onto what the screen shows: the transcript lines,
 * the live phase (waiting / thinking / typing), and who is answering. Extracted from the shell so
 * the aliveness behavior is tested directly, no terminal or model required.
 */
import type { TurnEvent } from "../session";

export type RenderLine =
  | { role: "you"; text: string }
  | { role: "say"; text: string }
  | { role: "tool"; text: string }
  | { role: "error"; text: string };

export type Live =
  | { phase: "idle" }
  | { phase: "waiting" }
  | { phase: "thinking"; chars: number }
  | { phase: "typing"; text: string };

export interface TurnView {
  lines: RenderLine[];
  live: Live;
  label: string;
}

/** Fold one event into the view. Total: unknown events leave the view unchanged. */
export function applyTurnEvent(view: TurnView, event: TurnEvent): TurnView {
  switch (event.type) {
    case "begin":
      return { ...view, label: event.label };
    case "delta": {
      if (event.kind === "reasoning") {
        const chars = (view.live.phase === "thinking" ? view.live.chars : 0) + event.text.length;
        return { ...view, live: { phase: "thinking", chars } };
      }
      const text = (view.live.phase === "typing" ? view.live.text : "") + event.text;
      return { ...view, live: { phase: "typing", text } };
    }
    case "say":
      // The turn may continue into tools after a say, so the live row returns to waiting.
      return { ...view, lines: [...view.lines, { role: "say", text: event.text }], live: { phase: "waiting" } };
    case "tool":
      return { ...view, lines: [...view.lines, { role: "tool", text: event.summary }], live: { phase: "waiting" } };
    case "stopped":
      return { ...view, lines: [...view.lines, { role: "say", text: event.reason }] };
    case "error":
      return { ...view, lines: [...view.lines, { role: "error", text: event.message }] };
    default:
      return view;
  }
}
