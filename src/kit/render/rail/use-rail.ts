/**
 * The rail's state and its keys, kept out of the shell.
 *
 * WHY A HOOK AND NOT MORE OF app.tsx. The shell is nine lines under its cap, and a feature that
 * cannot be added without pushing a file past its limit is a feature that wants its own home. Every
 * decision the rail makes lives here; the shell learns four things about it.
 *
 * THE EDITS ARE LOCAL UNTIL THEY ARE APPLIED. Dragging, toggling and inserting change this state and
 * nothing else. `pending` counts what is waiting, `commit` hands the edited rows to whoever writes
 * them, and until that happens the studio is untouched. That is what lets a drag be instant and a
 * write still be gated: one confirmation for a session of rearranging, rather than one per gesture
 * or none at all.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { diffOutline, type OutlineRow } from "../../../core/preset/outline";
import {
  clickRow, moveSelection, nudgeSelection, railIsDirty, railState,
  removeSelection, selectAll, selectNone, setEnabled, type RailState,
} from "../../../core/preset/rail-edit";
import type { RowFlag } from "../primitives/rail/outline-rail";

export interface RailSession {
  readonly open: boolean;
  readonly title: string;
  /** The studio id being followed, which the commit path writes to. */
  readonly presetId: string | null;
  readonly state: RailState;
  readonly cursor: string | null;
  readonly expanded: ReadonlySet<string>;
  readonly dragging: boolean;
  readonly dropBefore: string | null;
  readonly flags: ReadonlyMap<string, RowFlag>;
  readonly pending: number;
  readonly offset: number;
  /** Start following a preset. Replaces anything already open, discarding unapplied edits. */
  follow: (id: string, title: string, rows: readonly OutlineRow[]) => void;
  close: () => void;
  /** A fresh reading from the watcher. Ignored while there are unapplied edits, see below. */
  observe: (rows: readonly OutlineRow[]) => void;
  onRowDown: (id: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  onRowDrag: (id: string) => void;
  onRowDragEnd: (id: string) => void;
}

/** How many rows the rail can draw before it needs to scroll. Passed in by the shell. */
export function useRail(
  rowsVisible: () => number,
  onCommit?: (rows: readonly OutlineRow[]) => Promise<boolean>,
): RailSession {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [state, setState] = useState<RailState>(() => railState([]));
  const [cursor, setCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [dropBefore, setDropBefore] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  /** The rows as last read from storage. Everything "pending" is measured against this. */
  const baseline = useRef<readonly OutlineRow[]>([]);

  const dirty = railIsDirty(baseline.current, state.rows);
  const pending = useMemo(() => {
    const diff = diffOutline(baseline.current, state.rows);
    return diff ? diff.changes.length : 0;
  }, [state.rows]);

  const flags = useMemo(() => {
    const map = new Map<string, RowFlag>();
    const diff = diffOutline(baseline.current, state.rows);
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
  }, [state.rows]);

  const follow = useCallback((id: string, next: string, rows: readonly OutlineRow[]) => {
    baseline.current = rows;
    setPresetId(id);
    setTitle(next);
    setState(railState(rows));
    setCursor(rows[0]?.id ?? null);
    setExpanded(new Set());
    setOffset(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  /**
   * A fresh reading from the watcher.
   *
   * DROPPED WHILE THERE ARE UNAPPLIED EDITS, deliberately. Kit saving a change would otherwise
   * overwrite a rearrangement somebody is halfway through, and the work would vanish with no event
   * to point at. Holding the local view means the two can disagree for a moment, which is visible
   * and recoverable, rather than one silently winning.
   */
  const observe = useCallback((rows: readonly OutlineRow[]) => {
    if (railIsDirty(baseline.current, rows) && dirty) return;
    baseline.current = rows;
    setState((current) => ({ ...current, rows }));
  }, [dirty]);

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
      void onCommit?.(state.rows).then((applied) => {
        // Adopting the written rows is what clears the pending badge. Doing it only on a real
        // applied receipt means a denied or stale attempt leaves the edits exactly where they were.
        if (applied) baseline.current = state.rows;
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
      setState(removeSelection);
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
    open, title, presetId, state, cursor, expanded, dragging, dropBefore, flags, pending, offset,
    follow, close, observe, onRowDown, onRowDrag, onRowDragEnd,
  };
}
