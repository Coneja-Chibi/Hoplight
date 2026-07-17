/**
 * Source pane: snippet chips + CodeEditor (plain CSS truth).
 */
import type { JSX } from "react";
import { CodeEditor } from "../code-editor";
import styles from "./styles.module.css";

export const CSS_SNIPPET_CHIPS: ReadonlyArray<{ label: string; insert: string }> = [
  { label: "color", insert: "color: #e8e4ef;" },
  { label: "bg", insert: "background: #1a1820;" },
  { label: "radius", insert: "border-radius: 12px;" },
  { label: "pad", insert: "padding: 12px;" },
  { label: "border", insert: "border: 1px solid #3a3545;" },
  { label: "shadow", insert: "box-shadow: 0 8px 24px rgba(0,0,0,0.35);" },
  { label: "!imp", insert: "opacity: 1 !important;" },
];

export interface CssSourcePaneProps {
  value: string;
  onChange(css: string): void;
  onChip(insert: string): void;
}

/** Source tab: chips assist, editor is the sheet. */
export function CssSourcePane({ value, onChange, onChip }: CssSourcePaneProps): JSX.Element {
  return (
    <div className={styles.assist} data-tour="css-source">
      <div className={styles.sourceHead}>
        <span className={styles.sourceLabel}>Plain CSS source (truth)</span>
      </div>
      <div className={styles.chips}>
        {CSS_SNIPPET_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            className={styles.chip}
            title={c.insert}
            onClick={() => onChip(c.insert)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <CodeEditor
        value={value}
        onChange={onChange}
        language="css"
        minRows={10}
        placeholder={"/* your CSS */\n.card {\n  color: #e8e4ef;\n}\n"}
        macros={[]}
      />
    </div>
  );
}
