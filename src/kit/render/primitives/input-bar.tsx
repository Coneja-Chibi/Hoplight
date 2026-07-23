/** @jsxImportSource @opentui/react */
/**
 * InputBar: the composer (DECISIONS #27). A hard-bordered sunken field (a full box border, which
 * OpenTUI draws stably, unlike the collapsing bg-strip "carved" edges that read as a stray bar in a
 * real terminal, dark-on-near-black bottom/right ledges are invisible in a TTY). A rose "> " prompt
 * sits flush with the text so prompt and field read as one unit. No command-hint row (the slash
 * popup surfaces commands on demand); rose is otherwise reserved for the sweep line above.
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
      <box
        flexDirection="row"
        height={3}
        border
        borderColor={theme.line}
        backgroundColor={theme.sunken}
        paddingLeft={1}
        paddingRight={1}
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
    </box>
  );
}
