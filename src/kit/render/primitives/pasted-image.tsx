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
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../theme";
import { imageProtocol } from "../image-protocol";

/** Cells. Tall enough to recognise a face, short enough not to take the screen for a paste. */
/**
 * How much of the screen a pasted picture may take, as a share of it.
 *
 * A FIXED 14 ROWS was the bug: on a sixty-row terminal a 333px-tall photo was resampled into 28
 * vertical pixels, which is a twelve-fold downsample and looks like it sounds. Half-blocks are not
 * the reason a picture looks chunky; being drawn at a twelfth of its size is.
 */
const ROW_SHARE = 0.45;
const MIN_ROWS = 8;
const MAX_ROWS = 36;

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
  // Derive the cell box from the source aspect. A cell is about twice as tall as it is wide, so the
  // column count is doubled relative to a naive ratio or every image comes out squat - the same
  // arithmetic the half-block path gets wrong when nobody is looking.
  const term = useTerminalDimensions();
  const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.floor(term.height * ROW_SHARE)));
  // Then clamp by WIDTH too, so a landscape photo is not cropped by the terminal edge: whichever
  // bound bites first decides, and the other is recomputed from it rather than left overhanging.
  const wide = Math.max(4, Math.round((rows * 2 * width) / Math.max(1, height)));
  const budget = Math.max(8, term.width - 6);
  const cols = Math.min(wide, budget);
  const fitted = cols < wide ? Math.max(3, Math.round((cols * height) / (2 * Math.max(1, width)))) : rows;
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
          <image source={bytes} width={cols} height={fitted} fit="fit" protocol={imageProtocol()} />
        </box>
      </box>
      <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
        <box width={1} backgroundColor={theme.violet} />
        <text fg={theme.quiet}>{` ${note}`}</text>
      </box>
    </box>
  );
}
