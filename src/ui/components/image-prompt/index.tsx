/**
 * ImagePromptEditor - canonical persona.imagePrompt (affixes + full text + labeled rows).
 * Replaces the flat structured-subeditor wall and the duplicate Agnai Image Affixes card.
 */
import type { JSX } from "react";
import {
  imagePromptToCanonical,
  normalizeImagePrompt,
  type ImagePromptValue,
} from "./core";
import { ExpandTextarea } from "../expand";
import styles from "./styles.module.css";

export interface ImagePromptEditorProps {
  value: unknown;
  onChange(next: Record<string, unknown> | undefined): void;
}

export function ImagePromptEditor({ value, onChange }: ImagePromptEditorProps): JSX.Element {
  const a = normalizeImagePrompt(value);
  const commit = (next: ImagePromptValue): void => onChange(imagePromptToCanonical(next));
  const patch = (p: Partial<ImagePromptValue>): void => commit({ ...a, ...p });

  return (
    <div className={styles.wrap}>
      <span className={styles.section}>Affixes</span>
      <span className={styles.lbl}>Prefix</span>
      <input
        className={styles.input}
        value={a.prefix}
        onChange={(e) => patch({ prefix: e.target.value })}
        placeholder="always prepend..."
      />
      <span className={styles.lbl}>Suffix</span>
      <input
        className={styles.input}
        value={a.suffix}
        onChange={(e) => patch({ suffix: e.target.value })}
        placeholder="always append..."
      />
      <span className={styles.lbl}>Negative</span>
      <input
        className={styles.input}
        value={a.negative}
        onChange={(e) => patch({ negative: e.target.value })}
        placeholder="things to avoid"
      />
      <span className={styles.lbl}>Template</span>
      <ExpandTextarea
        label="Template"
        className={styles.ta}
        value={a.template}
        onChange={(e) => patch({ template: e.target.value })}
        placeholder="{{prefix}} {{char}} {{suffix}}"
      />

      <span className={styles.section}>Full prompt text</span>
      <span className={styles.lbl}>Base prompt</span>
      <ExpandTextarea
        label="Base prompt"
        className={styles.ta}
        value={a.prompt}
        onChange={(e) => patch({ prompt: e.target.value })}
        placeholder="optional full base prompt"
      />
      <span className={styles.lbl}>Instructions</span>
      <ExpandTextarea
        label="Instructions"
        className={styles.ta}
        value={a.instructions}
        onChange={(e) => patch({ instructions: e.target.value })}
      />
      <span className={styles.lbl}>Emotion instructions</span>
      <ExpandTextarea
        label="Emotion instructions"
        className={styles.ta}
        value={a.emotionInstructions}
        onChange={(e) => patch({ emotionInstructions: e.target.value })}
      />

      <span className={styles.section}>Labeled rows</span>
      <div className={styles.rows}>
        {a.rows.map((row, i) => (
          <div className={styles.row} key={i}>
            <input
              className={styles.input}
              value={row.label}
              placeholder="label"
              onChange={(e) => {
                const rows = a.rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r));
                patch({ rows });
              }}
            />
            <input
              className={styles.input}
              value={row.value}
              placeholder="value"
              onChange={(e) => {
                const rows = a.rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r));
                patch({ rows });
              }}
            />
            <button
              type="button"
              className={styles.rm}
              onClick={() => patch({ rows: a.rows.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.add}
          onClick={() => patch({ rows: [...a.rows, { label: "", value: "" }] })}
        >
          + row
        </button>
      </div>
    </div>
  );
}
