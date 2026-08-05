/** @jsxImportSource @opentui/react */
/**
 * The gallery strip: card art in a row along the bottom, sitting directly on the composer.
 *
 * WINDOWED, NOT WRAPPED. A shelf of forty faces cannot fit, and stacking them into rows would grow
 * the strip until it ate the conversation. It shows the run that fits and scrolls to keep the cursor
 * inside, so the height is fixed and the transcript above it never moves.
 *
 * The selected card is marked by its BORDER and its caption, not by size. A card that grew on
 * selection would shift every card beside it, and a row that reflows while you arrow through it is
 * the thing that makes a picker feel broken.
 */
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../theme";
import { imageProtocol } from "../image-protocol";
import type { GalleryState } from "./use-gallery";

/** Cells per card, and the rows the art gets. Card art is 2:3, so height is the real bound. */
const CARD_W = 12;
const CARD_H = 7;

/** The window of cards to draw, chosen so the cursor is always inside it. */
export function windowFor(count: number, index: number, perView: number): { start: number; end: number } {
  if (count === 0 || perView <= 0) return { start: 0, end: 0 };
  const span = Math.min(perView, count);
  // Centre the cursor when there is room on both sides, then clamp to the ends so the last page is
  // full rather than half-empty.
  const ideal = index - Math.floor(span / 2);
  const start = Math.min(Math.max(0, ideal), Math.max(0, count - span));
  return { start, end: start + span };
}

export function GalleryStrip({
  state,
  onSelect,
}: {
  state: GalleryState;
  onSelect: (index: number) => void;
}): ReactNode {
  // Read here rather than take a prop: how many cards fit is this component's own business, and the
  // shell is at its line cap without holding a width for somebody else.
  const { width } = useTerminalDimensions();
  const perView = Math.max(1, Math.floor(Math.max(0, width - 2) / (CARD_W + 1)));
  const { start, end } = windowFor(state.items.length, Math.max(0, state.index), perView);
  const shown = state.items.slice(start, end);

  return (
    <box
      flexDirection="column"
      backgroundColor={theme.lift}
      borderStyle="single"
      borderColor={state.focused ? theme.teal : theme.line}
      title={state.focused ? " gallery · arrows move, enter picks, ctrl+B back " : " gallery · ctrl+B to drive "}
    >
      {state.loading ? (
        <box height={CARD_H + 1} paddingLeft={1}>
          <text fg={theme.quiet}>reading the shelf...</text>
        </box>
      ) : state.items.length === 0 ? (
        <box height={2} paddingLeft={1} flexDirection="column">
          <text fg={theme.quiet}>
            {state.withoutArt > 0
              ? `None of the ${state.withoutArt} pieces here carry card art.`
              : "Nothing on this shelf yet."}
          </text>
        </box>
      ) : (
        <box flexDirection="column">
          <box flexDirection="row" height={CARD_H}>
            {shown.map((item, offset) => {
              const at = start + offset;
              const selected = at === state.index;
              return (
                <box
                  key={item.id}
                  flexDirection="column"
                  width={CARD_W}
                  marginRight={1}
                  borderStyle={selected ? "single" : undefined}
                  borderColor={selected ? theme.teal : undefined}
                  onMouseDown={() => onSelect(at)}
                >
                  <image source={item.bytes} width={CARD_W - 2} height={CARD_H - 2} fit="fit" protocol={imageProtocol()} />
                </box>
              );
            })}
          </box>
          <box flexDirection="row" height={1} paddingLeft={1}>
            <text fg={theme.teal}>{state.items[state.index]?.name ?? ""}</text>
            <text fg={theme.quiet}>
              {`  ${Math.max(0, state.index) + 1}/${state.items.length}`}
              {state.withoutArt > 0 ? `  · ${state.withoutArt} without art` : ""}
              {state.more ? "  · more not scanned" : ""}
            </text>
          </box>
        </box>
      )}
    </box>
  );
}
