/** @jsxImportSource @opentui/react */
/** MentionMenu: the studio-piece picker shown above the composer for a trailing at-query. */
import type { ReactNode } from "react";
import type { EntitySummary } from "../../../bridge";
import { kindColor, theme } from "../../theme";

export function MentionMenu({
  pieces,
  activeIndex,
  onChoose,
}: {
  pieces: readonly EntitySummary[];
  activeIndex: number;
  onChoose: (piece: EntitySummary) => void;
}): ReactNode {
  return (
    <box flexDirection="column" border={["left"]} borderColor={theme.rose} backgroundColor={theme.floor}>
      <box backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text fg={theme.quiet}>STUDIO PIECES</text>
      </box>
      {pieces.map((piece, index) => (
        <box
          key={`${piece.kind}:${piece.id}`}
          flexDirection="row"
          backgroundColor={index === activeIndex ? theme.lift : theme.floor}
          paddingLeft={1}
          paddingRight={1}
          onMouseDown={() => onChoose(piece)}
        >
          <text fg={kindColor[piece.kind] ?? theme.teal}>{piece.name}</text>
          <box flexGrow={1} />
          <text fg={theme.quiet}>{piece.kind}</text>
        </box>
      ))}
    </box>
  );
}
