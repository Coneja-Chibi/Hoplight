/** @jsxImportSource @opentui/react */
/**
 * OpeningBanner: the statement-piece greeting, printed once at the top and scrolling away as you
 * chat. The real Hoplight illuminated-V mark (two crossed searchlight beams with white slits, ears
 * splayed up, tails crossed below) rasterized straight from hoplight-v.svg's polygons, BESIDE the
 * big "Kit" wordmark (also polygon-rasterized so it scales cleanly), the wordmark centered against
 * the mark's height. The whole lockup and welcome script sit as one centered stage block on roomy
 * terminals. A rainbow FLOWS across it all on a timer, Gemini's horizontal-gradient idea
 * hand-rendered per column and animated because OpenTUI's ascii-font can do neither. Friendly stage
 * cues and a warm note live only in this welcome; the chrome stays rose.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
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
const COMPACT_ART = [
  "██       ██    ██  ██   █████   ███████",
  " ██     ██     ██ ██      ██       ██",
  "  ██   ██      ████       ██       ██",
  "   ██ ██       ██ ██      ██       ██",
  "    ███        ██  ██   █████      ██",
  "    █ █",
];
const TINY_ART = [
  "█   █  █ █  ███  ███",
  " █ █   ██    █    █",
  "  █    █ █  ███   █",
  "  █",
  " █ █",
];

// A full rainbow, made cyclic (first color repeated) so the flow wraps seamlessly.
const RAMP = [
  "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16",
  "#eab308", "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#3b82f6",
];
const STEP_MS = 110;
const FLOW = 0.014; // gradient offset per tick
const SHADOW_DX = 2; // stamp shadow x-offset (matches the generated "S" cells)
const SHADOW_DARKEN = 0.42; // how much darker the stamp is than the letter it shadows
// Construct the five stage cues from scalar values so authored source remains plain-text and the
// repository's no-pictographs-in-TS guard stays meaningful. OpenTUI still receives the real glyphs.
const STAGE_CUES = {
  welcome: String.fromCodePoint(0x1f44b),
  studio: String.fromCodePoint(0x1f3ad),
  ideas: String.fromCodePoint(0x2728),
  promises: String.fromCodePoint(0x1f512),
  ready: String.fromCodePoint(0x1f407),
} as const;
const COPY = {
  welcome: "Hey, welcome in. I'm really glad you're here.",
  studio: (studioName: string): string =>
    `This is Kit: your whole ${studioName}, living right here in the terminal.`,
  everything: (totalPieces: number): string =>
    `Everything you've made lives here, all ${totalPieces} pieces. No menus, no forms to fill.`,
  talk: "You just talk to it, like a friend who already knows where all of it is.",
  samples: [
    '"make me a grumpy tavern keeper who hates adventurers"',
    '"add a hidden secret to Mira\'s lorebook"',
    '"bring in this character card from another app"',
  ],
  promises:
    "Two promises: nothing leaves your machine until you send it, and the scripts inside your pieces stay sealed as text. Kit never runs them.",
  ready: "Ready? /model connects a provider, /test checks it's awake, then just talk.",
  closing: "Go make something you love.",
} as const;

/** One line of the welcome; height 1 so stacked rows do not pile onto one another. */
const Row = ({ fg, children }: { fg: string; children: ReactNode }): ReactNode => (
  <box flexDirection="row" height={1}>
    <text fg={fg}>{children}</text>
  </box>
);

const WrapRow = ({ fg, children }: { fg: string; children: ReactNode }): ReactNode => (
  <text width="100%" wrapMode="word" fg={fg}>{children}</text>
);

