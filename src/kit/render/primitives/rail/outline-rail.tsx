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
import { footerKeys, keysInGroup } from "../../rail/rail-key-map";

/** The menu's sections, in the order somebody reads them. */
const MENU_GROUPS = [
  { id: "block" as const, title: "this block" },
  { id: "preset" as const, title: "this preset" },
  { id: "view" as const, title: "getting around" },
];

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
  /** Does the rail hold the keyboard? Shown, because an invisible mode is one people fight. */
  readonly focused?: boolean;
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
  /**
   * Drag the rail's own edge to resize it, in absolute terminal columns.
   *
   * The keyboard already had Ctrl+Shift+Left/Right, which is fine once you know it and invisible
   * until then. An edge you can grab is the thing everybody tries first.
   */
  readonly onResize?: (columns: number) => void;
  /** What is being typed, and into what. Absent when the rail is in its ordinary mode. */
  readonly editing?: { label: string; draft: string } | null;
  /** A rename of the preset staged but not applied, shown so it is not a silent change. */
  readonly renamedTo?: string | null;
  /** A note typed but not applied. */
  readonly noted?: string | null;
  /** Click the on/off mark to toggle that block. */
  readonly onToggle?: (id: string) => void;
  /** Click the caret to open or close a block's content. */
  readonly onExpand?: (id: string) => void;
  /** Click a name to rename it. */
  readonly onRename?: (id: string) => void;
  /** Click the size to rewrite the content. */
  readonly onRewrite?: (id: string) => void;
  /** Click the header to rename the preset. */
  readonly onRenamePreset?: () => void;
  /** What the row under the pointer would do, shown in the one footer line. */
  readonly hint?: string;
  readonly onHint?: (hint: string) => void;
  /** The full key list, opened with ?. Off by default because a permanent one is a wall. */
  readonly keysOpen?: boolean;
  /** Apply everything staged. The badge calls this, so the pointer never needs the keyboard. */
  readonly onApply?: () => void;
  /**
   * A click landed in the rail, so it should have the keyboard.
   *
   * THE FOOTER PROMISED THIS AND NOTHING DELIVERED IT. It has said "ctrl+b to drive - or just click"
   * since the pointer handlers went in, but the click side was never wired: clicking a row selected
   * it and left the keyboard in the composer, so the arrows moved the cursor in a half-typed prompt
   * instead of walking the rail. Reported as the arrow keys being dead, three times.
   */
  readonly onFocus?: () => void;
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
  focused = false,
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
  onResize,
  editing,
  renamedTo,
  noted,
  onToggle,
  onExpand,
  onRename,
  onRewrite,
  onRenamePreset,
  hint,
  onHint,
  keysOpen,
  onApply,
  onFocus,
}: OutlineRailProps): ReactNode {
  const enabled = rows.filter((row) => row.enabled).length;
  // The index column is fixed at the widest index the preset can show, so rows never jitter as the
  // view scrolls from single to triple digits.
  const gutter = Math.max(2, String(rows.length).length);
  const visible = rows.slice(offset, offset + height);

  /**
   * The footer, decided before it is drawn so it can be clipped against the count beside it.
   *
   * ONE LINE, ABOUT WHAT IS UNDER THE POINTER. This was a cheat sheet of five chords wrapped over
   * four rows, which is a wall rather than help: it says everything at once, so it says nothing when
   * you need one thing. `?` opens the full list for anybody who wants it.
   *
   * The count says whether you are seeing everything. "45/155" with no qualifier reads as a limit
   * somebody has to accept; saying "all" when it IS all is the difference between a number you have
   * to interpret and one you can trust.
   */
  const countLabel = offset + visible.length >= rows.length && offset === 0
    ? `all ${String(rows.length)}`
    : `${String(offset + visible.length)}/${String(rows.length)}`;
  const footerHint = dragging
    ? "drop to place"
    : hint
      ? `${hint}${focused ? "" : " · ctrl+b for keys"}`
      : focused
        // WITH WORK STAGED, BOTH EXITS ARE NAMED. Escape is what everybody tries first and it was
        // silent, so a rail holding one edit read as three broken keys at once.
        /**
         * FIVE THINGS YOU CAN DO, not two chords for finding out what they are.
         *
         * Straight from the key table, so the footer can never name a key that does something
         * else. It used to spend its only line on `?` and `ctrl+b` - one of which no longer
         * exists - while saying nothing about what the rail could actually do.
         */
        ? footerKeys().map((b) => `${b.label} ${b.says}`).join(" · ")
        // NAMES WHAT WORKS FROM WHERE YOU ARE: the arrows reach the rail straight from an empty
        // composer, and tab reaches in, so the first thing offered needs no setup at all.
        : "tab drives · arrows flip presets · click a row";

  /*
   * THE WRAPPER MUST STATE ITS WIDTH. Adding the drag handle put the rail inside a row box with no
   * width, so the root had nothing to reserve: the transcript column claimed the whole terminal and
   * drew straight over the rail, clipping the first characters off every line of whatever sat there.
   * flexShrink 0 for the same reason - a rail that gives ground under pressure is one that overlaps.
   */
  return (
    /*
     * ANY CLICK IN HERE TAKES THE KEYBOARD, which is what the footer has been promising all along.
     * On the outermost box so it covers the chrome as well as the rows, and the row handlers take
     * focus themselves in case a child's press does not reach this one.
     */
    <box flexDirection="row" width={width} flexShrink={0} onMouseDown={() => onFocus?.()}>
    <box flexDirection="column" width={width - 1} backgroundColor={theme.lift}>
      <box flexDirection="row" backgroundColor={focused ? theme.violetDeep : theme.seam} paddingLeft={1} paddingRight={1}>
        <box
          onMouseDown={() => onRenamePreset?.()}
          onMouseOver={() => onHint?.("click the title to rename this preset")}
        >
          <text fg={theme.soft}>{clipName(title, Math.max(8, width - 18))}</text>
        </box>
        <box flexGrow={1} />
        <text fg={theme.quiet}>
          {String(enabled)}/{String(rows.length)}
        </text>
      </box>

      {/*
        THE EDITOR IS A ROW, not a popup. It sits under the header because that is where the thing
        being renamed is, and a floating box would cover the list somebody is editing against.
      */}
      {editing ? (
        <box flexDirection="column" backgroundColor={theme.violetDeep} paddingLeft={1} paddingRight={1}>
          <text fg={theme.white}>{editing.label}</text>
          <text fg={theme.teal}>{editing.draft.length > 0 ? editing.draft : " "}</text>
          <text fg={theme.quiet}>enter keeps it · esc cancels</text>
        </box>
      ) : null}

      {renamedTo ? (
        <box flexDirection="row" backgroundColor={theme.seam} paddingLeft={1} paddingRight={1}>
          <text fg={theme.gold}>{`renaming to ${renamedTo}`}</text>
        </box>
      ) : null}
      {noted ? (
        <box flexDirection="row" backgroundColor={theme.seam} paddingLeft={1} paddingRight={1}>
          <text fg={theme.gold}>{`note: ${noted}`}</text>
        </box>
      ) : null}

      {/*
        THE BADGE IS THE APPLY BUTTON.

        Every edit can be made with the pointer now - click a mark, click a name, click the title -
        and applying was the one step that still demanded the keyboard. Worse, it demanded a
        keyboard the rail did not have: clicking works without focus, so somebody could stage a
        rename by mouse and then press Enter into the composer, where it did nothing at all.

        It says which door it is offering, because the answer differs: with the keyboard, Enter; 
        without it, this.
      */}
      {pending > 0 ? (
        <box
          flexDirection="row"
          backgroundColor={theme.violetDeep}
          paddingLeft={1}
          paddingRight={1}
          onMouseDown={() => onApply?.()}
          onMouseOver={() => onHint?.("click to review and apply these changes")}
          // CLEARS ITS OWN HINT. The badge sits outside the row list, so the list's onMouseOut never
          // fired for it: one hover here pinned "click to review and apply" into the footer for good,
          // hiding the line that names how to drop the edits from the one person who needs it.
          onMouseOut={() => onHint?.("")}
        >
          <text fg={theme.white}>
            {MARK} {String(pending)} pending
          </text>
          <box flexGrow={1} />
          {/* The badge says what the BUTTON does and nothing else; it has about a dozen cells to
              say it in at the rail's floor width. The way out is named in the footer instead. */}
          <text fg={theme.white}>{focused ? "enter applies" : "click to apply"}</text>
        </box>
      ) : null}

      {/*
        The hint clears when the pointer leaves the list. It used to stick: the last row hovered
        stayed in the footer indefinitely, which covered the line telling somebody the rail did not
        have the keyboard - so Enter did nothing and the reason was hidden behind a stale hint.
      */}
      <box flexDirection="column" flexGrow={1} onMouseOut={() => onHint?.("")}>
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
                /**
                 * CLICK SELECTS, DOUBLE-CLICK OPENS THE EDITOR - the same as every file list.
                 *
                 * The whole row is one target, so there is nothing to aim at. The on/off mark is
                 * the only thing inside it that takes a click of its own, and it says so.
                 */
                onMouseDown={(event) =>
                  onRowDown?.(row.id, {
                    shift: event.modifiers.shift === true,
                    ctrl: event.modifiers.ctrl === true,
                  })
                }
                onMouseOver={() => onHint?.("click selects · double-click edits · drag to move")}
                onMouseDrag={() => onRowDrag?.(row.id)}
                onMouseDragEnd={() => onRowDragEnd?.(row.id)}
              >
                <text fg={flag ? FLAG_TONE[flag] : theme.mut}>{flag ? BAR : " "}</text>
                <text fg={theme.mut}>{String(row.index).padStart(gutter)}</text>
                {/*
                  EVERY MARK IS ALSO A BUTTON. The rail already looked like a list of controls;
                  it simply was not one, so the only way to act on a row was to learn a key. The
                  keys all still work - this is a second door, not a replacement.
                */}
                <box
                  onMouseDown={(event: { stopPropagation: () => void }) => {
                    // Without this the row's own handler also fires and turns a toggle into a
                    // selection change, so the click would do two things at once.
                    event.stopPropagation();
                    onToggle?.(row.id);
                  }}
                  onMouseOver={() => onHint?.(row.enabled ? "click to switch this block off" : "click to switch this block on")}
                >
                  {/* Padded to three cells. A one-character click target is not a target. */}
                  <text fg={row.enabled ? theme.teal : theme.mut}>{` ${row.enabled ? ON : OFF} `}</text>
                </box>
                <box
                  onMouseDown={(event: { stopPropagation: () => void }) => {
                    event.stopPropagation();
                    onExpand?.(row.id);
                  }}
                  onMouseOver={() => onHint?.(isOpen ? "click to close this block" : "click to read this block")}
                >
                  <text fg={isOpen ? theme.violet : theme.mut}>
                    {row.size > 0 ? (isOpen ? OPEN : CLOSED) : " "}
                  </text>
                </box>
                {/*
                  THE NAME AND THE SIZE ARE NOT BUTTONS ANY MORE.

                  They were: the name renamed and the size rewrote, each stopping the click before
                  it reached the row. Four targets in one row, two of them a single character wide,
                  and the largest of them wired to the least likely thing somebody meant. Miss by
                  one column and a block switched off instead of opening.

                  Now the row is the target and it does the obvious thing. Rename lives on a key
                  and in the ? menu, where it can say which of the two renames it is.
                */}
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

      {/*
        THE MENU IS GENERATED FROM THE KEY TABLE, so it cannot describe a key the rail does not
        have. The hand-written version outlived four of the bindings it listed, including ctrl+b
        and a shift+R that had already moved.

        GROUPED BY WHAT IT ACTS ON. The two renames were one shift key apart and read as the same
        thing; under "this block" and "this preset" they read as what they are.
      */}
      {keysOpen ? (
        <box flexDirection="column" backgroundColor={theme.sunken} paddingLeft={1} paddingRight={1}>
          {MENU_GROUPS.map((group) => (
            <box key={group.id} flexDirection="column">
              <text fg={theme.teal}>{group.title}</text>
              {keysInGroup(group.id).map((binding) => (
                <text key={binding.action} fg={theme.soft}>
                  <span fg={theme.bright}>{binding.label.padEnd(16)}</span>
                  {binding.says}
                </text>
              ))}
            </box>
          ))}
        </box>
      ) : null}

      <box flexDirection="row" backgroundColor={theme.seam} paddingLeft={1} paddingRight={1}>
        {/* `quiet`, not `mut`: the palette marks mut as borders-only, and this is text. */}
        <text fg={focused ? theme.teal : theme.quiet}>
          {/*
            CLIPPED, because it shares the row with the count and used to WRAP into it: the hint ran
            onto a second line and the two collided mid-word. A footer that reflows is the "crammed
            down there" the old four-row cheat sheet was replaced for.
          */}
          {clipName(footerHint, Math.max(8, width - 4 - countLabel.length))}
        </text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>{countLabel}</text>
      </box>
    </box>
      {/*
        The grab edge. One column wide, full height, and it reports the ABSOLUTE column the pointer
        is in - the rail starts at 0, so the pointer's x IS the width being asked for. Computing a
        delta from a drag start would drift the moment a frame was missed.
      */}
      <box
        width={1}
        backgroundColor={theme.seam}
        onMouseDown={(e: { x: number }) => onResize?.(e.x + 1)}
        onMouseDrag={(e: { x: number }) => onResize?.(e.x + 1)}
      />
    </box>
  );
}
