/**
 * Cards lens: grid of entry cards (vs-lore-lenses). Mode chip cycles tri-mode; body click opens Pages.
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { estimateEntryTokens, fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { entryFireMode, fireModePatch, type EntryFireMode } from "./entry-fire-mode";
import styles from "./cards-view.module.css";

export interface CardsViewProps {
  entries: readonly LorebookEntry[];
  writeFor: LoreWriteForProfile;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<LorebookEntry>) => void;
  onAdd: () => void;
}

const MODE_LABEL: Record<EntryFireMode, string> = {
  keyed: "Keywords",
  always: "Always on",
  meaning: "By meaning",
};

const cycleMode = (mode: EntryFireMode, vectorOk: boolean): EntryFireMode => {
  if (mode === "keyed") return "always";
  if (mode === "always") return vectorOk ? "meaning" : "keyed";
  return "keyed";
};

export function CardsView({
  entries,
  writeFor,
  onSelect,
  onPatch,
  onAdd,
}: CardsViewProps): JSX.Element {
  const vectorOk = fieldVisible(writeFor, "vectorized");

  return (
    <div className={styles.grid} aria-label="Entry cards">
      {entries.map((e) => {
        const mode = entryFireMode(e);
        const keys = e.triggers.map((t) => t.keyword).filter(Boolean);
        const shown = keys.slice(0, 4);
        const extra = keys.length - shown.length;
        return (
          <div
            key={e.id}
            role="button"
            tabIndex={0}
            className={e.enabled ? styles.ecard : `${styles.ecard} ${styles.ecardOff}`}
            onClick={() => onSelect(e.id)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onSelect(e.id);
              }
            }}
          >
            <div className={styles.ehead}>
              <b className={styles.etitle}>{e.title || "(untitled)"}</b>
              <button
                type="button"
                className={styles.modeChip}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onPatch(e.id, fireModePatch(cycleMode(mode, vectorOk)));
                }}
              >
                {MODE_LABEL[mode]}
              </button>
            </div>
            <p className={styles.clamp}>{e.content || "No passage yet."}</p>
            <div className={styles.keys}>
              {shown.map((k) => (
                <span key={k} className={styles.kchip}>
                  {k}
                </span>
              ))}
              {extra > 0 && <span className={styles.kchip}>+{extra}</span>}
            </div>
            <div className={styles.foot}>
              <span>~{estimateEntryTokens(e)} tok</span>
              <span>{e.enabled ? "On" : "Off"}</span>
            </div>
          </div>
        );
      })}
      <button type="button" className={styles.ghost} onClick={onAdd}>
        + New entry
      </button>
    </div>
  );
}
