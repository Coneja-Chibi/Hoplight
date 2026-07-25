/** @jsxImportSource @opentui/react */
/** QueueTicket: a compact receipt for follow-up whispers waiting behind the active turn. */
import type { ReactNode } from "react";
import { truncateGraphemes } from "../../../_shared/graphemes";
import { theme } from "../../theme";

const compact = (text: string): string =>
  truncateGraphemes(text.replace(/\s+/g, " ").trim(), 54);

export function QueueTicket({ items }: { items: readonly string[] }): ReactNode {
  if (items.length === 0) return null;
  const remaining = items.length - 1;
  return (
    <box
      flexDirection="row"
      backgroundColor={theme.panel}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={theme.rose}>{"QUEUED  "}</text>
      <text fg={theme.soft}>{compact(items[0] ?? "")}</text>
      {remaining > 0 ? <text fg={theme.quiet}>{`  ${remaining} more`}</text> : null}
    </box>
  );
}
