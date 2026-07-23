/** @jsxImportSource @opentui/react */
/**
 * StatusRow, the stagehand (DECISIONS #24): while Kit is out working, a hushed in-transcript line.
 * A rose dot breathes (~1.6s dim-to-bright), lowercase stage verbs rotate slowly, dots step at
 * ~800ms, and the elapsed clock rides the tail as a small deep-rose stamp with white digits. No
 * provider name, ever. Covers both waiting and thinking until the thinking look is designed.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "../theme";

const VERBS = ["cueing", "rifling", "staging", "rehearsing", "consulting"] as const;
// The breath, translated to cells: the dot's ink steps dim-to-bright-to-dim (~1.6s full cycle).
const BREATH = [theme.mut, theme.roseDeep, theme.rose, theme.roseDeep] as const;

const clock = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function StatusRow({ startedAt }: { startedAt: number }): ReactNode {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => prev + 1), 200);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Date.now() - startedAt;
  const dotInk = BREATH[Math.floor(elapsed / 400) % BREATH.length]!;
  const verb = VERBS[Math.floor(elapsed / 5200) % VERBS.length]!;
  const dots = ".".repeat(Math.floor(elapsed / 800) % 3 + 1);
  return (
    <box flexDirection="row">
      <text fg={theme.mut}>
        <span fg={dotInk}>·</span> {verb}
        {dots}{" "}
      </text>
      <box backgroundColor={theme.roseDeep} paddingLeft={1} paddingRight={1}>
        <text fg={theme.white}>{clock(elapsed)}</text>
      </box>
    </box>
  );
}
