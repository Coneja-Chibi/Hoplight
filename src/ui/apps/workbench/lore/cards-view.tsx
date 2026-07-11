/**
 * Cards lens: browsable wall of entries (vs-lore-lenses).
 * Wireframe-faithful: title + mode, 3-line peek, key chips, tok/on foot.
 * Mode chip cycles Keyword / Always on / By meaning. Click tile opens Pages.
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
  keyed: "Keyword",
  always: "Always on",
  meaning: "By meaning",
};

const modeClass = (mode: EntryFireMode): string => {
  const base = styles.mode ?? "mode";
  if (mode === "always") return `${base} ${styles.mAlways ?? ""}`.trim();
  if (mode === "meaning") return `${base} ${styles.mMeaning ?? ""}`.trim();
  return `${base} ${styles.mKey ?? ""}`.trim();
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
        const shown = keys.slice(0, 3);
        const extra = keys.length - shown.length;
        const preview = (e.content || "").trim().replace(/\s+/g, " ");
        const tokens = estimateEntryTokens(e);
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
            <div className={styles.echead}>
              <b className={styles.etitle}>{e.title || "(untitled)"}</b>
              <button
                type="button"
                className={modeClass(mode)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onPatch(e.id, fireModePatch(cycleMode(mode, vectorOk)));
                }}
              >
                {MODE_LABEL[mode]}
              </button>
            </div>
            <p className={styles.esnip}>
              {preview || "No passage yet."}
            </p>
            <div className={styles.ekeys}>
              {mode === "meaning" && keys.length === 0 ? (
                <span className={`${styles.ekey} ${styles.ekeyMore}`}>
                  no keys · fires by similarity
                </span>
              ) : (
                <>
                  {shown.map((k) => (
                    <span key={`k-${k}`} className={styles.ekey}>
                      {k}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span className={`${styles.ekey} ${styles.ekeyMore}`}>+{extra}</span>
                  )}
                </>
              )}
            </div>
            <div className={styles.ecfoot}>
              <span className={styles.tok}>~{tokens} tok</span>
              <span
                className={
                  e.enabled
                    ? styles.onoff
                    : `${styles.onoff} ${styles.onoffOff}`
                }
              >
                {e.enabled ? "On" : "Off"}
              </span>
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
