/** @jsxImportSource @opentui/react */
/** The registry-driven slash palette that rises directly above Kit's prompter rail. */
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import type { KitCommand } from "../../../commands/command";
import { theme } from "../../theme";
import { visibleWindow } from "../nav/visible-window";

/** One row, whatever it names. A command and a piece id are the same shape to a menu. */
export interface MenuRow {
  /** The word inserted when chosen. */
  readonly label: string;
  /** The right-hand explanation: a summary, a display name, a count. */
  readonly note?: string;
}

export const rowsOfCommands = (commands: readonly KitCommand[]): MenuRow[] =>
  commands.map((c) => ({ label: c.name, note: c.summary }));

export function CommandMenu({
  commands,
  rows,
  heading = "SLASH COMMANDS",
  activeIndex,
  onChoose,
  onChooseRow,
}: {
  commands?: readonly KitCommand[];
  /**
   * Rows to draw when this is not a command list.
   *
   * ONE MENU, TWO USES, rather than a second component. The palette completed the command word and
   * stopped there, so an argument had to be typed exactly from memory - and the obvious fix, a
   * separate ArgMenu, would have been a second popup to keep visually in step with this one forever.
   * A row is a label and a note whether it names a command or a preset.
   */
  rows?: readonly MenuRow[];
  /** What the popup is offering, so the header is never a lie about the list under it. */
  heading?: string;
  activeIndex: number;
  onChoose?: (command: KitCommand) => void;
  onChooseRow?: (row: MenuRow) => void;
}): ReactNode {
  const { height } = useTerminalDimensions();
  const limit = Math.max(3, Math.min(10, height - 8));
  const items: readonly MenuRow[] = rows ?? rowsOfCommands(commands ?? []);
  const window = visibleWindow(items, activeIndex, limit);
  return (
    <box
      flexDirection="column"
      backgroundColor={theme.floor}
      border={["top", "left", "right"]}
      borderColor={theme.line}
    >
      <box flexDirection="row" height={1} backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text fg={theme.rose}><b>{heading}</b></text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>
          {window.start + 1}-{window.start + window.items.length}/{items.length}
        </text>
      </box>
      {window.items.map((row, localIndex) => {
        const index = window.start + localIndex;
        const selected = index === activeIndex;
        return (
          <box
            key={row.label}
            flexDirection="row"
            height={1}
            backgroundColor={selected ? theme.lift : theme.floor}
            onMouseDown={() => {
              if (onChooseRow) onChooseRow(row);
              else if (onChoose && commands) {
                const found = commands.find((c) => c.name === row.label);
                if (found) onChoose(found);
              }
            }}
          >
            <box
              width={3}
              justifyContent="center"
              backgroundColor={selected ? theme.roseDeep : theme.floor}
            >
              <text fg={selected ? theme.white : theme.floor}>{">"}</text>
            </box>
            {/* Wide enough for a studio id, which is the longest label this menu ever draws. */}
            <box width={22} paddingLeft={1} overflow="hidden">
              <text fg={selected ? theme.white : theme.bright}><b>{row.label}</b></text>
            </box>
            <box flexGrow={1} paddingLeft={1} paddingRight={1} overflow="hidden">
              <text fg={selected ? theme.text : theme.soft}>{row.note ?? ""}</text>
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
