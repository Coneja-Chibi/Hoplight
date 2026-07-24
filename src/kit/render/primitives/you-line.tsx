/** @jsxImportSource @opentui/react */
/** YouLine: a user turn in the transcript, the rose prompt and your words. */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function YouLine({ text }: { text: string }): ReactNode {
  return (
    <text>
      <span fg={theme.rose}>{"> "}</span>
      <span fg={theme.text}>{text}</span>
    </text>
  );
}
