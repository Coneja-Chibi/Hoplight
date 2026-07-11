/**
 * When & where island: instrument tiles (chance / rhythm / recursion / group)
 * plus placement stop-rail. One probability dial (no leave-it-to-chance switch).
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { PositionPicker } from "./position-picker";
import { timingLine } from "./entry-fire-mode";

export interface EntryWhenWhereProps {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
}

type ShowKey = Parameters<typeof fieldVisible>[1];

export function EntryWhenWhere({
  entry,
  writeFor,
  styles,
  onPatch,
}: EntryWhenWhereProps): JSX.Element | null {
  const show = (key: ShowKey): boolean => fieldVisible(writeFor, key);
  const hasChance = show("probability");
  const hasRhythm = show("sticky") || show("cooldown") || show("delay");
  const hasRecursion = show("recursion");
  const hasGroup = show("groupName");
  const hasPlace = show("position");
  if (!hasChance && !hasRhythm && !hasRecursion && !hasGroup && !hasPlace) return null;

  const recursionMode: "normal" | "prevent" | "delay" = entry.preventRecursion
    ? "prevent"
    : entry.delayUntilRecursion > 0
      ? "delay"
      : "normal";
  const setRecursion = (mode: "normal" | "prevent" | "delay"): void => {
    if (mode === "normal") {
      onPatch({ preventRecursion: false, delayUntilRecursion: 0, excludeRecursion: false });
    } else if (mode === "prevent") {
      onPatch({ preventRecursion: true, delayUntilRecursion: 0 });
    } else {
      onPatch({
        preventRecursion: false,
        delayUntilRecursion: entry.delayUntilRecursion > 0 ? entry.delayUntilRecursion : 1,
      });
    }
  };

  const chancePct = Math.max(0, Math.min(100, entry.probability));

  return (
    <section className={styles.bcard} aria-label="When and where">
      <div className={styles.bchead}>
        <b>When &amp; where</b>
        <i title={timingLine(entry)}>{timingLine(entry)}</i>
      </div>
      <div className={styles.bcbody}>
        <div className={styles.wwGrid}>
          {hasChance && (
            <div className={styles.wwChance}>
              <div className={styles.wwTileH}>
                <b>Chance</b>
                <span>probability</span>
              </div>
              <div className={styles.wwChanceRow}>
                <span className={styles.wwPct}>{chancePct}%</span>
                <input
                  className={styles.wwChanceRange}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={chancePct}
                  aria-label="Activation chance percent"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={chancePct}
                  onChange={(ev) => {
                    const n = Math.max(0, Math.min(100, Number(ev.target.value) || 0));
                    onPatch({ probability: n });
                  }}
                />
              </div>
            </div>
          )}
          {hasRhythm && (
            <div className={styles.wwTurns}>
              <div className={styles.wwTileH}>
                <b>Rhythm</b>
                <span>messages</span>
              </div>
              <div className={styles.wwMini}>
                {show("sticky") && (
                  <label className={styles.wwMiniCell}>
                    <span>Sticky</span>
                    <input
                      type="number"
                      min={0}
                      value={entry.sticky}
                      aria-label="Sticky messages"
                      onChange={(ev) => onPatch({ sticky: Number(ev.target.value) || 0 })}
                    />
                  </label>
                )}
                {show("cooldown") && (
                  <label className={styles.wwMiniCell}>
                    <span>Cool</span>
                    <input
                      type="number"
                      min={0}
                      value={entry.cooldown}
                      aria-label="Cool messages"
                      onChange={(ev) => onPatch({ cooldown: Number(ev.target.value) || 0 })}
                    />
                  </label>
                )}
                {show("delay") && (
                  <label className={styles.wwMiniCell}>
                    <span>Delay</span>
                    <input
                      type="number"
                      min={0}
                      value={entry.delay}
                      aria-label="Delay messages"
                      onChange={(ev) => onPatch({ delay: Number(ev.target.value) || 0 })}
                    />
                  </label>
                )}
              </div>
            </div>
          )}
          {hasRecursion && (
            <div className={styles.wwRec}>
              <div className={styles.wwTileH}>
                <b>Recursion</b>
                <span>wake</span>
              </div>
              <div className={styles.wwSeg} role="group" aria-label="Recursion mode">
                {(["normal", "prevent", "delay"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={
                      recursionMode === mode ? `${styles.wwSegBtn} ${styles.wwSegOn}` : styles.wwSegBtn
                    }
                    aria-pressed={recursionMode === mode}
                    onClick={() => setRecursion(mode)}
                  >
                    {mode === "normal" ? "Norm" : mode === "prevent" ? "Prev" : "Delay"}
                  </button>
                ))}
              </div>
              {recursionMode === "delay" && (
                <input
                  className={styles.wwRecLevel}
                  type="number"
                  min={1}
                  value={entry.delayUntilRecursion}
                  aria-label="Delay until recursion level"
                  onChange={(ev) =>
                    onPatch({ delayUntilRecursion: Number(ev.target.value) || 1 })
                  }
                />
              )}
            </div>
          )}
          {hasGroup && (
            <div className={styles.wwGroup}>
              <div className={styles.wwTileH}>
                <b>Group</b>
                <span>one of set</span>
              </div>
              <div className={styles.wwGroupRow}>
                <input
                  className={styles.wwGroupIn}
                  value={entry.groupName ?? ""}
                  placeholder="None"
                  aria-label="Inclusion group"
                  onChange={(ev) => onPatch({ groupName: ev.target.value || null })}
                />
                {show("groupTuning") && (
                  <>
                    <span className={styles.wwW}>w</span>
                    <input
                      className={styles.wwWeight}
                      type="number"
                      min={0}
                      value={entry.groupWeight}
                      aria-label="Inclusion-group weight"
                      onChange={(ev) => onPatch({ groupWeight: Number(ev.target.value) || 0 })}
                    />
                  </>
                )}
              </div>
            </div>
          )}
          {hasPlace && (
            <div className={styles.wwPlace}>
              <PositionPicker
                position={entry.position}
                depth={entry.depth}
                role={entry.role}
                writeFor={writeFor}
                showDepth={show("depth")}
                showRole={show("role")}
                styles={styles}
                onPatch={onPatch}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
