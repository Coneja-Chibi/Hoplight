/** @jsxImportSource @opentui/react */
/** WatchNote: a non-modal transcript cue for a studio change Kit noticed outside itself. */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function WatchNote({ text }: { text: string }): ReactNode {
  return (
    <box flexDirection="row" backgroundColor={theme.recess} paddingLeft={1} paddingRight={1}>
      <text fg={theme.gold}>{"NOTICED  "}</text>
      <text fg={theme.soft}>{text}</text>
    </box>
  );
}
