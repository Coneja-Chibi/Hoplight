/** @jsxImportSource @opentui/react */
/** ErrorRow: a failure in the transcript, a recessed band with a red spine and the plain message. */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { Band } from "./band";

export function ErrorRow({ text }: { text: string }): ReactNode {
  return (
    <Band bg={theme.recess} spine={theme.red}>
      <text fg={theme.soft}>
        <span fg={theme.red}>{"! "}</span>
        {text}
      </text>
    </Band>
  );
}
