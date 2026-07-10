/**
 * TriggerEditor - RC-style key row: chips (+ per-key % in advanced) and optional + Condition menu.
 * Advanced still exposes regex/frequency riders when a chip is picked.
 */
import { useState, type JSX } from "react";
import type { Trigger } from "../../../../entities/lorebook/schema";
import { LoreSpecialTriggers } from "../../../components/lore-special-triggers";
import { KeywordChips } from "./keyword-chips";
import { patchTriggerAt, type TriggerRiderPatch } from "./trigger-edit";

export interface TriggerEditorProps {
  triggers: Trigger[];
  onChange: (next: Trigger[]) => void;
  styles: Readonly<Record<string, string>>;
  advanced: boolean;
  placeholder?: string;
  ariaLabel: string;
  showSpecials?: boolean;
  entryProbability?: number;
}

export function TriggerEditor({
  triggers,
  onChange,
  styles,
  advanced,
  placeholder,
  ariaLabel,
  showSpecials = false,
  entryProbability = 100,
}: TriggerEditorProps): JSX.Element {
  const [picked, setPicked] = useState<number | null>(null);
  const current = picked !== null && picked < triggers.length ? triggers[picked]! : null;

  const patch = (p: TriggerRiderPatch): void => {
    if (picked === null) return;
    onChange(patchTriggerAt(triggers, picked, p));
  };

  return (
    <div className={styles.keyCluster}>
      <div className={styles.keyLine}>
        <KeywordChips
          triggers={triggers}
          onChange={(next) => {
            setPicked(null);
            onChange(next);
          }}
          styles={styles}
          placeholder={placeholder}
          ariaLabel={ariaLabel}
          advanced={advanced}
          entryProbability={entryProbability}
          pickedIndex={advanced ? picked : null}
          onPick={advanced ? (i) => setPicked(picked === i ? null : i) : undefined}
        />
        {showSpecials && advanced && (
          <LoreSpecialTriggers triggers={triggers} onChange={onChange} advanced={advanced} />
        )}
      </div>
      {advanced && current && (
        <div className={styles.riderRow} role="group" aria-label={`Dials for ${current.keyword}`}>
          <span className={styles.riderName}>{current.keyword}</span>
          <button
            type="button"
            className={current.isRegex ? `${styles.fldBtn} ${styles.fldOn}` : styles.fldBtn}
            aria-pressed={current.isRegex}
            title="Treat this key as a regular expression"
            onClick={() => patch({ isRegex: !current.isRegex })}
          >
            Regex
          </button>
          {current.isRegex && (
            <label className={styles.fld}>
              <span>Flags</span>
              <input
                className={styles.groupIn}
                value={current.flags ?? ""}
                placeholder="i, g, m…"
                aria-label="Regex flags"
                onChange={(ev) => patch({ flags: ev.target.value || undefined })}
              />
            </label>
          )}
          <label className={styles.fld}>
            <span>Every N msgs</span>
            <input
              className={styles.num}
              type="number"
              min={0}
              value={current.frequency ?? ""}
              placeholder="any"
              aria-label="Minimum messages between activations"
              onChange={(ev) => {
                const v = ev.target.value;
                patch({ frequency: v === "" ? undefined : Number(v) || 0 });
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
