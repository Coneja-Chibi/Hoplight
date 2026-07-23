/** @jsxImportSource @opentui/react */
/**
 * InputBar: the composer (DECISIONS #27), heavy frame + lifted plate + rose cap. A thick "heavy"
 * box border is the neo-brute stamp (a TTY can't fake an offset shadow, it only makes a grey bar);
 * the field sits on a lighter plate for a lift without a shadow. A rose-deep "> " cap block (white
 * ink) is fused to the left border so the prompt is a real stamp, not a floating marker. No
 * command-hint row (the slash popup surfaces commands on demand); rose is otherwise the sweep's.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { SweepLine } from "./sweep-line";

export function InputBar({
  draft,
  active,
  onInput,
  onSubmit,
}: {
  draft: string;
  /** True while a turn runs: the searchlight beam rides the box's top edge. */
  active: boolean;
  onInput: (value: string) => void;
  onSubmit: (value: string) => void;
}): ReactNode {
  return (
    <box flexDirection="column" backgroundColor={theme.well} paddingLeft={1} paddingRight={1} paddingBottom={1}>
      {active ? <SweepLine /> : <box height={1} />}
      <box
        flexDirection="row"
        height={3}
        border
        borderStyle="heavy"
        borderColor={theme.line}
        backgroundColor={theme.panel}
        paddingRight={1}
      >
        <box backgroundColor={theme.roseDeep} paddingLeft={1} paddingRight={1}>
          <text fg={theme.white}>{">"}</text>
        </box>
        <box width={1} />
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
