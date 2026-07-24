/** @jsxImportSource @opentui/react */
/**
 * ToolPeek: paints a PeekView (title, detail, reason) at the confirm pause. All redaction and truncation
 * already happened in peek-core; this shell only renders, with theme tokens. The title is the confide
 * voice (bright); the detail and reason are the soft/muted body. Detail is skipped when the title
 * already carries the whole story.
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
import type { PeekView } from "../../../tools/safety/peek-core";

export function ToolPeek({ peek }: { peek: PeekView }): ReactNode {
  return (
    <box flexDirection="column">
      <text fg={theme.bright}>{peek.title}</text>
      {peek.detail ? <text fg={theme.soft}>{peek.detail}</text> : null}
      <text fg={theme.mut}>{peek.reason}</text>
    </box>
  );
}
