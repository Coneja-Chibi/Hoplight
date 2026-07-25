/** @jsxImportSource @opentui/react */
/** The registry-driven slash palette that rises directly above Kit's prompter rail. */
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import type { KitCommand } from "../../../commands/command";
import { theme } from "../../theme";
import { visibleWindow } from "../nav/visible-window";

export function CommandMenu({
  commands,
  activeIndex,
  onChoose,
}: {
  commands: readonly KitCommand[];
  activeIndex: number;
  onChoose: (command: KitCommand) => void;
}): ReactNode {
  const { height } = useTerminalDimensions();
  const limit = Math.max(3, Math.min(10, height - 8));
  const window = visibleWindow(commands, activeIndex, limit);
  return (
    <box
      flexDirection="column"
      backgroundColor={theme.floor}
      border={["top", "left", "right"]}
      borderColor={theme.line}
    >
      <box flexDirection="row" height={1} backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text fg={theme.rose}><b>SLASH COMMANDS</b></text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>
          {window.start + 1}-{window.start + window.items.length}/{commands.length}
        </text>
      </box>
      {window.items.map((command, localIndex) => {
        const index = window.start + localIndex;
        const selected = index === activeIndex;
        return (
          <box
            key={command.name}
            flexDirection="row"
            height={1}
            backgroundColor={selected ? theme.lift : theme.floor}
            onMouseDown={() => onChoose(command)}
          >
            <box
              width={3}
              justifyContent="center"
              backgroundColor={selected ? theme.roseDeep : theme.floor}
            >
              <text fg={selected ? theme.white : theme.floor}>{">"}</text>
            </box>
            <box width={15} paddingLeft={1}>
              <text fg={selected ? theme.white : theme.bright}><b>{command.name}</b></text>
            </box>
            <box flexGrow={1} paddingLeft={1} paddingRight={1} overflow="hidden">
              <text fg={selected ? theme.text : theme.soft}>{command.summary}</text>
            </box>
          </box>
        );
      })}
      <box height={1} backgroundColor={theme.sunken} paddingLeft={1}>
        <text fg={theme.quiet}>up/down choose  enter run  tab complete  esc close</text>
      </box>
    </box>
  );
}
