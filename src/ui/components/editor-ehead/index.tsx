/**
 * EditorEhead - the shared editor header bar (spine chip + name + meta on the left, editor-specific
 * middle + Save on the right). Extracted from four hand-rolled copies (regex / persona / lorebook,
 * and now preset) that had drifted (raw --rose vs --stage-rose-well save, 12rem vs 14rem name).
 * The MIDDLE is per-editor (a WriteForStrip, a view switch + lens dropdown): passed as children.
 *
 * The name is an editable input when `onNameChange` is given (regex/persona/preset) and read-only
 * display text otherwise (lorebook edits its name elsewhere). `meta` is a ReactNode so an editor can
 * embed an inline control (the lorebook's "book rules" link).
 */
import type { JSX, ReactNode } from "react";
import s from "./styles.module.css";

export interface EditorEheadProps {
  /** the spine monogram (first letter / kind glyph) */
  mark: string;
  name: string;
  /** present => editable input; absent => read-only display */
  onNameChange?: (next: string) => void;
  namePlaceholder?: string;
  nameAriaLabel?: string;
  /** the meta line under the name; ReactNode so editors can embed inline controls */
  meta: ReactNode;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  saveTitle?: string;
  /** the editor-specific middle: lens control / view switch. */
  children?: ReactNode;
  /** the pane's top-right slot (close, split...). */
  topRight?: ReactNode;
}

export function EditorEhead({
  mark,
  name,
  onNameChange,
  namePlaceholder,
  nameAriaLabel,
  meta,
  dirty,
  saving,
  onSave,
  saveTitle = "Save · ctrl+s",
  children,
  topRight,
}: EditorEheadProps): JSX.Element {
  return (
    <header className={s.ehead}>
      <div className={s.spine}>
        <span className={s.spineMark}>{mark}</span>
        <div className={s.spineText}>
          {onNameChange ? (
            <input
              className={s.spineName}
              value={name}
              placeholder={namePlaceholder}
              aria-label={nameAriaLabel}
              onChange={(e) => onNameChange(e.target.value)}
            />
          ) : (
            <b className={s.spineName}>{name}</b>
          )}
          <span className={s.spineMeta}>{meta}</span>
        </div>
      </div>
      <span className={s.acts}>
        {children}
        <button
          type="button"
          className={s.save}
          disabled={saving || !dirty}
          onClick={onSave}
          title={saveTitle}
        >
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
        {topRight}
      </span>
    </header>
  );
}
