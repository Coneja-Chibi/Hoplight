/**
 * React controller for one session's standing gate policy and one pending confirmation promise.
 */
import { useEffect, useRef, useState } from "react";
import {
  applyGateChoice,
  initGate,
  type GateChoice,
} from "../../tools/safety/permission-mode";
import { decideGate } from "../../tools/safety/gate-core";
import { readGateMode, writeGateMode } from "../../tools/safety/gate-store";
import type {
  GateRequest,
  GateSeam,
} from "../../tools/safety/gated-dispatch";

export interface GateController {
  prompt: GateRequest | null;
  mode: ReturnType<typeof initGate>["mode"];
  seam(): GateSeam;
  choose(choice: GateChoice): void;
  /** Set the standing policy outright (/gates). The danger floor is unaffected in every mode. */
  setMode(mode: "guarded" | "autopilot" | "full"): void;
}

/** Hold gate grants across turns while keeping each pending choice session-local and explicit. */
export function useGateController(
  /** Correct one block inside a staged draft, for a rewrite edited at the gate. */
  amendBlock?: (draftId: string, blockId: string, content: string) => boolean,
): GateController {
  const state = useRef(initGate());
  const [, bump] = useState(0);

  /**
   * REMEMBER HOW OFTEN YOU WANT TO BE ASKED.
   *
   * /gates worked and the setting died with the session, so every launch came back to guarded and
   * asked about everything again. A preference you re-state every restart is not a preference.
   *
   * Read AFTER the first paint, deliberately. Kit starts guarded and relaxes a moment later if the
   * file says so; blocking startup on this would put a disk read in front of the screen to make Kit
   * ask LESS, and a read that fails leaves the safe setting in place either way.
   */
  useEffect(() => {
    void readGateMode().then((mode) => {
      if (mode === state.current.mode) return;
      state.current = applyGateChoice(state.current, { type: "set-mode", mode }, "remembered");
      bump((n) => n + 1);
    });
  }, []);
  const [pending, setPending] = useState<{
    request: GateRequest;
    resolve: (choice: GateChoice) => void;
  } | null>(null);

  return {
    prompt: pending?.request ?? null,
    /** Set the standing policy outright, from /gates. The floor is unaffected in every mode. */
    setMode(mode) {
      state.current = applyGateChoice(state.current, { type: "set-mode", mode }, "/gates");
      bump((n) => n + 1);
      // Written so the next launch starts here. A failure to save is reported by /gates, not hidden.
      void writeGateMode(mode);
    },
    mode: state.current.mode,
    seam: () => ({
      state: state.current,
      /**
       * ASK THE STANDING POLICY FIRST.
       *
       * This always showed a card. The mode was consulted for a model's tool call and ignored for a
       * person's own edit, so "never ask safe moves" quieted the model and left the rail asking a
       * second time about a change somebody had just pressed apply on, with the diff in front of
       * them. `decideGate` is the one policy; this now reads it like everything else does.
       *
       * The danger floor still confirms in every mode, which is what makes turning the rest off safe.
       */
      requestConfirm: (request) => {
        const decided = decideGate(request.name, request.verdict, state.current);
        if (decided === "allow") return Promise.resolve({ type: "allow-once" } as GateChoice);
        if (decided === "deny") return Promise.resolve({ type: "deny" } as GateChoice);
        return new Promise<GateChoice>((resolve) => {
          setPending({ request, resolve });
        });
      },
      onChoice: (choice, name) => {
        state.current = applyGateChoice(state.current, choice, name);
      },
    }),
    /**
     * Record the answer, then hand it back to whoever is waiting.
     *
     * THE POLICY UPDATE HAPPENS HERE, not only in the seam's `onChoice`. It used to happen only
     * there, which made "apply the choice" a second call every caller had to remember, and the rail's
     * confirm did not: it calls `requestConfirm` directly because a person editing blocks is not in a
     * turn. So pressing Lock down on a rail confirm blocked that write and left the session unlocked,
     * and Allow for the session granted nothing. The write was always honest; the standing decision
     * was dropped.
     *
     * Doing it here makes it impossible to forget. `gated-dispatch` still calls `onChoice`, which
     * applies the same choice again, and that is harmless: every arm of applyGateChoice is idempotent
     * (allow-once and deny return the state untouched, a repeated grant is a Set insert, and locking
     * an already-locked mode is the same mode).
     */
    choose(choice) {
      if (!pending) return;
      const name = pending.request.name;
      const draftId = pending.request.review?.draftId;
      setPending(null);
      state.current = applyGateChoice(state.current, choice, name);
      /**
       * A CORRECTION IS APPLIED TO THE DRAFT BEFORE THE ANSWER RESOLVES.
       *
       * Order is the whole safety property: by the time anything downstream sees "allow-once", the
       * draft already holds the corrected text, so what was authorised and what gets written are the
       * same object. Resolving first and amending after would leave a window where the original
       * wording could be applied, which is the one thing a review must never permit.
       */
      const edit = choice.type === "allow-once" ? choice.edit : undefined;
      if (edit && draftId && amendBlock) {
        // A refusal here denies rather than falling back to the model text: silently applying the
        // version somebody had just edited away would be worse than doing nothing.
        if (!amendBlock(draftId, edit.blockId, edit.content)) {
          pending.resolve({ type: "deny" });
          return;
        }
      }
      pending.resolve(choice);
    },
  };
}
