/** @jsxImportSource @opentui/react */
/**
 * OpeningBanner: the statement-piece greeting, printed once at the top and scrolling away as you
 * chat. The real Hoplight illuminated-V mark (two crossed searchlight beams with white slits, ears
 * splayed up, tails crossed below) rasterized straight from hoplight-v.svg's polygons, BESIDE the
 * big "Kit" wordmark (also polygon-rasterized so it scales cleanly), the wordmark centered against
 * the mark's height. A rainbow FLOWS across it all on a timer, Gemini's horizontal-gradient idea
 * hand-rendered per column and animated because OpenTUI's ascii-font can do neither. Emojis + a warm
 * note live only in this welcome (banned everywhere else in Hoplight); the chrome stays rose.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "../theme";
import { darken, rampAt } from "../colors";

// The mark, rasterized from the svg polygons (interior gaps are the slits + tail crossing).
const LOGO = [
  "        █████                    █████",
  "██████████████                   █████████████",
  " ██████████████                 █████████████",
  "   ████████████                ████████████",
  "    █████   ████              ████   █████",
  "     █████   ████            ████   █████",
  "       ████   ████          ████   ████",
  "        ████   ████         ████  ████",
  "         ████  ████        ████  ███",
  "           ████ ████      ████  ███",
  "            ████ ████    ████ ████",
  "             ████ ████  ████ ███",
  "               ███ ████ ███ ███",
  "                ██████████████",
  "                  ██████████",
  "                   ████████",
  "                    ██████",
  "                    ██████",
  "                   ███  ███",
  "                  ██      ██",
  "                 █          █",
];
// The wordmark, polygon-rasterized, solid, with a hard rose-deep offset shadow ("S" cells) down-right
// (the neobrutalist stamp: "it stamps, it does not float", per docs__AESTHETIC + the locked masthead).
const KIT = [
  "████       ████    ████████████   ██████████████",
  "████SS   █████SSS  ████████████SS ██████████████SS",
  "████SS  ████SSSS   ████████████SS ██████████████SS",
  "████SS█████SSS       SS████SSSSSS   SSS████SSSSSSS",
  "████S████SSSS          ████SS          ████SS",
  "████████SSS            ████SS          ████SS",
  "██████SSSS             ████SS          ████SS",
  "████████               ████SS          ████SS",
  "████S████S             ████SS          ████SS",
  "████SS█████            ████SS          ████SS",
  "████SS  ████S      ████████████        ████SS",
  "████SS   █████     ████████████SS      ████SS",
  "████SS     ████S   ████████████SS      ████SS",
  "  SSSS       SSSS    SSSSSSSSSSSS        SSSS",
];

const LOGO_W = Math.max(...LOGO.map((l) => l.length));
const KIT_OFFSET = Math.floor((LOGO.length - KIT.length) / 2); // center the wordmark against the mark
const GAP = "    ";
const pad = (line: string, w: number): string => line + " ".repeat(Math.max(0, w - line.length));
const ART = LOGO.map((line, r) => `${pad(line, LOGO_W)}${GAP}${KIT[r - KIT_OFFSET] ?? ""}`);
const WIDTH = Math.max(...ART.map((l) => l.length));

// A full rainbow, made cyclic (first color repeated) so the flow wraps seamlessly.
const RAMP = [
  "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16",
  "#eab308", "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#3b82f6",
];
const STEP_MS = 110;
const FLOW = 0.014; // gradient offset per tick
const SHADOW_DX = 2; // stamp shadow x-offset (matches the generated "S" cells)
const SHADOW_DARKEN = 0.42; // how much darker the stamp is than the letter it shadows

/** One line of the welcome; height 1 so stacked rows do not pile onto one another. */
const Row = ({ fg, children }: { fg: string; children: ReactNode }): ReactNode => (
  <box flexDirection="row" height={1}>
    <text fg={fg}>{children}</text>
  </box>
);

export function OpeningBanner({
  studioName,
  totalPieces,
  animate = true,
}: {
  studioName: string;
  totalPieces: number;
  /** Flow the rainbow only while the banner is the whole screen; freeze once a turn scrolls it away. */
  animate?: boolean;
}): ReactNode {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setTick((x) => x + 1), STEP_MS);
    return () => clearInterval(id);
  }, [animate]);
  const offset = tick * FLOW;
  const cols = Array.from({ length: WIDTH }, (_, c) => rampAt(RAMP, c / WIDTH - offset));
  const shadowCols = cols.map((c) => darken(c, SHADOW_DARKEN)); // darker variant of each column, flows too

  return (
    <box flexDirection="column" paddingTop={1}>
      {ART.map((line, row) => (
        <box key={row} flexDirection="row" height={1}>
          <text>
            {[...line].map((ch, col) =>
              ch === " " ? (
                <span key={col}> </span>
              ) : ch === "S" ? (
                <span key={col} fg={shadowCols[Math.max(0, col - SHADOW_DX)]}>
                  █
                </span>
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
      <Row fg={theme.soft}>    This is Kit: your whole {studioName}, living right here in the terminal.</Row>

      <box height={1} />
      <Row fg={theme.text}>
        Everything you&apos;ve made lives here, all {String(totalPieces)} pieces. No menus, no forms to fill.
      </Row>
      <Row fg={theme.text}>    You just talk to it, like a friend who already knows where all of it is.</Row>

      <box height={1} />
      <Row fg={theme.bright}>Try saying:</Row>
      <Row fg={theme.teal}>      &quot;make me a grumpy tavern keeper who hates adventurers&quot;</Row>
      <Row fg={theme.teal}>      &quot;add a hidden secret to Mira&apos;s lorebook&quot;</Row>
      <Row fg={theme.teal}>      &quot;bring in this character card from another app&quot;</Row>

      <box height={1} />
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          Two promises: nothing <span fg={theme.text}>leaves your machine</span> until you send it, and the
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
          Ready? <span fg={theme.text}>/model</span> connects a provider,{" "}
          <span fg={theme.text}>/test</span> checks it&apos;s awake, then just talk.
        </text>
      </box>

      <box height={1} />
      <Row fg={theme.bright}>Go make something you love.</Row>
      <Row fg={theme.mut}>- Chi</Row>
    </box>
  );
}
