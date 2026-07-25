/** @jsxImportSource @opentui/react */
/** StatusToast: a brief, plain statement above the prompter rail for local interaction outcomes. */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function StatusToast({ text }: { text: string | null }): ReactNode {
  if (!text) return null;
  return (
    <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
      <text fg={theme.teal}>{"· "}</text>
      <text fg={theme.soft}>{text}</text>
    </box>
  );
}