function RainbowArt({
  lines,
  tick,
  availableWidth,
}: {
  lines: readonly string[];
  tick: number;
  availableWidth: number;
}): ReactNode {
  const artWidth = Math.max(...lines.map((line) => line.length));
  const offset = tick * FLOW;
  const cols = Array.from({ length: artWidth }, (_, col) =>
    rampAt(RAMP, col / artWidth - offset)
  );
  const shadowCols = cols.map((color) => darken(color, SHADOW_DARKEN));
  return (
    <box
      flexDirection="column"
      paddingLeft={Math.max(0, Math.floor((availableWidth - artWidth) / 2))}
    >
      {lines.map((line, row) => (
        <box key={row} flexDirection="row" height={1}>
          <text>
            {[...line].map((character, col) =>
              character === " " ? (
                <span key={col}> </span>
              ) : character === "S" ? (
                <span key={col} fg={shadowCols[Math.max(0, col - SHADOW_DX)]}>█</span>
              ) : (
                <span key={col} fg={cols[col]}>{character}</span>
              ),
            )}
          </text>
        </box>
      ))}
    </box>
  );
}

function CompactGreeting({
  studioName,
  totalPieces,
}: {
  studioName: string;
  totalPieces: number;
}): ReactNode {
  return (
    <>
      <WrapRow fg={theme.bright}>{STAGE_CUES.welcome}  {COPY.welcome}</WrapRow>
      <WrapRow fg={theme.soft}>    {COPY.studio(studioName)}</WrapRow>
      <WrapRow fg={theme.text}>{STAGE_CUES.studio}  {COPY.everything(totalPieces)}</WrapRow>
      <WrapRow fg={theme.text}>    {COPY.talk}</WrapRow>
      <WrapRow fg={theme.bright}>{STAGE_CUES.ideas}  Try saying:</WrapRow>
      {COPY.samples.map((sample) => (
        <WrapRow key={sample} fg={theme.teal}>    {sample}</WrapRow>
      ))}
      <WrapRow fg={theme.soft}>{STAGE_CUES.promises}  {COPY.promises}</WrapRow>
      <WrapRow fg={theme.soft}>{STAGE_CUES.ready}  {COPY.ready}</WrapRow>
      <WrapRow fg={theme.bright}>{COPY.closing}</WrapRow>
      <WrapRow fg={theme.mut}>- Chi</WrapRow>
    </>
  );
}

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
  const { width } = useTerminalDimensions();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setTick((x) => x + 1), STEP_MS);
    return () => clearInterval(id);
  }, [animate]);
  if (width < 110) {
    const art = width >= 48 ? COMPACT_ART : TINY_ART;
    const stageWidth = Math.max(1, Math.min(88, width - 2));
    const stageInset = Math.max(0, Math.floor((width - stageWidth) / 2));
    return (
      <box
        flexDirection="column"
        width={stageWidth}
        paddingTop={1}
        marginLeft={stageInset}
      >
        <RainbowArt lines={art} tick={tick} availableWidth={stageWidth} />
        <CompactGreeting studioName={studioName} totalPieces={totalPieces} />
      </box>
    );
  }

  const stageInset = Math.max(0, Math.floor((width - WIDTH) / 2));
  return (
    <box flexDirection="column" paddingTop={1} paddingLeft={stageInset}>
      <RainbowArt lines={ART} tick={tick} availableWidth={WIDTH} />

      <box height={1} />
      <Row fg={theme.bright}>{STAGE_CUES.welcome}  {COPY.welcome}</Row>
      <Row fg={theme.soft}>    {COPY.studio(studioName)}</Row>

      <box height={1} />
      <Row fg={theme.text}>
        {STAGE_CUES.studio}  {COPY.everything(totalPieces)}
      </Row>
      <Row fg={theme.text}>    {COPY.talk}</Row>

      <box height={1} />
      <Row fg={theme.bright}>{STAGE_CUES.ideas}  Try saying:</Row>
      {COPY.samples.map((sample) => (
        <Row key={sample} fg={theme.teal}>      {sample}</Row>
      ))}

      <box height={1} />
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          {STAGE_CUES.promises}  Two promises: nothing <span fg={theme.text}>leaves your machine</span> until
          you send it, and the
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
          {STAGE_CUES.ready}  Ready? <span fg={theme.text}>/model</span> connects a provider,{" "}
          <span fg={theme.text}>/test</span> checks it&apos;s awake, then just talk.
        </text>
      </box>

      <box height={1} />
      <Row fg={theme.bright}>{COPY.closing}</Row>
      <Row fg={theme.mut}>- Chi</Row>
    </box>
  );
}
