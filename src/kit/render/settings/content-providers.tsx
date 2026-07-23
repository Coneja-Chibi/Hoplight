/** @jsxImportSource @opentui/react */
/**
 * Providers content: the saved providers plus an "add a provider" row. The active provider carries a
 * gold tag; the selected row highlights, with a rose spine when the content pane holds focus.
 * Clicking a row does what enter would (activate a saved one, or open the picker on the add row).
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import type { SettingsState } from "./model";

export function ProvidersContent({
  state,
  onRow,
}: {
  state: SettingsState;
  onRow: (index: number) => void;
}): ReactNode {
  const focused = state.focus === "content" && state.mode === "sections";
  const addIndex = state.saved.length;
  return (
    <box flexDirection="column">
      {state.saved.map((provider, index) => {
        const selected = index === state.contentIndex;
        const spine = selected && focused;
        const active = provider.id != null && provider.id === state.activeId;
        return (
          <box
            key={provider.id ?? index}
            flexDirection="row"
            backgroundColor={selected ? theme.row : undefined}
            border={spine ? ["left"] : undefined}
            borderColor={theme.rose}
            paddingLeft={1}
            paddingRight={1}
            onMouseDown={() => onRow(index)}
          >
            <text fg={selected ? theme.text : theme.soft}>
              {provider.name ?? provider.kind} <span fg={theme.mut}>{provider.kind}</span>
            </text>
            <box flexGrow={1} />
            {active ? <text fg={theme.gold}>active</text> : null}
          </box>
        );
      })}
      <box
        flexDirection="row"
        backgroundColor={state.contentIndex === addIndex ? theme.row : undefined}
        border={state.contentIndex === addIndex && focused ? ["left"] : undefined}
        borderColor={theme.rose}
        paddingLeft={1}
        paddingRight={1}
        onMouseDown={() => onRow(addIndex)}
      >
        <text fg={theme.teal}>+ add a provider</text>
      </box>
    </box>
  );
}
