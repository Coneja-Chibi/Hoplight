/** @jsxImportSource @opentui/react */
/**
 * PasteCard: a pending pasted block held above the composer (a big or multi-line paste is set aside as
 * a chip instead of flooding the input) and spliced back into the message at submit time. One line,
 * theme tokens, the same recessed-fill language as the backstage/tool rows.
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
import type { PasteCard as Card } from "./paste-classify";

export function PasteCard({ card, onRemove }: { card: Card; onRemove: () => void }): ReactNode {
  return (
    <box
      flexDirection="row"
      height={1}
      backgroundColor={theme.sunken}
      paddingLeft={1}
      paddingRight={1}
      onMouseDown={onRemove}
    >
      <text fg={theme.gold}>{"▤ "}</text>
      <text fg={theme.soft} flexGrow={1}>{card.preview}</text>
      <text fg={theme.quiet}>{"remove"}</text>
    </box>
  );
}
