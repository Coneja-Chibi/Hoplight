/** @jsxImportSource @opentui/react */
/**
 * InputBar: the composer (DECISIONS #27), take A/D, a hard-bordered field lifted off the stage by a
 * neo-brute offset shadow. The field is a full box border (OpenTUI draws these stably); a "stamp"
 * ledge runs down its right (pushed down one row) and across its bottom (pushed right one column),
 * so it reads as a stamped card casting a hard shadow down-and-right. On a near-black stage the
 * shadow must be LIGHTER than the floor to show, so the stamp tone is a lifted grey, not black.
 * Rose "> " prompt flush; no command-hint row (the slash popup surfaces commands on demand).
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
      <box flexDirection="row">
        <box
          flexDirection="row"
          height={3}
          border
          borderColor={theme.line}
          backgroundColor={theme.sunken}
          paddingLeft={1}
          paddingRight={1}
          flexGrow={1}
        >
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
        <box width={1} marginTop={1} backgroundColor={theme.stamp} />
      </box>
      <box flexDirection="row">
        <box width={1} />
        <box flexGrow={1} height={1} backgroundColor={theme.stamp} />
        <box width={1} height={1} backgroundColor={theme.stamp} />
      </box>
    </box>
  );
}
