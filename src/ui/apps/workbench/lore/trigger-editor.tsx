/**
 * TriggerEditor - one trigger list (primary or secondary) with the advanced riders. Simple mode is
 * the chip box alone; advanced mode makes chips pickable and opens a rider row for the picked one
 * (regex + flags, frequency, per-trigger chance) - the RC advanced-trigger surface.
 */
import { useState, type JSX } from "react";
import type { Trigger } from "../../../../entities/lorebook/schema";
import { KeywordChips } from "./keyword-chips";
import { patchTriggerAt, type TriggerRiderPatch } from "./trigger-edit";

export interface TriggerEditorProps {
  triggers: Trigger[];
  onChange: (next: Trigger[]) => void;
  styles: Readonly<Record<string, string>>;
  /** entry-level triggerMode: riders only exist in advanced mode */
  advanced: boolean;
  placeholder?: string;
  ariaLabel: string;
}

export function TriggerEditor({
  triggers,
  onChange,
  styles,
  advanced,
  placeholder,
  ariaLabel,
}: TriggerEditorProps): JSX.Element {
  const [picked, setPicked] = useState<number | null>(null);
  const current = picked !== null && picked < triggers.length ? triggers[picked]! : null;

  const patch = (p: TriggerRiderPatch): void => {
    if (picked === null) return;
    onChange(patchTriggerAt(triggers, picked, p));
  };

  return (
    <>
      <KeywordChips
        triggers={triggers}
        onChange={(next) => {
          // removals shift indexes; dropping the pick beats editing the wrong trigger
          setPicked(null);
          onChange(next);
        }}
        styles={styles}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        pickedIndex={advanced ? picked : null}
        onPick={advanced ? (i) => setPicked(picked === i ? null : i) : undefined}
      />
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
          <label className={styles.fld}>
            <span>Chance</span>
            <input
              className={styles.num}
              type="number"
              min={0}
              max={100}
              value={current.probability ?? ""}
              placeholder="entry"
              aria-label="Per-key activation chance (blank uses the entry chance)"
              onChange={(ev) => {
                const v = ev.target.value;
                patch({ probability: v === "" ? undefined : Number(v) || 0 });
              }}
            />
          </label>
        </div>
      )}
    </>
  );
}
