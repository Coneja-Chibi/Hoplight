/**
 * What a CLICK does in the rail.
 *
 * The same actions the keys perform, defined once so the two doors cannot drift. A click that
 * reimplemented toggling would eventually differ from the key that toggles, and the first thing to
 * diverge would be something small and maddening like whether it also moves the cursor.
 *
 * Every handler reads its inputs through REFS. They are memoised so the rows do not rebuild on each
 * keystroke, which means a captured value would be whatever was true when the callback was last
 * built - the same staleness that once made a commit write to whichever preset had been open when
 * its callback was memoised.
 */
import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { OutlineRow } from "../../../core/preset/outline";
import { noClicks, registerClick } from "./double-click";
import { clickRow, setEnabled, type RailState } from "../../../core/preset/rail-edit";
import type { RailEditor } from "./use-rail-editor";

export interface RailActionDeps {
  editor: RailEditor;
  setCursor: Dispatch<SetStateAction<string | null>>;
  setState: Dispatch<SetStateAction<RailState>>;
  setExpanded: Dispatch<SetStateAction<ReadonlySet<string>>>;
  setKeysOpen: Dispatch<SetStateAction<boolean>>;
  /** Clicking a control is reaching into the rail, so it takes the keyboard with it. */
  setFocused: Dispatch<SetStateAction<boolean>>;
  stateRef: MutableRefObject<RailState>;
  contentRef: MutableRefObject<ReadonlyMap<string, string>>;
  titleRef: MutableRefObject<string>;
  nameRef: MutableRefObject<string | null>;
  noteRef: MutableRefObject<string | null>;
  /** Open the full editor card on a block body. Absent falls back to the rail one-line box. */
  onEditBlock?: (blockId: string, title: string, text: string) => void;
}

/**
 * Every dependency is listed, and every one of them is stable: useState setters and refs never
 * change identity. Listing them costs nothing at runtime and means a future edit that reaches for
 * something which ISN'T stable gets caught here, rather than by somebody wondering why a click
 * acted on state from three renders ago.
 */
export function useRailActions(deps: RailActionDeps) {
  const { editor, setCursor, setState, setExpanded, setKeysOpen, setFocused, onEditBlock } = deps;
  const { stateRef, contentRef, titleRef, nameRef, noteRef } = deps;
  const toggleRow = useCallback((id: string) => {
    setFocused(true);
    setCursor(id);
    setState((current: RailState) => setEnabled(clickRow(current, id), "toggle"));
  }, [setCursor, setState, setFocused]);

  const expandRow = useCallback((id: string) => {
    setFocused(true);
    setCursor(id);
    setExpanded((current: ReadonlySet<string>) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setCursor, setExpanded, setFocused]);

  const renameRow = useCallback((id: string) => {
    setFocused(true);
    setCursor(id);
    const row = stateRef.current.rows.find((candidate: OutlineRow) => candidate.id === id);
    editor.open({ kind: "block-name", id }, row?.editedName ?? row?.name ?? "");
  }, [editor, setCursor, stateRef, setFocused]);

  /**
   * THE ONLY WAY A BODY GETS EDITED, so the key, the double-click and the menu cannot drift apart.
   *
   * It opens the CARD when one is wired: the rail own editor holds a single string and Enter commits
   * it, so a paragraph break is not a character it can hold. The fallback keeps this file standing on
   * its own in a test harness with no card.
   */
  const rewriteRow = useCallback((id: string) => {
    setFocused(true);
    setCursor(id);
    const row = stateRef.current.rows.find((candidate: OutlineRow) => candidate.id === id);
    const body = row?.editedContent ?? contentRef.current.get(id) ?? "";
    if (onEditBlock) onEditBlock(id, row?.editedName ?? row?.name ?? id, body);
    else editor.open({ kind: "block-content", id }, body);
  }, [editor, setCursor, stateRef, contentRef, setFocused, onEditBlock]);

  /**
   * Stage a new body for one block, from the full editor card.
   *
   * Lands on the ROW exactly where the one-line box used to put it, so the pending count, the
   * review and the Gate are all unchanged by the card existing.
   */
  const setBlockText = useCallback((blockId: string, text: string) => {
    setState((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === blockId ? { ...row, editedContent: text } : row)),
    }));
  }, [setState]);

  /**
   * CLICK SELECTS, DOUBLE-CLICK OPENS THE EDITOR, the same as every file list.
   *
   * Clicking also gives the rail the keyboard: Enter belongs to whoever has focus, so a rename
   * staged by clicking used to go to the composer and vanish.
   *
   * A MODIFIED CLICK IS NEVER A DOUBLE. Shift and ctrl are how a selection is built, and turning the
   * second of those into an editor would take the screen mid-multi-select.
   */
  const clicks = useRef(noClicks());
  const onRowDown = useCallback((id: string, modifiers: { shift: boolean; ctrl: boolean }) => {
    setFocused(true);
    setCursor(id);
    setState((current) => clickRow(current, id, modifiers));
    if (modifiers.shift || modifiers.ctrl) { clicks.current = noClicks(); return; }
    const result = registerClick(clicks.current, id, Date.now());
    clicks.current = result.memory;
    if (result.double) rewriteRow(id);
  }, [rewriteRow, setCursor, setFocused, setState]);

  const renamePreset = useCallback(() => {
    setFocused(true);
    editor.open({ kind: "preset-name" }, nameRef.current ?? titleRef.current);
  }, [editor, nameRef, titleRef, setFocused]);

  const noteOn = useCallback(() => {
    setFocused(true);
    editor.open({ kind: "note" }, noteRef.current ?? "");
  }, [editor, noteRef, setFocused]);

  const toggleKeys = useCallback(() => setKeysOpen((on) => !on), [setKeysOpen]);

  return { toggleRow, expandRow, renameRow, rewriteRow, renamePreset, noteOn, toggleKeys, setBlockText, onRowDown };
}
