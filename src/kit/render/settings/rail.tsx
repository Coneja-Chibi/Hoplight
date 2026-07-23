/** @jsxImportSource @opentui/react */
/**
 * The sections rail: Providers, Gates, Studio, About. The current section highlights; when the rail
 * holds focus the current row carries a rose spine. Clicking a row selects that section.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { SECTIONS, type SettingsState } from "./model";

const LABELS: Record<string, string> = {
  providers: "Providers",
  gates: "Gates",
  studio: "Studio",
  about: "About",
};

export function Rail({
  state,
  onPick,
}: {
  state: SettingsState;
  onPick: (index: number) => void;
}): ReactNode {
  const railFocused = state.focus === "rail" && state.mode === "sections";
  return (
    <box flexDirection="column">
      {SECTIONS.map((section, index) => {
        const selected = section === state.section;
        const spine = selected && railFocused;
        const count = section === "providers" ? state.saved.length : undefined;
        return (
          <box
            key={section}
            flexDirection="row"
            backgroundColor={selected ? theme.row : undefined}
            border={spine ? ["left"] : undefined}
            borderColor={theme.rose}
            paddingLeft={1}
            paddingRight={1}
            onMouseDown={() => onPick(index)}
          >
            <text fg={selected ? theme.text : theme.soft}>{LABELS[section]}</text>
            <box flexGrow={1} />
            {count !== undefined ? <text fg={theme.mut}>{String(count)}</text> : null}
          </box>
        );
      })}
    </box>
  );
}
