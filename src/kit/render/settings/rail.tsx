/** @jsxImportSource @opentui/react */
/**
 * The sections rail, transcribed from the wireframe's .li rows: flat single-height rows, and only
 * while the rail is the active pane does the current row light up (row background, rose left
 * accent, bright text). The accent is a glyph in a reserved two-char gutter, not a box border, so
 * rows never shift and never grow lines. Clicking a row selects that section.
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
  const railActive = state.focus === "rail" && state.mode === "sections";
  return (
    <box flexDirection="column">
      {SECTIONS.map((section, index) => {
        const selected = railActive && section === state.section;
        const count = section === "providers" ? state.saved.length : undefined;
        return (
          <box
            key={section}
            flexDirection="row"
            backgroundColor={selected ? theme.row : theme.panel}
            paddingRight={1}
            onMouseDown={() => onPick(index)}
          >
            <text fg={theme.rose}>{selected ? "▌ " : "  "}</text>
            <text fg={selected ? theme.text : theme.soft}>{LABELS[section]}</text>
            <box flexGrow={1} />
            {count !== undefined ? <text fg={theme.mut}>{String(count)}</text> : null}
          </box>
        );
      })}
    </box>
  );
}
