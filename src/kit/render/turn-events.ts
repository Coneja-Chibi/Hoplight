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
import type { TokenUsage } from "../providers/usage";
import type { DoctorResult } from "../doctor/check";
import { isLongSay } from "./say-fold";
import type { LoopPhase } from "../loop/state";

export type RenderLine =
  | { role: "you"; text: string }
  | { role: "say"; text: string; open?: boolean }
  | { role: "tool"; text: string }
  | { role: "error"; text: string }
  /**
   * A watcher notice. `path` is a real path on this machine, drawn as something clickable on its own
   * row rather than buried in the sentence - which is where a path is least useful, because it is the
   * one part of the line somebody needs to act on rather than read.
   */
  | { role: "watch"; text: string; path?: string }
  /**
   * An image pasted into the conversation, drawn where it was pasted.
   *
   * The BYTES ride on the line rather than a path, because the source is a clipboard and there is no
   * file to point at. Kit's providers take text only, so this is shown to the PERSON and not sent -
   * and the line says so, because an image that looks attached and is not would be the worst of both.
   */
  | { role: "image"; bytes: Uint8Array; width: number; height: number; note: string }
  /**
   * A piece's own card art, captioned with its name.
   *
   * Separate from `image` because it carries no width or height, and that absence is the point. A
   * pasted image is decoded here first so the note can state its real pixel size, which means PNG
   * only. Card art is whatever somebody imported: a JPEG card is at least as common as a PNG one,
   * and opentui's `<image>` decodes all of them. Letting the renderer size it is what makes a JPEG
   * portrait appear instead of reporting that it could not be read.
   */
  | { role: "portrait"; bytes: Uint8Array; caption: string; accent?: string }
  /**
   * A question with options, rendered as a list you pick from.
   *
   * Carried as DATA rather than as the sentence the model would otherwise have written, so the shell
   * decides how it looks and a model cannot offer a choice by merely claiming to.
   */
  | {
    role: "choices";
    question: string;
    options: readonly { value: string; note?: string }[];
    /**
     * What was sent in reply, once it has been.
     *
     * An answered panel collapses to this rather than keeping live options in the scrollback, where
     * they would invite answering the same question twice after the model had moved on.
     */
    answered?: string;
  }
  | { role: "doctor"; checks: DoctorResult[] }
  | { role: "thought"; text: string; seconds: number; open: boolean }
  | { role: "backstage"; moves: string[]; seconds: number; open: boolean; phase?: LoopPhase };

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
  tools: { moves: ToolMove[]; since: number; phase?: LoopPhase } | null;
  toolsSeen: boolean;
  /** The most recent API call's token usage (the meter reads .input for context fullness, the tally
   * reads in/out). Overwritten per usage event, so it reflects the turn's final context. */
  usage?: TokenUsage;
}

export const EMPTY_TOOLS = null;

/** A finished thought bows out of the live slot into a collapsed transcript line. */
const landThought = (view: TurnView, now: number): TurnView => {
  if (view.live.phase !== "thinking") return view;
  const seconds = Math.max(1, Math.round((now - view.live.since) / 1000));
  const prior = view.lines.at(-1);
  if (prior?.role === "thought" && !prior.open) {
    return {
      ...view,
      lines: [
        ...view.lines.slice(0, -1),
        {
          ...prior,
          text: `${prior.text}${view.live.text}`,
          seconds: prior.seconds + seconds,
        },
      ],
      live: { phase: "waiting" },
    };
  }
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
    lines: [...view.lines, {
      role: "backstage",
      moves,
      seconds,
      open: false,
      ...(view.tools.phase ? { phase: view.tools.phase } : {}),
    }],
    tools: null,
  };
};

/** Land any open thought and seal any open cluster: the wind-down before a plain line is pushed. */
const quiesce = (view: TurnView, now: number): TurnView => sealTools(landThought(view, now), now);

/** Preserve assistant text that streamed without a final say event (error, cancellation, disconnect). */
const landTyping = (view: TurnView): TurnView => {
  if (view.live.phase !== "typing" || !view.live.text) return view;
  return {
    ...view,
    lines: [...view.lines, { role: "say", text: view.live.text }],
    live: { phase: "waiting" },
  };
};

const quiesceInterrupted = (view: TurnView, now: number): TurnView => landTyping(quiesce(view, now));

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
      /**
       * A choice list is not a MOVE, so it does not fold into the backstage box.
       *
       * Everything else a tool does is work you can read afterwards; this is a question waiting for
       * an answer, and folding it into a collapsed "3 moves" row would hide the one thing on screen
       * that needs somebody to act. It lands as its own line, above the cluster.
       */
      if (event.choices) {
        const landed = landThought(view, now);
        return {
          ...landed,
          lines: [...landed.lines, {
            role: "choices",
            question: event.choices.question,
            options: event.choices.options,
          }],
        };
      }
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
    case "usage":
      // Overwrite (not accumulate): .usage tracks the latest call's counts, so the meter reads the
      // current context fullness. The shell accumulates the session tally from these events separately.
      return { ...view, usage: event.usage };
    case "state":
      return view.tools
        ? { ...view, tools: { ...view.tools, phase: event.phase } }
        : view;
    case "say": {
      const settled = quiesce(view, now);
      return { ...settled, lines: [...settled.lines, { role: "say", text: event.text }], live: { phase: "waiting" } };
    }
    case "stopped": {
      const settled = quiesceInterrupted(view, now);
      return {
        ...settled,
        lines: [...settled.lines, { role: "say", text: event.reason }],
        live: { phase: "waiting" },
      };
    }
    case "error": {
      const settled = quiesceInterrupted(view, now);
      return {
        ...settled,
        lines: [...settled.lines, { role: "error", text: event.message }],
        live: { phase: "waiting" },
      };
    }
    default:
      return view;
  }
}

/** A turn that ends mid-thought or mid-tool still lands its traces (the shell calls this after runTurn). */
export const settleTurn = (view: TurnView, now: number): TurnView => ({
  ...quiesceInterrupted(view, now),
  live: { phase: "idle" },
});

/** Toggle a foldable trace or settled long reply: by line index, else the most recent. */
export function toggleTrace(view: TurnView, index?: number): TurnView {
  const foldable = (line: RenderLine): boolean =>
    line.role === "thought" || line.role === "backstage" || (line.role === "say" && isLongSay(line.text));
  const at = index ?? view.lines.map((line, i) => (foldable(line) ? i : -1)).filter((i) => i >= 0).at(-1);
  if (at === undefined) return view;
  const line = view.lines[at];
  if (!line || !foldable(line)) return view;
  const lines = [...view.lines];
  if (line.role === "say") {
    lines[at] = { ...line, open: !line.open };
  } else if (line.role === "thought" || line.role === "backstage") {
    lines[at] = { ...line, open: !line.open };
  }
  return { ...view, lines };
}
