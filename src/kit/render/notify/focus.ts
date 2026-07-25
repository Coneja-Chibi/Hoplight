/**
 * useFocus: the Focus Sentinel. Enables terminal focus reporting (CSI ?1004h) on mount, disables it
 * on unmount, and flips a boolean as focus-in (CSI I) / focus-out (CSI O) sequences arrive on stdin.
 * Defaults to focused=true and only leaves it on an observed focus-OUT: a terminal that never reports
 * focus (or a user who never looks away) stays "present", so the bell/desktop gate in plan.ts fails
 * toward quiet rather than spamming while the user is watching. Impure edge (stdin/stdout + a global
 * listener); the plan that consumes it stays pure. NOTE: the stdin interplay with OpenTUI's own input
 * pipeline is not yet live-verified (open question); the true-default keeps Notify safe if it no-ops.
 */
import { useEffect, useState } from "react";

const ESC = String.fromCharCode(27);
const ENABLE = `${ESC}[?1004h`;
const DISABLE = `${ESC}[?1004l`;
const FOCUS_IN = `${ESC}[I`;
const FOCUS_OUT = `${ESC}[O`;

/** Track terminal focus; true until an observed focus-out, then it mirrors focus-in / focus-out. */
export const useFocus = (): boolean => {
  const [focused, setFocused] = useState(true);
  useEffect(() => {
    if (!process.stdout.isTTY) return;
    process.stdout.write(ENABLE);
    const onData = (chunk: Buffer | string): void => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("latin1");
      // Focus-out wins if a chunk somehow carried both; a lone focus-in restores presence.
      if (text.includes(FOCUS_OUT)) setFocused(false);
      else if (text.includes(FOCUS_IN)) setFocused(true);
    };
    process.stdin.on("data", onData);
    return () => {
      process.stdin.off("data", onData);
      if (process.stdout.isTTY) process.stdout.write(DISABLE);
    };
  }, []);
  return focused;
};
