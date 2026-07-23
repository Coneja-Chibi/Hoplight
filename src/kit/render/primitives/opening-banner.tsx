/** @jsxImportSource @opentui/react */
/**
 * OpeningBanner: the statement-piece greeting, printed once at the top and scrolling away as you
 * chat. The real Hoplight illuminated-V mark (two crossed searchlight beams with white slits, ears
 * splayed up, tails crossed below) rasterized straight from hoplight-v.svg's polygons, stacked over
 * the big "Kit" wordmark (also polygon-rasterized so it scales cleanly). A rainbow FLOWS across it
 * all on a timer, Gemini's horizontal-gradient idea hand-rendered per column and animated because
 * OpenTUI's ascii-font can do neither. Emojis + a warm note live only in this welcome (banned
 * everywhere else in Hoplight); the working chrome stays rose and emoji-free.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "../theme";

// The mark, rasterized 2.5x from the svg polygons (interior gaps are the slits + tail crossing).
const LOGO = [
  "                     ████                                         ████",
  "            ██████████████                                       █████████████",
  "    ███████████████████████                                     ██████████████████████",
  " ███████████████████████████                                   ██████████████████████████",
  "  ██████████████████████████                                  ██████████████████████████",
  "   ██████████████████████████                                 █████████████████████████",
  "     █████████████████████████                               ████████████████████████",
  "      ██████████████  █████████                             ████████   █████████████",
  "       ██████████      ████████                            ████████      ██████████",
  "         █████████      ████████                           ███████      █████████",
  "          █████████      ████████                         ████████     █████████",
  "           █████████      ████████                       ████████     █████████",
  "             ████████     █████████                     ████████     ████████",
  "              ████████     ████████                    ████████     ████████",
  "               █████████    ████████                   ███████     ████████",
  "                 ████████    ████████                 ███████     ███████",
  "                  ████████    ████████               ████████    ███████",
  "                   ████████    ███████              ████████   ████████",
  "                    ████████   ████████            ████████   ███████",
  "                      ███████   ████████           ███████   ███████",
  "                       ███████   ████████         ███████   ███████",
  "                        ███████   ███████        ███████   ██████",
  "                          ██████   ███████      ███████   ██████",
  "                           ██████   ███████    ████████  ██████",
  "                            ██████  ████████   ███████  █████",
  "                              ██████ ████████ ███████ ██████",
  "                               ██████ ██████████████ ██████",
  "                                █████████████████████████",
  "                                  ██████████████████████",
  "                                   ████████████████████",
  "                                    █████████████████",
  "                                      ██████████████",
  "                                       ████████████",
  "                                        ███████████",
  "                                       ████████████",
  "                                      ██████████████",
  "                                     ██████   ███████",
  "                                    █████       ██████",
  "                                    ████          █████",
  "                                   ███              ███",
  "                                  ██                  ██",
  "                                 █                      █",
];
// The wordmark, polygon-rasterized 2.5x to match.
const KIT = [
  "███████          ███████       ██████████████████     ██████████████████████",
  "███████        ███████         ██████████████████     ██████████████████████",
  "███████      ███████           ██████████████████     ██████████████████████",
  "███████    ███████                  ███████                   ███████",
  "███████  ███████                    ███████                   ███████",
  "██████████████                      ███████                   ███████",
  "████████████                        ███████                   ███████",
  "██████████                          ███████                   ███████",
  "████████████                        ███████                   ███████",
  "██████████████                      ███████                   ███████",
  "███████  ███████                    ███████                   ███████",
  "███████    ███████                  ███████                   ███████",
  "███████      ███████           ██████████████████             ███████",
  "███████        ███████         ██████████████████             ███████",
  "███████          ███████       ██████████████████             ███████",
];

const LOGO_W = Math.max(...LOGO.map((l) => l.length));
const KIT_W = Math.max(...KIT.map((l) => l.length));
const KIT_PAD = Math.max(0, Math.floor((LOGO_W - KIT_W) / 2)); // center the wordmark under the mark
const ART = [...LOGO, "", ...KIT.map((l) => " ".repeat(KIT_PAD) + l)];
const WIDTH = LOGO_W;

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

const STEP_MS = 110;
const FLOW = 0.014; // gradient offset per tick

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
      <Row fg={theme.bright}>👋  Hey, welcome in. I&apos;m really glad you&apos;re here.</Row>
      <Row fg={theme.soft}>    This is Kit: your whole {studioName}, living right here in the terminal.</Row>

      <box height={1} />
      <Row fg={theme.text}>
        🎭  Everything you&apos;ve made lives here, all {String(totalPieces)} pieces. No menus, no forms to fill.
      </Row>
      <Row fg={theme.text}>    You just talk to it, like a friend who already knows where all of it is.</Row>

      <box height={1} />
      <Row fg={theme.bright}>✨  Try saying:</Row>
      <Row fg={theme.teal}>      &quot;make me a grumpy tavern keeper who hates adventurers&quot;</Row>
      <Row fg={theme.teal}>      &quot;add a hidden secret to Mira&apos;s lorebook&quot;</Row>
      <Row fg={theme.teal}>      &quot;bring in this character card from another app&quot;</Row>

      <box height={1} />
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          🔒  Two promises: nothing <span fg={theme.text}>leaves your machine</span> until you send it, and the
        </text>
      </box>
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          {"    "}scripts inside your pieces stay <span fg={theme.text}>sealed as text</span>. Kit never runs them.
        </text>
      </box>

      <box height={1} />
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          🐇  Ready? <span fg={theme.text}>/model</span> connects a provider,{" "}
          <span fg={theme.text}>/test</span> checks it&apos;s awake, then just talk.
        </text>
      </box>

      <box height={1} />
      <Row fg={theme.bright}>Go make something you love.</Row>
      <Row fg={theme.mut}>- Chi</Row>
    </box>
  );
}
