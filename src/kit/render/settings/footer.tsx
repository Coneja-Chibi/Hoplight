/** @jsxImportSource @opentui/react */
/**
 * Settings footer: the key hints for the current mode, reusing the KeyHint atom so the CLI signature
 * matches the session bar.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { KeyHint, type Hint } from "../primitives/key-hint";
import type { Mode } from "./model";

const HINTS: Record<Mode, ReadonlyArray<Hint>> = {
  sections: [
    { key: "tab", label: "switch panel" },
    { key: "up/down", label: "move" },
    { key: "enter", label: "open" },
    { key: "esc", label: "back" },
  ],
  picker: [
    { key: "up/down", label: "choose" },
    { key: "enter", label: "pick" },
    { key: "esc", label: "back" },
  ],
  form: [
    { key: "tab", label: "field" },
    { key: "enter", label: "save" },
    { key: "esc", label: "back" },
  ],
};

export function SettingsFooter({ mode }: { mode: Mode }): ReactNode {
  return (
    <box
      flexDirection="row"
      backgroundColor={theme.floor}
      border={["top"]}
      borderColor={theme.edge}
      paddingLeft={1}
      paddingRight={1}
    >
      <KeyHint hints={HINTS[mode]} />
    </box>
  );
}
