/**
 * The rail's state and its keys, kept out of the shell.
 *
 * WHY A HOOK AND NOT MORE OF app.tsx. The shell sits at its 500-line cap, so a feature that cannot
 * be added without pushing a file past its limit is a feature that wants its own home. The rail's
 * state and keys live here; the decisions worth testing without a terminal live beside it, in
 * step-key, next-preset, rail-escape, rail-pending and rail-typing.
 *
 * THE EDITS ARE LOCAL UNTIL THEY ARE APPLIED. Dragging, toggling and inserting change this state and
 * nothing else. `pending` counts what is waiting, `commit` hands the edited rows to whoever writes
 * them, and until that happens the studio is untouched. That is what lets a drag be instant and a
 * write still be gated: one confirmation for a session of rearranging, rather than one per gesture
 * or none at all.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useRailEditor, type RailEditor } from "./use-rail-editor";
import { useRailActions } from "./use-rail-actions";
import { applyTypedEdit, typeIntoEditor } from "./rail-typing";
import { useRailApply } from "./use-rail-apply";
import { stepDelta } from "./step-key";
import { railAction } from "./rail-key-map";
import { railDirty, railPending } from "./rail-pending";
import { RAIL_RESIZE_STEP, useRailGeometry } from "./use-rail-geometry";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { diffOutline, type OutlineRow } from "../../../core/preset/outline";
import {
  clickRow, moveSelection, nudgeSelection, railState,
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
  /** Does the rail have the keyboard? False means every key belongs to the composer. */
  readonly focused: boolean;
  readonly dragging: boolean;
  readonly dropBefore: string | null;
  readonly flags: ReadonlyMap<string, RowFlag>;
  readonly pending: number;
  readonly offset: number;
  /** The rail's width in cells, resized with Ctrl+Shift+Left/Right. */
  readonly width: number;
  /** Set the width outright, for the draggable edge. Bounded the same way the keys are. */
  readonly resizeTo: (columns: number) => void;
  /** True = fit as many rows as possible; false = roomy rows. Toggled with Ctrl+Shift+D. */
  readonly dense: boolean;
  /** What is being typed into, and the text so far. Null when the rail is in its ordinary mode. */
  readonly editor: RailEditor;
  /** A rename of the preset itself, staged but not applied. */
  readonly pendingName: string | null;
  /** A note typed but not applied. */
  readonly pendingNote: string | null;
  /** Start following a preset. Replaces anything already open, discarding unapplied edits. */
  follow: (
    id: string,
    title: string,
    rows: readonly OutlineRow[],
    content?: ReadonlyMap<string, string>,
  ) => void;
  close: () => void;
  onRowDown: (id: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  onRowDrag: (id: string) => void;
  onRowDragEnd: (id: string) => void;
  /**
   * The same things the keys do, for a pointer.
   *
   * ONE IMPLEMENTATION, TWO DOORS. A click that reimplemented toggling would drift from the key
   * that toggles, and the first thing to diverge would be whether it moves the cursor.
   */
  toggleRow: (id: string) => void;
  expandRow: (id: string) => void;
  renameRow: (id: string) => void;
  rewriteRow: (id: string) => void;
  renamePreset: () => void;
  /** Ask to leave a note. */
  noteOn: () => void;
  /** The full key list, opened with ? and closed the same way. */
  readonly keysOpen: boolean;
  toggleKeys: () => void;
  /** Apply everything staged. Called by Enter and by the pending badge. */
  applyNow: () => void;
  /** Hand the rail the keyboard, for a pointer that has just reached into it. */
  takeFocus: () => void;
  /** Stage a new body for one block, from the full editor. Staged, never written. */
  setBlockText: (blockId: string, text: string) => void;
  /** Give the keyboard back, for a click that landed anywhere else. The other half of focus. */
  releaseFocus: () => void;
}

