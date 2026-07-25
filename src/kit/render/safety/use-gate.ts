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
    choose(choice) {
      if (!pending) return;
      setPending(null);
      pending.resolve(choice);
    },
  };
}
