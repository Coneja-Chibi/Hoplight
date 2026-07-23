/** @jsxImportSource @opentui/react */
/**
 * OpeningBanner: the CLI greeting printed once at the top of the session (it scrolls away as you
 * chat, like every CLI's splash, NOT a fixed masthead). A big "Kit" ascii wordmark under a smooth
 * HORIZONTAL rainbow gradient, the Gemini technique: their banner is a hand ascii string wrapped in
 * ink-gradient, which flows colors left-to-right and interpolates between stops. OpenTUI's ascii-font
 * color array does not flow horizontally (it came out flat), so the gradient is hand-rendered per
 * column here. The one deliberate spectrum splash; the working chrome stays rose.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

// The wordmark, hand ascii (ANSI-shadow style), padded to equal width.
const ART = [
  "██╗  ██╗ ██╗ ████████╗",
  "██║ ██╔╝ ██║ ╚══██╔══╝",
  "█████╔╝  ██║    ██║   ",
  "██╔═██╗  ██║    ██║   ",
  "██║  ██╗ ██║    ██║   ",
  "╚═╝  ╚═╝ ╚═╝    ╚═╝   ",
];

// Rainbow stops, interpolated across the width for a smooth flow.
const RAMP = ["#3b82f6", "#14b8a6", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#ec4899", "#a855f7"];

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, "0");
const rampColor = (t: number): string => {
  const scaled = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = hexToRgb(RAMP[i]!);
  const b = hexToRgb(RAMP[i + 1]!);
  return `#${toHex(a[0] + (b[0] - a[0]) * f)}${toHex(a[1] + (b[1] - a[1]) * f)}${toHex(a[2] + (b[2] - a[2]) * f)}`;
};

const WIDTH = Math.max(...ART.map((line) => line.length));
const COLS = Array.from({ length: WIDTH }, (_, c) => rampColor(WIDTH > 1 ? c / (WIDTH - 1) : 0));

export function OpeningBanner({
  studioName,
  totalPieces,
}: {
  studioName: string;
  totalPieces: number;
}): ReactNode {
  return (
    <box flexDirection="column">
      {ART.map((line, row) => (
        <box key={row} flexDirection="row" height={1}>
          <text>
            {[...line].map((ch, col) =>
              ch === " " ? (
                <span key={col}> </span>
              ) : (
                <span key={col} fg={COLS[col]}>
                  {ch}
                </span>
              ),
            )}
          </text>
        </box>
      ))}
      <box height={1} />
      <box flexDirection="row" height={1}>
        <text fg={theme.bright}>{studioName}, in the terminal.</text>
      </box>
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          Talk to your {String(totalPieces)} pieces in plain language. Nothing leaves your machine until you send.
        </text>
      </box>
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>Scripts stay sealed as text and never run.</text>
      </box>
      <box height={1} />
      <box flexDirection="row" height={1}>
        <text fg={theme.mut}>
          <span fg={theme.text}>/model</span> connect a provider {"   "}
          <span fg={theme.text}>/test</span> check it is alive {"   "}
          <span fg={theme.text}>/quit</span> leave
        </text>
      </box>
    </box>
  );
}
