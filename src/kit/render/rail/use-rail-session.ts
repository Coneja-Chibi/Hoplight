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
import { nextPreset } from "./next-preset";
import { useRail, type RailSession } from "./use-rail";
import { useBlockEditor } from "../editor/use-block-editor";
import { railRowsVisible } from "./rail-pane";

export interface RailWithCommands extends RailSession {
  /** The full block editor card, when one is open. Distinct from the rail one-line editor. */
  readonly blockEditor: ReturnType<typeof useBlockEditor>;
  /** Handed every turn event so the model can put a preset up without the shell parsing prose. */
  readonly onTurnEvent: (event: { type: string; show?: { kind: string; id: string }; kind?: string; id?: string }) => void;
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
  /**
   * Copy, for the editor card. Handed down rather than reached for: Kit already owns one copy path
   * with real failure handling, and a second would be the one that silently does nothing on the
   * terminals the first one knows about.
   */
  copyToClipboard: (text: string) => void = () => {},
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

  const commit = useCallback(async (
    rows: readonly OutlineRow[],
    meta?: { name?: string; note?: string },
  ): Promise<string | null> => {
    const id = railRef.current?.presetId;
    const presets = session.presets;
    if (!id || !presets) {
      say("The rail is not following a preset.");
      return null;
    }
    const outcome = await commitRail(id, rows, {
      stage: presets.stage,
      commit: presets.commit,
      discard: presets.discard,
      // The same pause a model draft gets, reached without a turn.
      confirm: (request) => gate.seam().requestConfirm!(request),
      say,
    }, meta);
    /**
     * THE ID IT WROTE, WHICH IS NOT ALWAYS THE ID IT WAS ASKED ABOUT.
     *
     * Editing a foreign piece saves a Hoplight COPY under a free id, on purpose - the original is
     * a raw export and writing over it is the one thing that path exists to prevent. But the rail
     * went on following the original, so a rename applied cleanly and the header snapped back to
     * the untouched source. It reads as the rename being lost, and the next apply would have made
     * another copy.
     */
    return outcome.applied ? outcome.receipt.target?.id ?? id : null;
  }, [session, gate, say]);

  // `step` is declared below, so the binding reaches it through a ref rather than being hoisted -
  // the rail needs the key bound before the stepper exists.
  const stepRef = useRef<(delta: number) => void>(() => {});
  /**
   * Editing a block body opens the CARD, and its save comes back here as an ordinary staged row.
   *
   * The editor never writes: the text lands on the row as editedContent, which is the path the rail
   * already has and which already meets the Gate. A write from inside the card would be a second
   * route into the studio.
   */
  const blockEditor = useBlockEditor(
    (blockId, text) => { railRef.current?.setBlockText(blockId, text); },
    copyToClipboard,
  );
  const rail = useRail(
    () => rowsVisible(),
    commit,
    (delta) => stepRef.current(delta),
    say,
    (blockId, title, text) => { blockEditor.open({ blockId, title }, text); },
    blockEditor.target !== null,
  );
  railRef.current = rail;

  /**
   * React to a turn event that asks for a piece to be shown.
   *
   * Only `preset` and only when nothing is unapplied. Yanking the rail to a different preset out
   * from under somebody mid-rearrange would lose their work with no event to point at, and the model
   * has no way to know they were busy.
   */
  const onTurnEvent = useCallback((event: {
    type: string;
    show?: { kind: string; id: string };
    kind?: string;
    id?: string;
  }) => {
    /**
     * A WRITE TO THE PRESET ON SCREEN MAKES THE RAIL STALE, so it re-reads.
     *
     * Not through the studio watcher: that diffs entity SUMMARIES, and a summary carries a name and
     * an accent, nothing about the body. Adding, moving or rewriting blocks changes no field it
     * looks at, so the poller reports nothing and the rail sat there showing the old order while the
     * model said "applied". The apply path knows what it touched; this listens to that.
     */
    if (event.type === "wrote" && event.kind === "preset" && event.id) {
      const open = railRef.current;
      // Never over unapplied work: a stale view is an annoyance, losing a rearrange is not.
      if (open?.open && open.presetId === event.id && open.pending === 0) {
        void openRail(session.presets, event.id, open.follow);
      }
      return;
    }
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
      // Says esc TWICE because that is what escape actually does. The old wording promised a drop
      // escape did not perform, which left the rail looking stuck with no way out named anywhere.
      say(`The rail has ${current.pending} unsaved change${current.pending === 1 ? "" : "s"}. Press enter to save, or esc twice to drop them.`);
      return;
    }
    const all = await presets.list();
    if (all.length === 0) {
      say("There are no presets in the studio yet.");
      return;
    }
    // Which one is next is a decision with awkward cases, so it is pure and tested: see
    // next-preset.ts. A null here means there is genuinely nowhere to go.
    const nextId = nextPreset(all, current.presetId, delta);
    if (nextId === null) {
      // SAID OUT LOUD. Silence here is indistinguishable from a key that never arrived, which is
      // exactly how this was reported twice.
      say("That is the only preset in the studio.");
      return;
    }
    // The outcome was DISCARDED here, so a refusal to open looked exactly like a key that never
    // arrived: nothing moved and nothing was said.
    const outcome = await openRail(presets, nextId, current.follow);
    if (!outcome.ok) say(outcome.detail);
  }, [session, say]);

  stepRef.current = (delta) => { void step(delta); };

  return {
    ...rail,
    blockEditor,
    onTurnEvent,
    step,
    commands: {
      /**
       * OPENING DOES NOT TAKE THE KEYBOARD, and the version that did was worse than the one that
       * did not.
       *
       * The rail's letters mean things: r renames, e rewrites, n leaves a note, space toggles. So a
       * rail holding the keyboard turns an ordinary attempt to type a message into a rename dialog,
       * and it reads as the terminal refusing to accept typing at all. That is a worse failure than
       * a dead arrow key, because there is no obvious way out of it.
       *
       * The arrows still work straight after /rail: the COMPOSER forwards a bare left or right to
       * the rail whenever its draft is empty, the same guard the number keys already use. Typing
       * always lands where you are looking, and the two keys with nothing else to do reach across.
       */
      open: (query) => openRail(session.presets, query, rail.follow),
      close: rail.close,
    },
  };
}
