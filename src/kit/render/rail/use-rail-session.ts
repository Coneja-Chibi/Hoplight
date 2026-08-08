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
import { railRowsVisible } from "./rail-pane";

export interface RailWithCommands extends RailSession {
  /** Handed every turn event so the model can put a preset up without the shell parsing prose. */
  readonly onTurnEvent: (event: { type: string; show?: { kind: string; id: string } }) => void;
  /** Step to the next (+1) or previous (-1) preset in the studio order. Bound to `>` and `<`. */
  readonly step: (delta: number) => Promise<void>;
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
  rowsVisible: () => number = railRowsVisible,
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

  // `step` is declared below, so the binding reaches it through a ref rather than being hoisted -
  // the rail needs the key bound before the stepper exists.
  const stepRef = useRef<(delta: number) => void>(() => {});
  const rail = useRail(() => rowsVisible(), commit, (delta) => stepRef.current(delta));
  railRef.current = rail;

  /**
   * React to a turn event that asks for a piece to be shown.
   *
   * Only `preset` and only when nothing is unapplied. Yanking the rail to a different preset out
   * from under somebody mid-rearrange would lose their work with no event to point at, and the model
   * has no way to know they were busy.
   */
  const onTurnEvent = useCallback((event: { type: string; show?: { kind: string; id: string } }) => {
    const show = event.type === "tool" ? event.show : undefined;
    if (show?.kind !== "preset") return;
    // Read through the ref, NOT the captured rail. The shell builds one event handler per turn and
    // hands it to runTurn, so a captured value is frozen at turn start: edits made while the model
    // worked were invisible to this guard, and a show request wiped them with no transcript line.
    const current = railRef.current;
    if (!current || current.pending > 0) return;
    void openRail(session.presets, show.id, current.follow);
  }, [session]);

  /**
   * Step to the next or previous preset in the studio's own order.
   *
   * FLICKING, not searching. Comparing two presets means opening one, typing a name, opening the
   * other and typing again - and the name is a studio id nobody remembers. `<` and `>` make the
   * shelf something you thumb through, which is how a person actually looks for the one they mean.
   *
   * REFUSES WHILE EDITS ARE PENDING, for the same reason a model's show request does: stepping away
   * from unapplied rearranging would lose it silently, and a key that sometimes destroys work is
   * worse than one that sometimes says no.
   */
  const step = useCallback(async (delta: number): Promise<void> => {
    const current = railRef.current;
    const presets = session.presets;
    if (!presets || !current) return;
    if (current.pending > 0) {
      say(`The rail has ${current.pending} unsaved change${current.pending === 1 ? "" : "s"}. Press enter to save or esc to drop them first.`);
      return;
    }
    const all = await presets.list();
    if (all.length === 0) return;
    const at = all.findIndex((piece) => piece.id === current.presetId);
    // Wraps, because a shelf you thumb through has no dead end - and an unopened rail starts at the
    // first preset rather than refusing to start.
    const next = all[at < 0 ? 0 : (at + delta + all.length) % all.length]!;
    if (next.id === current.presetId && all.length === 1) return;
    await openRail(presets, next.id, current.follow);
  }, [session, say]);

  stepRef.current = (delta) => { void step(delta); };

  return {
    ...rail,
    onTurnEvent,
    step,
    commands: {
      open: (query) => openRail(session.presets, query, rail.follow),
      close: rail.close,
    },
  };
}
