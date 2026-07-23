/** @jsxImportSource @opentui/react */
/** ErrorRow: a failure in the transcript, a rose left spine and the plain message. */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function ErrorRow({ text }: { text: string }): ReactNode {
  return (
    <box
      flexDirection="row"
      backgroundColor={theme.row}
      border={["left"]}
      borderColor={theme.rose}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={theme.soft}>
        <span fg={theme.rose}>{"! "}</span>
        {text}
      </text>
    </box>
  );
}
