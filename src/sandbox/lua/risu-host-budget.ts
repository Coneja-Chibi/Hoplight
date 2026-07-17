/**
 * Host-state budget helpers for Risu Lua API mutations.
 * Snapshot-and-rollback so a failed budget check leaves RisuState byte-for-byte unchanged.
 */
import {
  assertStateWithinBudget,
  type RisuStateBudget,
} from "./limits";
import type { RisuState } from "./risu-state";

export const asString = (v: unknown): string => (v == null ? "" : String(v));

export const asIndex = (v: unknown, len: number): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  // Risu chat indices are often 0-based in docs; also tolerate 1-based.
  const i = Math.trunc(n);
  if (i >= 0 && i < len) return i;
  if (i >= 1 && i <= len) return i - 1;
  return null;
};

/**
 * Apply a pure candidate transform only when the candidate passes the budget.
 * On failure, state is not mutated.
 */
export const commitIfBudgeted = (
  state: RisuState,
  budget: RisuStateBudget,
  apply: () => void,
): void => {
  const snap: RisuState = {
    chatVars: { ...state.chatVars },
    log: [...state.log],
    chat: state.chat.map((m) => ({ role: m.role, data: m.data })),
    meta: { ...state.meta },
  };
  apply();
  try {
    assertStateWithinBudget(state, budget);
  } catch (err) {
    state.chatVars = snap.chatVars;
    state.log = snap.log;
    state.chat = snap.chat;
    state.meta = snap.meta;
    throw err;
  }
};
