/** @jsxImportSource @opentui/react */
/**
 * Playbill: the persistent header (locked look, DECISIONS #23 refined with Chi 2026-07-24). A compact
 * masthead, "Kit." in the display weight with a rose period, and the studio, piece count, and active
 * provider on the right, over a rose-deep rule and a deck strip carrying each deck's live count and the
 * egress promise. No marquee lamps: the header carries who/what quietly; the status bar down low carries
 * live state, so neither repeats the other.
 */
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import type { DeckCount } from "../../bridge";
import type { TokenUsage } from "../../providers/usage";
import { theme } from "../theme";
import { ContextMeter } from "./meters/context-meter";
import { TokenTally } from "./meters/token-tally";

export function Playbill({
  studioName,
  totalPieces,
  decks,
  provider,
  turnUsage,
  sessionUsage,
  contextMax,
}: {
  studioName: string;
  totalPieces: number;
  decks: DeckCount[];
  provider: { name: string; model: string } | null;
  turnUsage: TokenUsage;
  sessionUsage: TokenUsage;
  contextMax: number | undefined;
}): ReactNode {
  const { width } = useTerminalDimensions();
  const compact = width < 60;
  return (
    <box flexDirection="column">
      <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text>
          <b fg={theme.text}>Kit</b>
          <span fg={theme.rose}>.</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.soft}>
          {compact ? (
            <span fg={theme.text}>{String(totalPieces)} pieces</span>
          ) : (
            <span>
              studio <span fg={theme.text}>{studioName}</span> ·{" "}
              <span fg={theme.text}>{String(totalPieces)}</span> pieces
            </span>
          )}
          {provider && !compact ? (
            <span>
              {" · "}
              <span fg={theme.text}>{provider.name}</span>
            </span>
          ) : null}
        </text>
      </box>
      <box height={1} backgroundColor={theme.roseDeep} />
      <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
        {!compact ? (
          <>
            <text fg={theme.soft}>
              <span fg={theme.text}>decks </span>
              {decks.flatMap((deck, i) => [
                i > 0 ? <span key={`sep${i}`} fg={theme.quiet}>{" · "}</span> : null,
                <span key={`lbl${i}`}>{deck.label} </span>,
                <span key={`cnt${i}`} fg={theme.text}>{String(deck.count)}</span>,
              ])}
            </text>
            <box flexGrow={1} />
          </>
        ) : null}
        <text fg={theme.soft}>
          <span fg={theme.text}>egress </span>only when you send
        </text>
      </box>
      {provider ? (
        <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1} border={["top"]} borderColor={theme.seam}>
          <ContextMeter consumed={turnUsage.input} max={contextMax} />
          <box flexGrow={1} />
          <TokenTally turn={turnUsage} session={sessionUsage} />
        </box>
      ) : null}
    </box>
  );
}
