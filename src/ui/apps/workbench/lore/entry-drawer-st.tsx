/**
 * ST-family fine-control cluster (scan sources, RAG, display index, automation).
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import styles from "./entry-drawer.module.css";

const SCAN_KEYS = [
  ["scanCharacterDescription", "Description"],
  ["scanCharacterPersonality", "Personality"],
  ["scanUserPersona", "Persona"],
  ["scanScenario", "Scenario"],
  ["scanCharacterDepthPrompt", "Depth prompt"],
  ["scanCreatorNotes", "Creator notes"],
] as const;

export function EntryDrawerStSection({
  entry,
  show,
  onPatch,
}: {
  entry: LorebookEntry;
  show: (key: string) => boolean;
  onPatch: (patch: Partial<LorebookEntry>) => void;
}): JSX.Element {
  return (
    <details className={styles.section}>
      <summary>SillyTavern / Chub / Lumiverse</summary>
      <div className={styles.sectionBody}>
        {show("scanSources") && (
          <div className={styles.row}>
            {SCAN_KEYS.map(([key, label]) => (
              <label
                key={key}
                className={entry[key] === true ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              >
                <input
                  type="checkbox"
                  checked={entry[key] === true}
                  onChange={(ev) => onPatch({ [key]: ev.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        )}
        {show("vectorized") && (
          <label className={entry.vectorized === true ? `${styles.chip} ${styles.chipOn}` : styles.chip}>
            <input
              type="checkbox"
              checked={entry.vectorized === true}
              onChange={(ev) => onPatch({ vectorized: ev.target.checked })}
            />
            Vectorized (RAG)
          </label>
        )}
        {show("delayUntilRecursion") && (
          <label className={styles.fld}>
            <span>Recursion level</span>
            <input
              className={styles.num}
              type="number"
              min={0}
              value={entry.delayUntilRecursion}
              aria-label="Only activate at recursion level N"
              onChange={(ev) => onPatch({ delayUntilRecursion: Number(ev.target.value) || 0 })}
            />
          </label>
        )}
        {show("displayIndex") && (
          <label className={styles.field}>
            <span className={styles.lbl}>List display index (not placement order)</span>
            <input
              className={styles.input}
              type="number"
              value={entry.displayIndex ?? ""}
              placeholder="follow order"
              aria-label="SillyTavern displayIndex"
              onChange={(ev) => {
                const v = ev.target.value;
                onPatch({ displayIndex: v === "" ? null : Number(v) || 0 });
              }}
            />
          </label>
        )}
        {show("automationId") && (
          <label className={styles.field}>
            <span className={styles.lbl}>Automation id</span>
            <input
              className={styles.input}
              value={entry.automationId ?? ""}
              onChange={(ev) => onPatch({ automationId: ev.target.value || null })}
            />
          </label>
        )}
      </div>
    </details>
  );
}
