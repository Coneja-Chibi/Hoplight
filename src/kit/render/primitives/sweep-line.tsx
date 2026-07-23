/** @jsxImportSource @opentui/react */
/**
 * SweepLine, the searchlight (DECISIONS #24): while Kit is out working, one hard black rule under
 * the scene carries a deep-rose hotspot bouncing end to end, ~6.5s per pass, with a bright rose
 * heart. Mounted only while a turn runs; it goes dark the moment the reply takes the stage.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "../theme";

const PASS_MS = 6500;
const SEG = 26; // hotspot width, percent

const pct = (value: number): `${number}%` => `${Math.round(value * 10) / 10}%`;

export function SweepLine(): ReactNode {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => prev + 1), 120);
    return () => clearInterval(timer);
  }, []);
  const phase = (Date.now() % (PASS_MS * 2)) / PASS_MS;
  const along = phase <= 1 ? phase : 2 - phase; // bounce
  const left = along * (100 - SEG);
  return (
    <box height={1} flexDirection="row" backgroundColor={theme.edge}>
      <box width={pct(left)} />
      <box width={pct(SEG * 0.35)} backgroundColor={theme.roseDeep} />
      <box width={pct(SEG * 0.3)} backgroundColor={theme.rose} />
      <box width={pct(SEG * 0.35)} backgroundColor={theme.roseDeep} />
    </box>
  );
}
