/** @jsxImportSource @opentui/react */
/**
 * StatusRow: the live "something is happening" line while a turn runs. A ticking rose pulse, who is
 * answering, and the phase: waiting (nothing streamed yet) or thinking (reasoning is arriving, with
 * a growing count so progress is visible even while the thought itself stays private).
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "../theme";

const FRAMES = ["▖", "▘", "▝", "▗"] as const;

export type StatusPhase = { phase: "waiting" } | { phase: "thinking"; chars: number };

export function StatusRow({ label, status }: { label: string; status: StatusPhase }): ReactNode {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => prev + 1), 200);
    return () => clearInterval(timer);
  }, []);
  const frame = FRAMES[tick % FRAMES.length]!;
  return (
    <box flexDirection="row">
      <text fg={theme.rose}>{frame} </text>
      <text fg={theme.mut}>
        {status.phase === "thinking" ? (
          <span>
            <span fg={theme.soft}>{label}</span> thinking
            <span fg={theme.soft}> · {String(status.chars)} chars</span>
          </span>
        ) : (
          <span>
            waiting for <span fg={theme.soft}>{label}</span>
          </span>
        )}
        {".".repeat((tick % 3) + 1)}
      </text>
    </box>
  );
}
