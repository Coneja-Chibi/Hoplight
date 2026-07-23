/** @jsxImportSource @opentui/react */
/**
 * Provider picker: the drop-in spokes as a chooser. Each row shows a brand square (echoing the rose
 * logo mark) and the label; the current row highlights with a rose spine. Clicking a row picks it.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import type { SettingsState } from "./model";

export function Picker({
  state,
  onPick,
}: {
  state: SettingsState;
  onPick: (index: number) => void;
}): ReactNode {
  return (
    <box flexDirection="column">
      <text fg={theme.mut}>Choose a provider</text>
      <box flexDirection="column" paddingTop={1}>
        {state.choices.map((choice, index) => {
          const selected = index === state.pickerIndex;
          return (
            <box
              key={choice.id}
              flexDirection="row"
              backgroundColor={selected ? theme.row : undefined}
              border={selected ? ["left"] : undefined}
              borderColor={theme.rose}
              paddingLeft={1}
              paddingRight={1}
              onMouseDown={() => onPick(index)}
            >
              <text fg={choice.brand}>{"■"}</text>
              <text fg={selected ? theme.text : theme.soft}> {choice.label}</text>
            </box>
          );
        })}
      </box>
    </box>
  );
}
