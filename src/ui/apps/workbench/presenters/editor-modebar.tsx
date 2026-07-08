/**
 * EditorModeBar - the header's view toggles, lifted from Editor.tsx: the field-layout switch (Bento |
 * Playbill), the field-mode switch (Grid | Steps), and the Fields | Workshop switch that opens the
 * behavior workspace beside the fields. Layout + mode are onboarding-taught preferences that retire to
 * Settings once the tour is done; the Fields | Workshop pair shows whenever the card carries behavior.
 * Pure toggles over injected state.
 */
import type { JSX } from "react";

type Styles = Readonly<Record<string, string>>;

export interface EditorModeBarProps {
  onboarded: boolean;
  mode: "grid" | "interview";
  setMode(m: "grid" | "interview"): void;
  editorLayout: "bento" | "playbill";
  setEditorLayout(l: "bento" | "playbill"): void;
  /** the card carries scripts, so the workspace is offered */
  hasBehavior: boolean;
  workshop: boolean;
  setWorkshop(on: boolean): void;
  styles: Styles;
}

export function EditorModeBar(props: EditorModeBarProps): JSX.Element {
  const { onboarded, mode, setMode, editorLayout, setEditorLayout, hasBehavior, workshop, setWorkshop, styles } = props;
  return (
    <>
      {!onboarded && mode === "grid" && (
        <span className={styles.seg} data-tour="layout">
          <button type="button" className={editorLayout === "bento" ? styles.on : undefined} onClick={() => setEditorLayout("bento")}>
            Bento
          </button>
          <button type="button" className={editorLayout === "playbill" ? styles.on : undefined} onClick={() => setEditorLayout("playbill")}>
            Playbill
          </button>
        </span>
      )}
      {!onboarded && (
        <span className={styles.seg} data-tour="mode">
          <button type="button" className={mode === "grid" ? styles.on : undefined} onClick={() => setMode("grid")}>
            Grid
          </button>
          <button type="button" className={mode === "interview" ? styles.on : undefined} onClick={() => setMode("interview")}>
            Steps
          </button>
        </span>
      )}
      {hasBehavior && (
        <span className={styles.seg}>
          <button type="button" className={!workshop ? styles.on : undefined} onClick={() => setWorkshop(false)}>
            Fields
          </button>
          <button type="button" className={workshop ? styles.on : undefined} onClick={() => setWorkshop(true)}>
            Workshop
          </button>
        </span>
      )}
    </>
  );
}
