/**
 * What the Press tells the agent window about itself.
 *
 * THIS ROOM ONLY WORKS THE STAGED SET. There is no studio browser in here, so "what have you got"
 * has a different answer on this screen than it does on the Library's, and an agent that assumed
 * otherwise would offer to print pieces that are not in the queue at all.
 *
 * A RUN IS A CLAIM ABOUT FILES THAT EXIST. Rows that failed and rows the platform skipped are named,
 * not folded into a total, because "8 printed" and "8 printed, 3 skipped because this platform has
 * no lorebook format" are the same run and only one of them is worth acting on.
 *
 * Pure builder, separate from the room, so the sentences can be checked without a browser.
 */
import { useEffect, useRef } from "react";
import type { AgentState, AgentSurfaceSpec } from "../../agent/surface";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { foldSummary, type RunRow } from "./press-core";
import { pieceKeyOf } from "./press-bundles";

/**
 * The static half, which the manifest carries.
 *
 * The actions are conversational. The turn has no tool belt yet (server-agent.ts says so out loud),
 * so "run the press for me" would be a capability nobody has; explaining what a run will cost is one
 * the model already has, and is the question this room actually raises.
 */
export const PRESS_AGENT_SURFACE: AgentSurfaceSpec = {
  describe:
    "The staged conversion queue. Pieces are staged here from the Library, one target platform is " +
    "chosen for the whole run, and the run prints them into a single zip.",
  actions: [
    {
      id: "explain-readiness",
      label: "Explain what a run will cost",
      describe:
        "Say what the chosen platform will carry and what it will drop for a staged piece, before " +
        "the run happens rather than after.",
    },
    {
      id: "choose-target",
      label: "Help choose a target",
      describe: "Say which platform suits what is staged, and which staged kinds it cannot print at all.",
    },
  ],
};

export function pressAgentState(input: {
  /** The staged queue: the only pieces this room can print. */
  readonly queue: readonly StudioEntitySummary[];
  /** Friendly platform name for the run, "" while none is chosen. */
  readonly target: string;
  /** Rows of the run on the sheet, or null when none has been planned since the queue changed. */
  readonly rows: readonly RunRow[] | null;
  /** A run is printing right now, so the rows are still moving. */
  readonly running: boolean;
  /** A finished bundle is sitting there waiting for a download that has not happened. */
  readonly zipReady: boolean;
  /** The studio list did not load, which costs the target chips and every readiness check. */
  readonly loadFailed: boolean;
}): AgentState {
  const notes: string[] = [];

  /**
   * SAID FIRST, because everything after it is degraded. The queue itself is shell state and
   * survives a failed load, but the platform list and every readiness line come from the studio, so
   * a silent failure here reads on screen as "this platform has nothing to say about your piece".
   */
  if (input.loadFailed) {
    notes.push(
      "The studio could not be reached, so the target platforms and every readiness check on this " +
        "screen may be missing rather than clean.",
    );
  }

  if (input.target === "") {
    notes.push("No target platform is chosen yet, so nothing can print until one is picked.");
  }

  if (input.rows) {
    notes.push(input.running ? `A run is printing now: ${foldSummary(input.rows)}.` : `The last run: ${foldSummary(input.rows)}.`);
    /**
     * Named with their reasons. A skip is usually the platform refusing a whole kind and a failure
     * is usually one piece; folding both into a count turns "your lorebooks will not print at all"
     * into a number nobody asks about.
     */
    const troubled = input.rows.filter((r) => r.status === "fail" || r.status === "skip");
    if (troubled.length > 0) {
      notes.push(
        `${String(troubled.length)} row(s) did not print: ` +
          troubled.map((r) => `${r.kind}/${r.id} (${r.status}${r.note ? `: ${r.note}` : ""})`).join(", "),
      );
    }
  }

  if (input.zipReady) {
    notes.push("A finished bundle is waiting on the sheet and has not been downloaded yet.");
  }

  if (input.queue.length === 0) {
    notes.push("Nothing is staged. Pieces are staged from the Library, not browsed for in here.");
  }

  return {
    headline:
      input.queue.length === 0
        ? "The Press, with nothing staged."
        : input.target === ""
          ? `The Press, ${String(input.queue.length)} piece(s) staged, no target platform chosen.`
          : `The Press, ${String(input.queue.length)} piece(s) staged, set to print for ${input.target}.`,
    /**
     * THE QUEUE, NOT THE STUDIO. The offer rail on the left lists everything unstaged, but those are
     * pieces this room will not touch - handing them over would describe the Library twice and bury
     * the six pieces somebody actually intends to print.
     */
    items: input.queue.map((p) => ({ kind: p.kind, id: p.id, name: p.name })),
    notes,
  };
}

/**
 * Publish the queue, and LEAVE IT PUBLISHED.
 *
 * No cleanup on unmount, deliberately: the shell swaps apps through one slot, so opening the agent
 * window unmounts the room the window exists to describe. See live-state.ts.
 *
 * Dependencies are compared by VALUE. `queue` and `rows` are rebuilt on every render of the room, so
 * they are reduced to fingerprints; passing them by identity republished on every keystroke.
 */
export function usePublishPressSurface(
  ctx: AppContext,
  input: Parameters<typeof pressAgentState>[0],
): void {
  const { queue, target, rows, running, zipReady, loadFailed } = input;
  const queueKey = queue.map(pieceKeyOf).join(",");
  /** Statuses, not row objects: a run is exactly the sequence of verdicts it produced. */
  const rowsKey = rows ? rows.map((r) => `${r.kind}:${r.id}:${r.status}`).join(",") : "";

  /**
   * `ctx` is held rather than depended on. The shell rebuilds it on EVERY store write, and having it
   * in the dependency list republishes the outgoing screen under the incoming app's name during an
   * app switch.
   */
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    ctxRef.current.agent.publish(
      pressAgentState({ queue, target, rows, running, zipReady, loadFailed }),
    );
    // queueKey and rowsKey stand in for queue and rows, which are new arrays on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey, rowsKey, target, running, zipReady, loadFailed]);
}