/** How many rows the rail can draw before it needs to scroll. Passed in by the shell. */
export function useRail(
  rowsVisible: () => number,
  /** Writes the rows and reports the id it wrote to, which a foreign edit changes. Null on failure. */
  onCommit?: (
    rows: readonly OutlineRow[],
    meta?: { name?: string; note?: string },
  ) => Promise<string | null>,

  /** Thumb to the next (+1) or previous (-1) preset. Owned by useRailSession, which knows storage. */
  onStep?: (delta: number) => void,

  /** Say something in the transcript. Optional so the rail still mounts in a test harness. */
  say?: (text: string) => void,

  /** Open the full editor on a block body. Absent falls back to the rail own one-line box. */
  onEditBlock?: (blockId: string, title: string, text: string) => void,

  /** Is the full editor card up? While it is, the rail touches nothing. */
  editorOpen?: boolean,
): RailSession {
  const [open, setOpen] = useState(false);
  // Read inside `follow` to tell an OPEN from a RE-POINT; state there would be the stale value.
  const openRef = useRef(open);
  openRef.current = open;
  const [title, setTitle] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [state, setState] = useState<RailState>(() => railState([]));
  const [cursor, setCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Escape has been pressed once against a dirty rail, so the next one drops the edits. */
  const [armedDrop, setArmedDrop] = useState(false);
  const [dropBefore, setDropBefore] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  // Width and density belong to the person, not the layout; see use-rail-geometry.ts.
  const { width, widen, resizeTo, dense, toggleDense } = useRailGeometry();
  // The rows as last read from storage; everything "pending" is measured against this. STATE, not a
  // ref: as a ref it mutated without re-rendering, so the badge read "3 pending" forever and
  // rail_open then refused to open anything for the rest of the run.
  const [baseline, setBaseline] = useState<readonly OutlineRow[]>([]);
  const editor = useRailEditor();
  // Destructured because the EDITOR OBJECT is rebuilt every render while its callbacks are stable:
  // depending on the object would rebuild follow on every keystroke, and depending on nothing is the
  // stale-capture that made the commit callback write to whichever preset was last open.
  const cancelEdit = editor.cancel;
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  /**
   * The block text as last read, for seeding the rewrite editor.
   *
   * Seeded with what is there rather than blank, because rewriting is usually fixing one line of
   * something long, and an empty box would ask somebody to retype a whole system prompt.
   */
  const [content, setContent] = useState<ReadonlyMap<string, string>>(new Map());

  // Read at CLICK time, not captured: the pointer handlers are memoised so the rows do not rebuild
  // on every keystroke, and a captured value would be whatever was true when they were last built.
  const stateRef = useRef(state);
  stateRef.current = state;
  const contentRef = useRef(content);
  contentRef.current = content;
  const titleRef = useRef(title);
  titleRef.current = title;
  const nameRef = useRef(pendingName);
  nameRef.current = pendingName;
  const noteRef = useRef(pendingNote);
  noteRef.current = pendingNote;

  // One answer for the badge, the Enter key and the step keys; see rail-pending.ts.
  const meta = useMemo(() => ({ name: pendingName, note: pendingNote }), [pendingName, pendingNote]);
  const dirty = railDirty(baseline, state.rows, meta);
  const pending = useMemo(
    () => railPending(baseline, state.rows, meta),
    [baseline, state.rows, meta],
  );

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

  const follow = useCallback((
    id: string,
    next: string,
    rows: readonly OutlineRow[],
    blockText?: ReadonlyMap<string, string>,
  ) => {
    setBaseline(rows);
    setContent(blockText ?? new Map());
    // Following a different preset drops every typed edit with it: they belonged to the one being
    // left, and carrying them across would apply somebody's rename to the wrong piece.
    setPendingName(null);
    setPendingNote(null);
    cancelEdit();
    setPresetId(id);
    setTitle(next);
    setState(railState(rows));
    setCursor(rows[0]?.id ?? null);
    setExpanded(new Set());
    setOffset(0);
    setOpen(true);
    // KEEPS THE KEYBOARD IF IT ALREADY HAD IT. Opening a CLOSED rail does not steal focus, because
    // that call can come from the model mid-turn and a pane appearing should not take somebody's
    // keys. But every step through the shelf re-follows, and blurring unconditionally meant the
    // arrows worked exactly once and then went dead until you clicked the rail again.
    setFocused((had) => (openRef.current ? had : false));
  }, [cancelEdit]);

  const takeFocus = useCallback(() => setFocused(true), []);
  // The OTHER HALF of click-to-focus: clicking the box you type in used to do nothing at all.
  const releaseFocus = useCallback(() => setFocused(false), []);

  const applyNow = useRailApply({
    dirty, rows: state.rows, pendingName, pendingNote,
    setBaseline, setState, setTitle, setPendingName, setPendingNote, setPresetId,
    ...(onCommit ? { onCommit } : {}),
  });

  const close = useCallback(() => { setOpen(false); setFocused(false); }, []);

  const {
    toggleRow, expandRow, renameRow, rewriteRow, renamePreset, noteOn, toggleKeys, setBlockText, onRowDown,
  } = useRailActions({
    editor, setCursor, setState, setExpanded, setKeysOpen, setFocused,
    ...(onEditBlock ? { onEditBlock } : {}),
    stateRef, contentRef, titleRef, nameRef, noteRef,
  });

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

    /**
     * WHILE THE EDITOR IS OPEN IT OWNS EVERY KEY.
     *
     * First, and returning unconditionally, because anything else would let a letter typed into a
     * name also toggle a block. That is the rail-ate-the-composer failure in miniature and it is
     * avoided the same way: one owner at a time, decided before anything else looks.
     */
    // While the editor is open it owns every key; see rail-typing.ts.
    if (editor.target) {
      event.preventDefault();
      const typed = typeIntoEditor(editor, event);
      if (typed) {
        applyTypedEdit(typed, { setPendingName, setPendingNote, setState }, {
          presetName: title,
          blockName: (rowId) => state.rows.find((row) => row.id === rowId)?.name,
          blockContent: (rowId) => content.get(rowId),
        });
      }
      return;
    }

    /**
     * WITHOUT THIS THE RAIL EATS THE COMPOSER. Every branch below prevents its key, and opentui
     * stops dispatching a prevented key to the focused renderable - so an open rail swallowed
     * space, backspace, enter and the arrows while somebody typed a prompt, AND toggled blocks on
     * a real preset as they did it. Returning before preventDefault is the whole fix.
     */
    if (!focused) return;
    // The editor card takes every key while it is up; a keystroke meant for a paragraph reaching
    // here would toggle a block behind it.
    if (editorOpen) return;

    /**
     * ONE TABLE, ONE MEANING PER KEY; see rail-key-map.ts.
     *
     * This was an eighteen-branch if-chain grown one key at a time, and the contradictions only
     * showed up in use: Enter opened a row or wrote to disk depending on hidden state, Escape meant
     * three things, Tab duplicated Enter, and two renames sat one shift key apart. As a table those
     * are questions a test can answer by reading it, which is what now stops them coming back.
     */
    const action = railAction(event);
    if (action === null) return;
    event.preventDefault();

    switch (action) {
      case "focus-next":
        // Tab, because that is what Tab means. It replaced ctrl+b, which nothing could teach you.
        setFocused(false);
        return;
      case "cursor-up": move(-1); return;
      case "cursor-down": move(1); return;
      case "extend-up":
      case "extend-down": {
        const delta = action === "extend-up" ? -1 : 1;
        move(delta);
        if (cursor) setState((current) => clickRow(current, cursor, { shift: true }));
        return;
      }
      case "move-up": setState((current) => nudgeSelection(current, -1)); return;
      case "move-down": setState((current) => nudgeSelection(current, 1)); return;
      case "step-prev": onStep?.(-1); return;
      case "step-next": onStep?.(1); return;
      case "open-row": if (cursor) expandRow(cursor); return;
      case "edit-body":
        // One implementation, three doors: this key, a double-click, and the menu all land here.
        if (cursor) rewriteRow(cursor);
        return;
      case "rename-block": if (cursor) renameRow(cursor); return;
      case "rename-preset": renamePreset(); return;
      case "note": noteOn(); return;
      case "toggle":
        if (!cursor) return;
        setState((current) => setEnabled(
          current.selected.size > 0 ? current : clickRow(current, cursor),
          "toggle",
        ));
        return;
      case "remove":
        setState((current) => {
          const next = removeSelection(current);
          // A view scrolled past the new end draws nothing while the footer keeps counting.
          setOffset((top) => Math.max(0, Math.min(top, next.rows.length - 1)));
          return next;
        });
        return;
      case "select-all": setState(selectAll); return;
      case "save":
        // Its own key now, whatever is pending. It used to be Enter, which also opened a row.
        if (dirty) applyNow();
        else say?.("Nothing staged to save.");
        return;
      case "drop-edits": {
        if (!dirty) return;
        setState(railState(baseline));
        setPendingName(null);
        setPendingNote(null);
        // Dropping inserted rows shortens the list, so a view or a cursor past the new end would
        // draw a blank rail while the footer still counted.
        setOffset((top) => Math.max(0, Math.min(top, baseline.length - 1)));
        setCursor((at) => (at !== null && baseline.some((row) => row.id === at) ? at : baseline[0]?.id ?? null));
        say?.("Dropped the rail's unsaved changes.");
        return;
      }
      case "wider": widen(RAIL_RESIZE_STEP); return;
      case "narrower": widen(-RAIL_RESIZE_STEP); return;
      case "density": toggleDense(); return;
      case "menu": toggleKeys(); return;
      case "close":
        // ONE MEANING. It cleared a selection, or armed a drop, or dropped - and the third threw
        // work away. Dropping is ctrl+z now, named, where it can be read before it is chosen.
        if (state.selected.size > 0) setState(selectNone);
        else if (keysOpen) toggleKeys();
        else if (!dirty) close();
        else say?.(`${String(pending)} staged change${pending === 1 ? "" : "s"}. s saves, ctrl+z throws away.`);
        return;
    }
  });


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
    width, dense, resizeTo, editor, pendingName, pendingNote,
    toggleRow, expandRow, renameRow, rewriteRow, renamePreset, noteOn, keysOpen, toggleKeys, applyNow,
    takeFocus, releaseFocus, setBlockText,
    follow, close, onRowDown, onRowDrag, onRowDragEnd,
  };
}
