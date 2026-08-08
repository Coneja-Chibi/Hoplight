/** @jsxImportSource @opentui/react */
/**
 * The block editor: a card over the screen with a real cursor in it.
 *
 * WHAT IT REPLACES. The rail's editor held one `string` and appended printable characters - no
 * cursor, no scrolling, and Enter was the commit key, so a paragraph break was not a character
 * anybody could type. Workable for renaming a block, useless for the 3.8k of hand-laid unicode a
 * README block holds.
 *
 * EVERY LINE IS SHOWN WHOLE. The first version drew the cursor's line in full and CUT every other
 * one to the pane width, so the only paragraph you could read entire was the one you were standing
 * in - reported as "I have to hover lines to see the whole part", which was not hovering at all, it
 * was the cursor moving. Lines wrap on words now; see wrap.ts, which also owns the arithmetic that
 * turns a click back into a position.
 *
 * A CARD, IN THE FAMILY THE GATE ALREADY USES: a border, a filled header band, the panel ground. It
 * says "you are in a thing" without a word, which matters because this surface takes every key while
 * it is up.
 *
 * IT STATES ITS OWN WIDTH. The last overlay-shaped thing added to Kit had none, so the transcript
 * column claimed the whole terminal and drew over it, clipping the first characters off every line.
 *
 * NOTHING HERE WRITES. Saving hands the text back; the caller stages it as an ordinary draft that
 * meets the ordinary Gate. A better way to compose a change, never a second way to make one.
 */
import type { ReactNode } from "react";
import { MouseButton } from "@opentui/core";
import type { MouseEvent } from "@opentui/core";
import { theme } from "../theme";
import type { TextBuffer } from "./text-buffer";
import { covers, type Anchor } from "./selection";
import { fromVisual, toVisual, visualWindow, wrapAll } from "./wrap";

/** Where the text starts inside the card: border, then the line-number gutter. */
const GUTTER = 5;

export function BlockEditor({
  session,
  width,
  height,
  onPlace,
}: {
  session: {
    /** What is being edited. Null means draw nothing, so the shell needs no condition. */
    target: { title: string } | null;
    buffer: TextBuffer;
    anchor: Anchor;
    /** Has anything changed? Shown, so closing never silently throws work away. */
    dirty: boolean;
  };
  /** The terminal's own size; the card insets itself from it. */
  width: number;
  height: number;
  /** A click landed on the text: put the cursor there. `dragging` extends the selection instead. */
  onPlace?: (row: number, col: number, dragging: boolean) => void;
}): ReactNode {
  if (!session.target) return null;
  const { buffer, anchor, dirty } = session;
  const title = session.target.title;

  const cardWidth = Math.max(40, Math.min(width - 8, 120));
  const room = Math.max(8, cardWidth - GUTTER - 3);
  const tall = Math.max(6, height - 10);

  const rows = wrapAll(buffer.lines, room);
  const here = toVisual(rows, buffer.row, buffer.col);
  const { from, to } = visualWindow(rows, here.index, tall);
  const shown = rows.slice(from, to);

  return (
    <box flexDirection="row" width={width} justifyContent="center">
      <box
        flexDirection="column"
        width={cardWidth}
        flexShrink={0}
        border
        borderColor={dirty ? theme.gold : theme.line}
        backgroundColor={theme.floor}
      >
        <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
          <text fg={theme.gold}>{"EDIT BLOCK"}</text>
          <text fg={theme.bright}>{`  ${title}`}</text>
          <box flexGrow={1} />
          <text fg={theme.quiet}>
            {`${String(buffer.row + 1)}:${String(buffer.col + 1)} of ${String(buffer.lines.length)}`}
          </text>
        </box>

        {shown.map((line, index) => {
          const at = from + index;
          const onCursor = at === here.index;
          return (
            <box
              key={`r${String(at)}`}
              flexDirection="row"
              backgroundColor={onCursor ? theme.sunken : theme.floor}
              paddingLeft={1}
              paddingRight={1}
              /**
               * CLICK PUTS THE CURSOR WHERE YOU CLICKED, and dragging selects. The column arrives as
               * a screen position, so the gutter is subtracted and wrap.ts turns the rest back into a
               * place in the document - the round trip it has a test for.
               */
              onMouseDown={(event: MouseEvent) => {
                if (event.button !== MouseButton.LEFT) return;
                event.preventDefault();
                const spot = fromVisual(rows, at, Math.max(0, event.x - GUTTER));
                onPlace?.(spot.row, spot.col, false);
              }}
              onMouseDrag={(event: MouseEvent) => {
                const spot = fromVisual(rows, at, Math.max(0, event.x - GUTTER));
                onPlace?.(spot.row, spot.col, true);
              }}
            >
              {/* Only the first row of a wrapped line is numbered; the rest are the same line. */}
              <text fg={onCursor ? theme.gold : theme.mut}>
                {line.first ? `${String(line.row + 1).padStart(4, " ")} ` : "     "}
              </text>
              <text>
                {[...(line.text || " ")].map((ch, i) => {
                  const col = line.from + i;
                  const isCursor = onCursor && col === buffer.col;
                  const picked = covers(anchor, { row: buffer.row, col: buffer.col }, line.row, col);
                  return (
                    <span
                      key={`c${String(i)}`}
                      fg={isCursor ? theme.well : theme.soft}
                      bg={isCursor ? theme.rose : picked ? theme.violetDeep : undefined}
                    >
                      {ch}
                    </span>
                  );
                })}
                {/* The caret past the last character has no cell of its own to live in. */}
                {onCursor && buffer.col >= line.from + line.text.length
                  ? <span fg={theme.well} bg={theme.rose}>{" "}</span>
                  : null}
              </text>
            </box>
          );
        })}

        {to < rows.length ? (
          <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1}>
            <text fg={theme.mut}>{`     ${String(rows.length - to)} more lines below`}</text>
          </box>
        ) : null}

        <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
          <text fg={theme.teal}>{"ctrl+s"}</text>
          <text fg={theme.quiet}>{" keeps  "}</text>
          <text fg={theme.red}>{"esc"}</text>
          <text fg={theme.quiet}>{" discards  "}</text>
          <text fg={theme.quiet}>{"ctrl+c/v copy paste"}</text>
          <box flexGrow={1} />
          {/* Never silently: closing an edited block without saying so is how work disappears. */}
          <text fg={dirty ? theme.gold : theme.mut}>{dirty ? "edited" : "unchanged"}</text>
        </box>
      </box>
    </box>
  );
}
