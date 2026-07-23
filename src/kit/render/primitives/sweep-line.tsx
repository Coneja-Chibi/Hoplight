/** @jsxImportSource @opentui/react */
/**
 * SweepLine: the searchlight. A rose glow beam glides across a heavy line, a bright core fading
 * through a shade ramp to nothing, on otherwise-empty darkness. The terminal-honest version of the
 * mockup's glowing pulse, rebuilt SMOOTH after the first cut rendered as a chunky segmented block
 * bar. Per-cell colors make the gradient; the beam sweeps via a timer. Shown only while a turn runs.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../theme";

// Rose glow ramp: dim tail to bright core.
const RAMP = ["#5c0f26", "#8f1533", "#c01a41", theme.rose, "#f43f5e", "#fb7185"];
const STEP_MS = 80;
const PERIOD = 64; // timer ticks for one full pass
const BEAM = 10; // half-width of the beam falloff, in cells

export function SweepLine(): ReactNode {
  const { width } = useTerminalDimensions();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => (x + 1) % PERIOD), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const cells = Math.max(1, width - 2); // one cell of padding each side
  const travel = cells + BEAM * 2;
  const pos = (tick / PERIOD) * travel - BEAM; // lead in from the left, glide out the right
  const parts: ReactNode[] = [];
  for (let i = 0; i < cells; i += 1) {
    const intensity = 1 - Math.abs(i - pos) / BEAM;
    if (intensity <= 0.04) {
      parts.push(<span key={i}>{" "}</span>);
    } else {
      const shade = RAMP[Math.min(RAMP.length - 1, Math.floor(intensity * RAMP.length))]!;
      parts.push(
        <span key={i} fg={shade}>
          {"━"}
        </span>,
      );
    }
  }

  return (
    <box flexDirection="row" height={1} paddingLeft={1} paddingRight={1}>
      <text>{parts}</text>
    </box>
  );
}
