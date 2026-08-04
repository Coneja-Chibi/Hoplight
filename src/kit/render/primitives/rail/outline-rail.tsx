/** @jsxImportSource @opentui/react */
/**
 * The preset rail: the block list, in evaluation order, beside the conversation.
 *
 * WHY IT LIVES ON THE UPPER BANDS. The transcript sits on `well`, which is near-black. The rail sits
 * on `lift` and `row`, the warm violet-greys a step above it, so it reads as a lit panel beside a
 * dark stage rather than as a second transcript. Nothing new was added to the palette to get that.
 *
 * ORDER IS THE PAYLOAD, so the index column is never dropped no matter how narrow the rail gets. A
 * preset evaluates top to bottom; a block can be enabled, expand perfectly, and never be read
 * because something later overwrote what it wrote, and position is the only place that shows.
 *
 * EVERY GESTURE IS ALSO A KEY. Mouse events need a terminal that reports them and a person holding a
 * mouse, and plenty of people drive Kit over ssh or inside tmux. So drag has arrow-key nudging,
 * click has cursor movement, and the footer names the keys rather than assuming the pointer.
 *
 * NOTHING HERE WRITES. Edits accumulate in the rail's own state and go out as one draft through the
 * ordinary gate. The dirty count in the header is the whole of the feedback that something is
 * pending, which is why it is stated rather than implied by a colour.
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
import { BAR, CLOSED, MARK, OFF, ON, OPEN } from "../../glyphs";
import type { OutlineRow } from "../../../../core/preset/outline";

/** How a row is currently being changed, which decides its stripe. */
export type RowFlag = "moved" | "added" | "toggled" | null;

export interface OutlineRailProps {
  readonly title: string;
  readonly rows: readonly OutlineRow[];
  readonly selected: ReadonlySet<string>;
  /** The keyboard cursor. Separate from selection: you can move it without changing what is chosen. */
  readonly cursor: string | null;
  /** Where a drag would land, named by the row it would land above; null means the end. */
  readonly dropBefore?: string | null;
  readonly dragging?: boolean;
  /** Ids whose content is open. Expanding is per-row, so several can be open at once. */
  readonly expanded: ReadonlySet<string>;
  readonly contentOf?: (id: string) => string | undefined;
  readonly flags?: ReadonlyMap<string, RowFlag>;
  /** Edits waiting to be applied. Zero hides the badge entirely. */
  readonly pending: number;
  readonly width: number;
  /** First visible row, so a 150-block preset does not try to draw 150 rows. */
  readonly offset: number;
  readonly height: number;
  readonly onRowDown?: (id: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  readonly onRowDrag?: (id: string) => void;
  readonly onRowDragEnd?: (id: string) => void;
}

/** Enough of a name to recognise it; the rest is reachable by expanding. */
const clipName = (name: string, room: number): string =>
  name.length <= room ? name : `${name.slice(0, Math.max(1, room - 1))}…`;

const sizeLabel = (size: number): string =>
  size === 0 ? "" : size < 1000 ? String(size) : `${(size / 1000).toFixed(1)}k`;

const FLAG_TONE: Record<Exclude<RowFlag, null>, string> = {
  moved: theme.violet,
  added: theme.teal,
  toggled: theme.gold,
};

export function OutlineRail({
  title,
  rows,
  selected,
  cursor,
  dropBefore,
  dragging = false,
  expanded,
  contentOf,
  flags,
  pending,
  width,
  offset,
  height,
  onRowDown,
  onRowDrag,
  onRowDragEnd,
}: OutlineRailProps): ReactNode {
  const enabled = rows.filter((row) => row.enabled).length;
  // The index column is fixed at the widest index the preset can show, so rows never jitter as the
  // view scrolls from single to triple digits.
  const gutter = Math.max(2, String(rows.length).length);
  const visible = rows.slice(offset, offset + height);

  return (
    <box flexDirection="column" width={width} backgroundColor={theme.lift}>
      <box flexDirection="row" backgroundColor={theme.seam} paddingLeft={1} paddingRight={1}>
        <text fg={theme.soft}>{clipName(title, Math.max(8, width - 18))}</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>
          {String(enabled)}/{String(rows.length)}
        </text>
      </box>

      {pending > 0 ? (
        <box flexDirection="row" backgroundColor={theme.violetDeep} paddingLeft={1} paddingRight={1}>
          <text fg={theme.white}>
            {MARK} {String(pending)} pending
          </text>
          <box flexGrow={1} />
          <text fg={theme.white}>enter applies</text>
        </box>
      ) : null}

      <box flexDirection="column" flexGrow={1}>
        {visible.map((row) => {
          const isSelected = selected.has(row.id);
          const isCursor = cursor === row.id;
          const flag = flags?.get(row.id) ?? null;
          const isOpen = expanded.has(row.id);
          // The drop marker is drawn on the row it would land ABOVE, which is where the gap is.
          const marksDrop = dragging && dropBefore === row.id;
          const size = sizeLabel(row.size);
          const room = Math.max(6, width - gutter - size.length - 6);

          return (
            <box key={row.id} flexDirection="column">
              {marksDrop ? (
                <box flexDirection="row" backgroundColor={theme.violet}>
                  <text fg={theme.well}> </text>
                </box>
              ) : null}
              <box
                flexDirection="row"
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={
                  isSelected ? theme.violetDeep : isCursor ? theme.row : undefined
                }
                onMouseDown={(event) =>
                  onRowDown?.(row.id, {
                    shift: event.modifiers.shift === true,
                    ctrl: event.modifiers.ctrl === true,
                  })
                }
                onMouseDrag={() => onRowDrag?.(row.id)}
                onMouseDragEnd={() => onRowDragEnd?.(row.id)}
              >
                <text fg={flag ? FLAG_TONE[flag] : theme.mut}>{flag ? BAR : " "}</text>
                <text fg={theme.mut}>{String(row.index).padStart(gutter)}</text>
                <text fg={row.enabled ? theme.teal : theme.mut}> {row.enabled ? ON : OFF}</text>
                <text fg={isOpen ? theme.violet : theme.mut}>
                  {row.size > 0 ? (isOpen ? OPEN : CLOSED) : " "}
                </text>
                <text fg={isSelected ? theme.white : row.enabled ? theme.soft : theme.mut}>
                  {clipName(row.marker ? `${row.name} (slot)` : row.name, room)}
                </text>
                <box flexGrow={1} />
                <text fg={theme.mut}>{size}</text>
              </box>
              {isOpen ? (
                <box backgroundColor={theme.sunken} paddingLeft={2} paddingRight={1}>
                  <text fg={theme.soft}>{contentOf?.(row.id) ?? ""}</text>
                </box>
              ) : null}
            </box>
          );
        })}
        {dragging && dropBefore === null ? (
          <box flexDirection="row" backgroundColor={theme.violet}>
            <text fg={theme.well}> </text>
          </box>
        ) : null}
      </box>

      <box flexDirection="row" backgroundColor={theme.seam} paddingLeft={1} paddingRight={1}>
        <text fg={theme.mut}>
          {dragging ? "drop to place" : "space toggles · alt+up/down moves"}
        </text>
        <box flexGrow={1} />
        <text fg={theme.mut}>{offset + visible.length}/{String(rows.length)}</text>
      </box>
    </box>
  );
}
