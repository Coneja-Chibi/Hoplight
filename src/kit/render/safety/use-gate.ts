/**
 * React controller for one session's standing gate policy and one pending confirmation promise.
 */
import { useRef, useState } from "react";
import {
  applyGateChoice,
  initGate,
  type GateChoice,
} from "../../tools/safety/permission-mode";
import type {
  GateRequest,
  GateSeam,
} from "../../tools/safety/gated-dispatch";

export interface GateController {
  prompt: GateRequest | null;
  mode: ReturnType<typeof initGate>["mode"];
  seam(): GateSeam;
  choose(choice: GateChoice): void;
}

/** Hold gate grants across turns while keeping each pending choice session-local and explicit. */
export function useGateController(): GateController {
  const state = useRef(initGate());
  const [pending, setPending] = useState<{
    request: GateRequest;
    resolve: (choice: GateChoice) => void;
  } | null>(null);

  return {
    prompt: pending?.request ?? null,
    mode: state.current.mode,
    seam: () => ({
      state: state.current,
      requestConfirm: (request) =>
        new Promise<GateChoice>((resolve) => {
          setPending({ request, resolve });
        }),
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
      setPending(null);
      state.current = applyGateChoice(state.current, choice, name);
      pending.resolve(choice);
    },
  };
}
