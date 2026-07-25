/** @jsxImportSource @opentui/react */
/** YouLine: your turn in the transcript, a lifted band with a rose spine, the rose prompt and your words. */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { Band } from "./band";

export function YouLine({ text }: { text: string }): ReactNode {
  return (
    <Band bg={theme.lift} spine={theme.rose}>
      <text>
        <span fg={theme.rose}>{"> "}</span>
        <span fg={theme.text}>{text}</span>
      </text>
    </Band>
  );
}
