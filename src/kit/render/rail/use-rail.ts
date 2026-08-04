/**
 * The rail's state and its keys, kept out of the shell.
 *
 * WHY A HOOK AND NOT MORE OF app.tsx. The shell sits at its 500-line cap, so a feature that cannot be added
 * without pushing a file past its limit is a feature that wants its own home. Every
 * decision the rail makes lives here; the shell learns four things about it.
 *
 * THE EDITS ARE LOCAL UNTIL THEY ARE APPLIED. Dragging, toggling and inserting change this state and
 * nothing else. `pending` counts what is waiting, `commit` hands the edited rows to whoever writes
 * them, and until that happens the studio is untouched. That is what lets a drag be instant and a
 * write still be gated: one confirmation for a session of rearranging, rather than one per gesture
 * or none at all.
 */
import { useCallback, useMemo, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { diffOutline, type OutlineRow } from "../../../core/preset/outline";
import {
  clickRow, moveSelection, nudgeSelection, railIsDirty, railState,
  removeSelection, selectAll, selectNone, setEnabled, type RailState,
} from "../../../core/preset/rail-edit";
import type { RowFlag } from "../primitives/rail/outline-rail";

/**
 * Rail geometry bounds. Below the floor a block name is unreadable; above the ceiling the rail is
 * wider than the transcript beside it. Two cells per press, so a resize is felt without being coarse.
 */
const MIN_RAIL_WIDTH = 24;
const MAX_RAIL_WIDTH = 72;
const DEFAULT_RAIL_WIDTH = 38;

export interface RailSession {
  readonly open: boolean;
  readonly title: string;
  /** The studio id being followed, which the commit path writes to. */
  readonly presetId: string | null;
  readonly state: RailState;
  readonly cursor: string | null;
  readonly expanded: ReadonlySet<string>;
  /** Does the rail have the keyboard? False means every key belongs to the composer. */
  readonly focused: boolean;
  readonly dragging: boolean;
  readonly dropBefore: string | null;
  readonly flags: ReadonlyMap<string, RowFlag>;
  readonly pending: number;
  readonly offset: number;
  /** The rail's width in cells, resized with Ctrl+Shift+Left/Right. */
  readonly width: number;
  /** True = fit as many rows as possible; false = roomy rows. Toggled with Ctrl+Shift+D. */
  readonly dense: boolean;
  /** Start following a preset. Replaces anything already open, discarding unapplied edits. */
  follow: (id: string, title: string, rows: readonly OutlineRow[]) => void;
  close: () => void;
  onRowDown: (id: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  onRowDrag: (id: string) => void;
  onRowDragEnd: (id: string) => void;
}

/** How many rows the rail can draw before it needs to scroll. Passed in by the shell. */
export function useRail(
  rowsVisible: () => number,
  onCommit?: (rows: readonly OutlineRow[]) => Promise<boolean>,
  /** Thumb to the next (+1) or previous (-1) preset. Owned by useRailSession, which knows storage. */
  onStep?: (delta: number) => void,
): RailSession {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [state, setState] = useState<RailState>(() => railState([]));
  const [cursor, setCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dropBefore, setDropBefore] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  /**
   * The rail's own width and row density, held here because they belong to the person rather than to
   * the layout. The floor and ceiling are real constraints, not taste: below the floor a block name
   * is unreadable, and above the ceiling the rail is wider than the transcript it sits beside.
   */
  const [width, setWidth] = useState(DEFAULT_RAIL_WIDTH);
  const [dense, setDense] = useState(false);
  /**
   * The rows as last read from storage. Everything "pending" is measured against this.
   *
   * STATE, NOT A REF, and that distinction was a real bug. As a ref, adopting the written rows after
   * a commit mutated it without re-rendering, so  - memoised on [state.rows], which the
   * commit does not change - kept its old count forever. The badge read "3 pending" over a preset
   * with nothing pending, and because rail_open refuses to steal the rail while edits are pending,
   * Kit silently lost the ability to open a preset for the rest of the session.
   */
  const [baseline, setBaseline] = useState<readonly OutlineRow[]>([]);

  const dirty = railIsDirty(baseline, state.rows);
  const pending = useMemo(() => {
    const diff = diffOutline(baseline, state.rows);
    return diff ? diff.changes.length : 0;
  }, [baseline, state.rows]);

  const flags = useMemo(() => {
    const map = new Map<string, RowFlag>();
    const diff = diffOutline(baseline, state.rows);
    for (const change of diff?.changes ?? []) {
      map.set(
        change.id,
        change.kind === "moved" ? "moved"
          : change.kind === "added" ? "added"
            : change.kind === "enabled" || change.kind === "disabled" ? "toggled"
              : null,
      );
    }
    return map;
  }, [baseline, state.rows]);

  const follow = useCallback((id: string, next: string, rows: readonly OutlineRow[]) => {
    setBaseline(rows);
    setPresetId(id);
    setTitle(next);
    setState(railState(rows));
    setCursor(rows[0]?.id ?? null);
    setExpanded(new Set());
    setOffset(0);
    setOpen(true);
    // Opening does not steal the keyboard. Somebody who typed /rail is still mid-sentence.
    setFocused(false);
  }, []);

  const close = useCallback(() => { setOpen(false); setFocused(false); }, []);

  const move = useCallback((delta: number) => {
    setCursor((current) => {
      const rows = state.rows;
      if (rows.length === 0) return null;
      const at = rows.findIndex((row) => row.id === current);
      const next = Math.min(rows.length - 1, Math.max(0, (at < 0 ? 0 : at) + delta));
      const row = rows[next]!;
      // Keep the cursor on screen without re-centring, which is disorienting in a long list.
      setOffset((top) => {
        const window = Math.max(1, rowsVisible());
        if (next < top) return next;
        if (next >= top + window) return next - window + 1;
        return top;
      });
      return row.id;
    });
  }, [state.rows, rowsVisible]);

  useKeyboard((event: KeyEvent) => {
    if (!open) return;
    const key = event.name;
    const shift = event.shift === true;

    // Ctrl+B hands the keyboard back and forth. It is the only key this handler claims while the
    // composer has focus, and the composer does not use it.
    if (key === "b" && event.ctrl === true) {
      event.preventDefault();
      setFocused((on) => !on);
      return;
    }

    // WITHOUT THIS THE RAIL EATS THE COMPOSER. Every branch below calls preventDefault, and opentui
    // stops dispatching a prevented key to the focused renderable - so an open rail swallowed space,
    // backspace, enter and the arrows while somebody was typing a prompt, AND silently toggled
    // blocks on a real preset as they typed. Returning before preventDefault is the whole fix.
    if (!focused) return;

    /**
     * The rail's SHAPE is the person's, not the layout's.
     *
     * Two complaints, one cause: the rail could not be resized, and it showed 45 of 155 rows with no
     * way to see the rest. Both were the geometry being decided for them. Ctrl+Shift+Left/Right
     * resizes; Ctrl+Shift+D switches between roomy rows and fitting every row it can.
     *
     * Named keys rather than letters, so shift survives the chord (a bare printable key drops it),
     * and both stay clear of the readline set the composer owns.
     */
    if (shift && event.ctrl === true && (key === "left" || key === "right")) {
      event.preventDefault();
      setWidth((w) => Math.max(MIN_RAIL_WIDTH, Math.min(MAX_RAIL_WIDTH, w + (key === "left" ? -2 : 2))));
      return;
    }
    if (shift && event.ctrl === true && key === "d") {
      event.preventDefault();
      setDense((on) => !on);
      return;
    }

    /**
     * `<` and `>` thumb through the shelf.
     *
     * Matched on the SEQUENCE rather than the key name, because these are shifted characters: the
     * name arrives as "," and "." with shift held, and binding those would fire on an unshifted
     * comma somebody typed. The character is what a person actually pressed.
     *
     * The step itself lives in useRailSession, which is the half that knows about storage; this hook
     * stays free of it, which is what keeps its editing logic testable without a studio.
     */
    if (event.sequence === "<" || event.sequence === ">") {
      event.preventDefault();
      onStep?.(event.sequence === ">" ? 1 : -1);
      return;
    }

    if (key === "up" || key === "down") {
      event.preventDefault();
      const delta = key === "up" ? -1 : 1;
      // Alt moves the blocks; plain moves the cursor. Shift extends the selection as it goes.
      if (event.option === true || event.meta === true) {
        setState((current) => nudgeSelection(current, delta));
        return;
      }
      move(delta);
      if (shift && cursor) setState((current) => clickRow(current, cursor, { shift: true }));
      return;
    }
    if (key === "space" && cursor) {
      event.preventDefault();
      setState((current) => setEnabled(
        current.selected.size > 0 ? current : clickRow(current, cursor),
        "toggle",
      ));
      return;
    }
    if (key === "return" && dirty) {
      event.preventDefault();
      // .catch is not optional here: a throw out of stage or commit had nowhere to go, and opentui
      // routes an unhandled rejection into a hidden debug overlay, so the failure was invisible.
      void onCommit?.(state.rows).catch(() => false).then((applied) => {
        // Adopting the written rows is what clears the pending badge. Doing it only on a real
        // applied receipt means a denied or stale attempt leaves the edits exactly where they were.
        if (applied) setBaseline(state.rows);
      });
      return;
    }
    if (key === "a" && event.ctrl === true) {
      event.preventDefault();
      setState(selectAll);
      return;
    }
    if (key === "escape") {
      event.preventDefault();
      // Escape clears a selection first and only closes an idle rail, so it cannot throw away a
      // session of rearranging with one keystroke.
      if (state.selected.size > 0) setState(selectNone);
      else if (!dirty) close();
      return;
    }
    if (key === "delete" || key === "backspace") {
      event.preventDefault();
      setState((current) => {
        const next = removeSelection(current);
        // Deleting the rows the view was sitting on leaves offset past the end, and the rail draws
        // nothing at all while the footer still counts. Pull it back to the last full window.
        setOffset((top) => Math.max(0, Math.min(top, next.rows.length - 1)));
        return next;
      });
      return;
    }
    if ((key === "right" || key === "left") && cursor) {
      event.preventDefault();
      setExpanded((current) => {
        const next = new Set(current);
        if (key === "right") next.add(cursor);
        else next.delete(cursor);
        return next;
      });
    }
  });

  const onRowDown = useCallback((id: string, modifiers: { shift: boolean; ctrl: boolean }) => {
    setCursor(id);
    setState((current) => clickRow(current, id, modifiers));
  }, []);

  const onRowDrag = useCallback((id: string) => {
    setDragging(true);
    setDropBefore(id);
  }, []);

  const onRowDragEnd = useCallback((id: string) => {
    setDragging(false);
    setDropBefore(null);
    setState((current) => moveSelection(current, id));
  }, []);

  return {
    open, title, presetId, state, cursor, expanded, focused, dragging, dropBefore, flags, pending, offset,
    width, dense,
    follow, close, onRowDown, onRowDrag, onRowDragEnd,
  };
}
