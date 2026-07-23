/** @jsxImportSource @opentui/react */
/**
 * InputBar: the carved-ledge composer (DECISIONS #27). Pressed INTO the stage, not floating: thin
 * dim top and left edges, a heavy "stamp" ledge on the bottom and right. Built from solid bg-color
 * strips, not box borders (OpenTUI partial borders collapse on re-render). A rose "> " prompt sits
 * flush with the text so prompt and field read as one unit. No command-hint row (the slash popup
 * surfaces commands on demand); rose is otherwise reserved for the sweep line above.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function InputBar({
  draft,
  onInput,
  onSubmit,
}: {
  draft: string;
  onInput: (value: string) => void;
  onSubmit: (value: string) => void;
}): ReactNode {
  return (
    <box flexDirection="column" backgroundColor={theme.well} paddingLeft={1} paddingRight={1} paddingBottom={1}>
      <box height={1} backgroundColor={theme.stampDim} />
      <box flexDirection="row" height={1}>
        <box width={1} backgroundColor={theme.stampDim} />
        <box flexGrow={1} flexDirection="row" backgroundColor={theme.sunken} paddingLeft={1} paddingRight={1}>
          <text fg={theme.rose}>{"> "}</text>
          <input
            focused
            flexGrow={1}
            value={draft}
            placeholder="talk to your studio"
            onInput={onInput}
            onSubmit={(value: unknown) => onSubmit(typeof value === "string" ? value : "")}
          />
        </box>
        <box width={1} backgroundColor={theme.stamp} />
      </box>
      <box height={1} backgroundColor={theme.stamp} />
    </box>
  );
}
