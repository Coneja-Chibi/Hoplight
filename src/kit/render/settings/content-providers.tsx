/** @jsxImportSource @opentui/react */
/**
 * Providers content: the saved providers plus an "add a provider" row, in the wireframe's flat .li
 * row style (row background + rose gutter accent on the current row while this pane is active; the
 * active provider carries a gold tag). Clicking a row does what enter would: activate a saved one,
 * or open the picker on the add row.
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
  const paneActive = state.focus === "content" && state.mode === "sections";
  const addIndex = state.saved.length;
  const addSelected = paneActive && state.contentIndex === addIndex;
  return (
    <box flexDirection="column">
      {state.saved.map((provider, index) => {
        const selected = paneActive && index === state.contentIndex;
        const active = provider.id != null && provider.id === state.activeId;
        return (
          <box
            key={provider.id ?? index}
            flexDirection="row"
            backgroundColor={selected ? theme.row : theme.panel}
            paddingRight={1}
            onMouseDown={() => onRow(index)}
          >
            <text fg={theme.rose}>{selected ? "▌ " : "  "}</text>
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
        backgroundColor={addSelected ? theme.row : theme.panel}
        paddingRight={1}
        onMouseDown={() => onRow(addIndex)}
      >
        <text fg={theme.rose}>{addSelected ? "▌ " : "  "}</text>
        <text fg={theme.teal}>+ add a provider</text>
      </box>
    </box>
  );
}
