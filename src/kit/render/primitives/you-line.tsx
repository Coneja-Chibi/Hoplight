/** @jsxImportSource @opentui/react */
/** YouLine: your turn in the transcript, a lifted band with a rose spine, the rose prompt and your words. */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { CopyableBand } from "./copyable-band";

export function YouLine({ text, onCopy }: { text: string; onCopy?: () => void }): ReactNode {
  return (
    <CopyableBand bg={theme.lift} spine={theme.rose} onCopy={onCopy}>
      <text>
        <span fg={theme.rose}>{"> "}</span>
        <span fg={theme.text}>{text}</span>
      </text>
    </CopyableBand>
  );
}
