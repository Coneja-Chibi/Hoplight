/** @jsxImportSource @opentui/react */
/**
 * OpeningBanner: the statement-piece greeting, printed once at the top and scrolling away as you
 * chat. The real Hoplight illuminated-V mark (two crossed searchlight beams with white slits, ears
 * splayed up, tails crossed below) rasterized straight from hoplight-v.svg's polygons, beside the
 * big "Kit" wordmark. A rainbow FLOWS across the whole thing on a timer (a shimmering marquee, not a
 * static gradient) via Gemini's horizontal-gradient idea, hand-rendered per column and animated
 * because OpenTUI's ascii-font can do neither. The one deliberate spectrum splash; chrome stays rose.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "../theme";

// The mark, rasterized from the svg polygons (interior gaps are the illuminated slits + tail crossing).
const LOGO = [
  "      ████                ████",
  "███████████              ███████████",
  "  ██████████            ██████████",
  "   ████  ████           ███  ████",
  "    ████  ███          ███  ████",
  "      ███  ███        ███  ███",
  "       ███  ███      ███  ███",
  "        ███  ███     ███ ███",
  "          ██ ███    ███ ██",
  "           ██ ███  ███ ██",
  "            ████████████",
  "             █████████",
  "               ██████",
  "                ████",
  "               ██████",
  "              ██    ██",
  "             █        █",
];
// The wordmark.
const KIT = [
  "██╗  ██╗ ██╗ ████████╗",
  "██║ ██╔╝ ██║ ╚══██╔══╝",
  "█████╔╝  ██║    ██║   ",
  "██╔═██╗  ██║    ██║   ",
  "██║  ██╗ ██║    ██║   ",
  "╚═╝  ╚═╝ ╚═╝    ╚═╝   ",
];

const ROWS = LOGO.length;
const KIT_OFFSET = Math.round((ROWS - KIT.length) / 2); // center the wordmark against the mark
const LOGO_W = Math.max(...LOGO.map((l) => l.length));
const pad = (line: string, w: number): string => line + " ".repeat(Math.max(0, w - line.length));
const ART = Array.from({ length: ROWS }, (_, r) => {
  const k = KIT[r - KIT_OFFSET] ?? "";
  return `${pad(LOGO[r] ?? "", LOGO_W)}    ${k}`;
});
const WIDTH = Math.max(...ART.map((line) => line.length));

// A full rainbow, made cyclic (first color repeated) so the flow wraps seamlessly.
const RAMP = [
  "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16",
  "#eab308", "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#3b82f6",
];
const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, "0");
const rampColor = (t: number): string => {
  const scaled = ((((t % 1) + 1) % 1)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = hexToRgb(RAMP[i]!);
  const b = hexToRgb(RAMP[i + 1]!);
  return `#${toHex(a[0] + (b[0] - a[0]) * f)}${toHex(a[1] + (b[1] - a[1]) * f)}${toHex(a[2] + (b[2] - a[2]) * f)}`;
};

const STEP_MS = 90;
const FLOW = 0.016; // gradient offset per tick

/** One line of the welcome; height 1 so stacked rows do not pile onto one another. */
const Row = ({ fg, children }: { fg: string; children: ReactNode }): ReactNode => (
  <box flexDirection="row" height={1}>
    <text fg={fg}>{children}</text>
  </box>
);

export function OpeningBanner({
  studioName,
  totalPieces,
}: {
  studioName: string;
  totalPieces: number;
}): ReactNode {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), STEP_MS);
    return () => clearInterval(id);
  }, []);
  const offset = tick * FLOW;
  const cols = Array.from({ length: WIDTH }, (_, c) => rampColor(c / WIDTH - offset));

  return (
    <box flexDirection="column" paddingTop={1}>
      {ART.map((line, row) => (
        <box key={row} flexDirection="row" height={1}>
          <text>
            {[...line].map((ch, col) =>
              ch === " " ? (
                <span key={col}> </span>
              ) : (
                <span key={col} fg={cols[col]}>
                  {ch}
                </span>
              ),
            )}
          </text>
        </box>
      ))}

      <box height={1} />
      <Row fg={theme.bright}>Hey, welcome in. I&apos;m really glad you&apos;re here.</Row>
      <Row fg={theme.soft}>This is Kit: your {studioName}, living right here in the terminal.</Row>

      <box height={1} />
      <Row fg={theme.text}>
        Everything you&apos;ve made lives here, all {String(totalPieces)} pieces: your characters, personas,
      </Row>
      <Row fg={theme.text}>
        lorebooks, presets, the lot. No menus to dig through, no forms to fill in. You
      </Row>
      <Row fg={theme.text}>just talk to it, like a friend who already knows where all of it is.</Row>

      <box height={1} />
      <Row fg={theme.text}>Want a new character? Ask for one. Need to fix a persona, pull a fact from a</Row>
      <Row fg={theme.text}>lorebook, or bring a card in from another app? Say so in plain words, and Kit</Row>
      <Row fg={theme.text}>does the fiddly parts for you, then shows you exactly what it changed.</Row>

      <box height={1} />
      <Row fg={theme.bright}>Two promises, because they matter:</Row>
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          Nothing you write <span fg={theme.text}>leaves your machine</span> until you choose to send it.
        </text>
      </box>
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          Any scripts inside your pieces stay <span fg={theme.text}>sealed as plain text</span>. Kit never runs them.
        </text>
      </box>

      <box height={1} />
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          When you&apos;re ready: <span fg={theme.text}>/model</span> to connect a provider,{" "}
          <span fg={theme.text}>/test</span> to check it&apos;s awake, then just
        </text>
      </box>
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          start talking. <span fg={theme.text}>/quit</span> whenever you want to step out.
        </text>
      </box>

      <box height={1} />
      <Row fg={theme.bright}>Go make something you love.</Row>
      <Row fg={theme.mut}>- Chi</Row>
    </box>
  );
}
