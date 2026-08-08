/** @jsxImportSource @opentui/react */
/**
 * An image pasted into the conversation, shown where it was pasted.
 *
 * DRAWN, NOT SENT, and the caption says so. Kit's providers take text, so an image on the clipboard
 * can be looked at and cannot yet be reasoned about - and an image that renders beautifully while the
 * model has no idea it exists is the worst version of this feature, because it looks like it worked.
 * The line names the gap rather than leaving somebody to discover it by asking about the picture.
 *
 * It is still worth having: seeing what you actually pasted is most of why people paste, and the
 * bytes are here for the tool that will put them on a card.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

/** Cells. Tall enough to recognise a face, short enough not to take the screen for a paste. */
const MAX_ROWS = 14;

export function PastedImage({
  bytes,
  width,
  height,
  note,
}: {
  bytes: Uint8Array;
  /** Source pixels, for the caption and for the aspect the renderer fits into. */
  width: number;
  height: number;
  note: string;
}): ReactNode {
  // Derive the cell box from the source aspect, capped by height. A cell is about twice as tall as
  // it is wide, so the column count is doubled relative to a naive ratio or every image comes out
  // squat - the same arithmetic the half-block path gets wrong when nobody is looking.
  const rows = Math.min(MAX_ROWS, Math.max(3, MAX_ROWS));
  const cols = Math.max(4, Math.round((rows * 2 * width) / Math.max(1, height)));
  return (
    <box flexDirection="column" paddingTop={1}>
      <box flexDirection="row" backgroundColor={theme.panel} paddingRight={1}>
        <box width={1} backgroundColor={theme.violet} />
        <text fg={theme.violet}>{" "}</text>
        <text fg={theme.quiet}>PASTED IMAGE</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>{`${width}x${height}`}</text>
      </box>
      <box flexDirection="row" backgroundColor={theme.recess}>
        <box width={1} backgroundColor={theme.violet} />
        <box paddingLeft={1}>
          <image source={bytes} width={cols} height={rows} fit="fit" protocol="auto" />
        </box>
      </box>
      <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
        <box width={1} backgroundColor={theme.violet} />
        <text fg={theme.quiet}>{` ${note}`}</text>
      </box>
    </box>
  );
}
