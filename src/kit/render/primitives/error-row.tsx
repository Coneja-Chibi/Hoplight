/** @jsxImportSource @opentui/react */
/** ErrorRow: a failure in the transcript, a recessed band with a red spine and the plain message. */
import type { ReactNode } from "react";
import { truncateGraphemes } from "../../_shared/graphemes";
import { theme } from "../theme";
import { CopyableBand } from "./copyable-band";

export const ERROR_ROW_CHARS = 600;

export function ErrorRow({ text, onCopy }: { text: string; onCopy?: () => void }): ReactNode {
  const bounded = truncateGraphemes(text, ERROR_ROW_CHARS);
  return (
    <CopyableBand bg={theme.recess} spine={theme.red} onCopy={onCopy}>
      <text fg={theme.soft}>
        <span fg={theme.red}>{"! "}</span>
        {bounded}
      </text>
    </CopyableBand>
  );
}
