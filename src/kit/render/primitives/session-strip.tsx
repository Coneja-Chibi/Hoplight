/** @jsxImportSource @opentui/react */
/**
 * SessionStrip: the live deck counts and the egress trust line, under the masthead. High-contrast,
 * rose middots between decks, a hard bottom edge.
 */
import type { ReactNode } from "react";
import type { DeckCount } from "../../bridge";
import { theme } from "../theme";

export function SessionStrip({ decks }: { decks: DeckCount[] }): ReactNode {
  const shown = decks.filter((deck) => deck.count > 0);
  const parts = shown.length > 0 ? shown : decks;
  return (
    <box
      flexDirection="row"
      backgroundColor={theme.floor}
      border={["bottom"]}
      borderColor={theme.edge}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={theme.soft}>
        <span fg={theme.text}>decks </span>
        {parts.map((deck, index) => (
          <span key={deck.kind} fg={theme.soft}>
            {index > 0 ? <span fg={theme.rose}> · </span> : null}
            {deck.label.toLowerCase()} <span fg={theme.text}>{String(deck.count)}</span>
          </span>
        ))}
      </text>
      <box flexGrow={1} />
      <text fg={theme.soft}>
        <span fg={theme.text}>egress </span>only when you send <span fg={theme.rose}>·</span> scripts sealed
      </text>
    </box>
  );
}
