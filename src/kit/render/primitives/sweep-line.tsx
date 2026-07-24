/** @jsxImportSource @opentui/react */
/**
 * SweepLine: the searchlight. A rose glow beam glides across a heavy line, a bright core fading
 * through a long shade ramp to nothing. Rendered flush on the input box's top edge so the two read
 * as one unit. Smooth (16-step gradient, wide falloff) and calm (slow drift). Per-cell colors make
 * the gradient; the beam sweeps via a timer. Shown only while a turn runs.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";

// Rose glow ramp, dim tail to bright core (16 steps for a smooth, un-pixelated gradient).
const RAMP = [
  "#140409", "#20060d", "#2d0813", "#3a0a19", "#480c20", "#570e27", "#66102e", "#751236",
  "#84143d", "#951646", "#a8184d", "#bb1a4a", "#cf1c4b", "#e43a5d", "#f2586f", "#fb7185",
];
const STEP_MS = 60; // smooth animation
const PERIOD = 190; // ticks for one full pass (slow, calm drift)
const BEAM = 17; // half-width of the beam falloff, in cells (wide, so the gradient spreads)

export function SweepLine(): ReactNode {
  const { width } = useTerminalDimensions();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => (x + 1) % PERIOD), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const cells = Math.max(1, width - 2); // aligns with the input box's outer width
  const travel = cells + BEAM * 2;
  const pos = (tick / PERIOD) * travel - BEAM; // lead in from the left, glide out the right
  const parts: ReactNode[] = [];
  for (let i = 0; i < cells; i += 1) {
    const intensity = 1 - Math.abs(i - pos) / BEAM;
    if (intensity <= 0.02) {
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
    <box flexDirection="row" height={1}>
      <text>{parts}</text>
    </box>
  );
}
