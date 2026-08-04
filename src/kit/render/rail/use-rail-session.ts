/**
 * The rail, wired to a session: opening it, and what enter does.
 *
 * WHY THIS EXISTS SEPARATELY FROM useRail. That hook is the rail's own state and knows nothing about
 * storage, gates or transcripts, which is what makes its editing logic testable without any of them.
 * This is the join: it hands the rail a commit that stages a draft, pauses on the REAL gate, applies
 * once, and reports the receipt. The shell only learns two things - a pane to render and a pair of
 * commands - which is what keeps it under its line cap.
 *
 * The gate seam is called directly rather than through a turn. A person rearranging blocks by hand is
 * not in a turn, and inventing a second confirmation surface for them would mean two ways to be asked
 * about a write with two chances to be inconsistent.
 */
import { useCallback, useRef } from "react";
import type { Session } from "../../session";
import type { GateController } from "../safety/use-gate";
import type { OutlineRow } from "../../../core/preset/outline";
import { commitRail } from "./commit-rail";
import { openRail } from "./open-rail";
import { useRail, type RailSession } from "./use-rail";

export interface RailWithCommands extends RailSession {
  /** Handed every turn event so the model can put a preset up without the shell parsing prose. */
  readonly onTurnEvent: (event: { type: string; show?: { kind: string; id: string } }) => void;
  /** What /rail calls. Shaped for CommandContext so the shell passes it straight through. */
  readonly commands: {
    open: (query: string) => Promise<{ ok: true } | { ok: false; detail: string }>;
    close: () => void;
  };
}

export function useRailSession(
  session: Session,
  gate: GateController,
  say: (text: string) => void,
  rowsVisible: () => number = () => 20,
): RailWithCommands {
  // `presetId` is read at commit time rather than captured, because the rail can be pointed at a
  // different preset between opening it and pressing enter.
  //
  // A useRef and not a plain object. The first version was `{ current: null }` built inline, which
  // is a NEW object every render while the memoised callback still holds the one from the render it
  // was created in - so the id assigned below never reached the closure that reads it, and enter
  // would have written to whichever preset was open when the callback was last rebuilt. The lint
  // caught it as a missing dependency, which is the same bug wearing its other face.
  const railRef = useRef<RailSession | null>(null);

  const commit = useCallback(async (rows: readonly OutlineRow[]): Promise<boolean> => {
    const id = railRef.current?.presetId;
    const presets = session.presets;
    if (!id || !presets) {
      say("The rail is not following a preset.");
      return false;
    }
    const outcome = await commitRail(id, rows, {
      stage: presets.stage,
      commit: presets.commit,
      discard: presets.discard,
      // The same pause a model draft gets, reached without a turn.
      confirm: (request) => gate.seam().requestConfirm!(request),
      say,
    });
    return outcome.applied;
  }, [session, gate, say]);

  const rail = useRail(rowsVisible, commit);
  railRef.current = rail;

  /**
   * React to a turn event that asks for a piece to be shown.
   *
   * Only `preset` and only when nothing is unapplied. Yanking the rail to a different preset out
   * from under somebody mid-rearrange would lose their work with no event to point at, and the model
   * has no way to know they were busy.
   */
  const onTurnEvent = useCallback((event: { type: string; show?: { kind: string; id: string } }) => {
    if (event.type !== "tool" || event.show?.kind !== "preset") return;
    if (rail.pending > 0) return;
    void openRail(session.presets, event.show.id, rail.follow);
  }, [session, rail]);

  return {
    ...rail,
    onTurnEvent,
    commands: {
      open: (query) => openRail(session.presets, query, rail.follow),
      close: rail.close,
    },
  };
}
