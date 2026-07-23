/** @jsxImportSource @opentui/react */
/**
 * Panel: a numbered, bordered Panel Deck pane. The header reads "[n] TITLE"; the border and header
 * glow rose when the pane holds focus and sit on the dim line color otherwise. The one frame both
 * the sections rail and the content pane are drawn in.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function Panel({
  index,
  title,
  focused,
  width,
  children,
}: {
  index: number;
  title: string;
  focused: boolean;
  width?: number;
  children: ReactNode;
}): ReactNode {
  const accent = focused ? theme.rose : theme.line;
  return (
    <box
      flexDirection="column"
      width={width}
      flexGrow={width ? undefined : 1}
      border
      borderColor={accent}
      backgroundColor={theme.panel}
    >
      <box border={["bottom"]} borderColor={theme.line} paddingLeft={1} paddingRight={1}>
        <text fg={focused ? theme.rose : theme.mut}>
          [{String(index)}] {title.toUpperCase()}
        </text>
      </box>
      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1} paddingTop={1}>
        {children}
      </box>
    </box>
  );
}
