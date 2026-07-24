/** @jsxImportSource @opentui/react */
/**
 * Panel: one Panel Deck pane, transcribed from the locked wireframe (.p/.ph): a header row on the
 * floor color with a hard black underline, the body below, and a single right-edge rule that turns
 * rose when the pane is active. No box borders anywhere; the wireframe's "2px solid #000" rules are
 * drawn as solid background rows/columns, which stay stable across re-renders.
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
  return (
    <box flexDirection="row" width={width} flexGrow={width ? undefined : 1}>
      <box flexDirection="column" flexGrow={1} backgroundColor={theme.panel}>
        <box backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
          <text fg={focused ? theme.rose : theme.mut}>
            [{String(index)}] {title.toUpperCase()}
          </text>
        </box>
        <box height={1} backgroundColor={theme.edge} />
        <box flexDirection="column" flexGrow={1} paddingTop={1}>
          {children}
        </box>
      </box>
      <box width={1} backgroundColor={focused ? theme.rose : theme.edge} />
    </box>
  );
}
