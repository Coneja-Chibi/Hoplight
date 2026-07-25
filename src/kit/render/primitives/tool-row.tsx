/** @jsxImportSource @opentui/react */
/** ToolRow: one tool call in the transcript, a teal-deep left spine and its one-line summary. */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function ToolRow({ summary }: { summary: string }): ReactNode {
  return (
    <box
      flexDirection="row"
      backgroundColor={theme.row}
      border={["left"]}
      borderColor={theme.tealDeep}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={theme.soft}>{summary}</text>
    </box>
  );
}
