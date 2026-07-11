/**
 * When & where island: timing/chance + placement in one open card (not two folds).
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { fieldVisible, positionsForProfile, type LoreWriteForProfile } from "../../../../core/lore";
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
  const hasTiming =
    show("probability") ||
    show("sticky") ||
    show("cooldown") ||
    show("delay") ||
    show("recursion") ||
    show("groupName");
  const hasPlace = show("position");
  if (!hasTiming && !hasPlace) return null;

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

  return (
    <section className={styles.bcard} aria-label="When and where">
      <div className={styles.bchead}>
        <b>When &amp; where</b>
        <i title={timingLine(entry)}>{timingLine(entry)}</i>
      </div>
      <div className={styles.bcbody}>
        {hasTiming && (
          <div className={styles.zone}>
            <span className={styles.zoneLbl}>Timing &amp; chance</span>
            {show("probability") && (
              <div className={styles.chanceRow}>
                <button
                  type="button"
                  className={
                    entry.probability < 100
                      ? styles.texpSwitch
                      : `${styles.texpSwitch} ${styles.texpSwitchOff}`
                  }
                  role="switch"
                  aria-checked={entry.probability < 100}
                  aria-label="Leave it to chance"
                  title="Off: always fires when keys match (100%). On: roll the slider."
                  onClick={() =>
                    onPatch({
                      probability: entry.probability < 100 ? 100 : 75,
                    })
                  }
                />
                <span className={styles.plabel}>Leave it to chance</span>
                <input
                  className={styles.chanceRange}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={entry.probability}
                  aria-label="Activation chance percent"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={entry.probability}
                  onChange={(ev) => {
                    const n = Math.max(0, Math.min(100, Number(ev.target.value) || 0));
                    onPatch({ probability: n });
                  }}
                />
                <span className={styles.chanceReadout}>{entry.probability}%</span>
              </div>
            )}
            <div className={styles.timeRow2}>
              {show("sticky") && (
                <label className={styles.headFld}>
                  <span>Sticky</span>
                  <input
                    className={styles.headNum}
                    type="number"
                    min={0}
                    value={entry.sticky}
                    aria-label="Sticky messages"
                    onChange={(ev) => onPatch({ sticky: Number(ev.target.value) || 0 })}
                  />
                </label>
              )}
              {show("cooldown") && (
                <label className={styles.headFld}>
                  <span>Cool</span>
                  <input
                    className={styles.headNum}
                    type="number"
                    min={0}
                    value={entry.cooldown}
                    aria-label="Cool messages"
                    onChange={(ev) => onPatch({ cooldown: Number(ev.target.value) || 0 })}
                  />
                </label>
              )}
              {show("delay") && (
                <label className={styles.headFld}>
                  <span>Delay</span>
                  <input
                    className={styles.headNum}
                    type="number"
                    min={0}
                    value={entry.delay}
                    aria-label="Delay messages"
                    onChange={(ev) => onPatch({ delay: Number(ev.target.value) || 0 })}
                  />
                </label>
              )}
              {show("recursion") && (
                <span className={styles.timeCluster}>
                  <span className={styles.plabel}>Recursion</span>
                  {(["normal", "prevent", "delay"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={
                        recursionMode === mode ? `${styles.seg} ${styles.segOn}` : styles.seg
                      }
                      aria-pressed={recursionMode === mode}
                      onClick={() => setRecursion(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                  {recursionMode === "delay" && (
                    <input
                      className={styles.headNum}
                      type="number"
                      min={1}
                      value={entry.delayUntilRecursion}
                      aria-label="Delay until recursion level"
                      onChange={(ev) =>
                        onPatch({ delayUntilRecursion: Number(ev.target.value) || 1 })
                      }
                    />
                  )}
                </span>
              )}
              {show("groupName") && (
                <label className={styles.headFld} title="Only one entry of a group is picked">
                  <span>Group</span>
                  <input
                    className={styles.groupIn}
                    value={entry.groupName ?? ""}
                    placeholder="None"
                    aria-label="Inclusion group"
                    onChange={(ev) => onPatch({ groupName: ev.target.value || null })}
                  />
                </label>
              )}
              {show("groupTuning") && (
                <label className={styles.headFld} title="Higher weight wins the group more often">
                  <span>Weight</span>
                  <input
                    className={styles.headNum}
                    type="number"
                    min={0}
                    value={entry.groupWeight}
                    aria-label="Inclusion-group weight"
                    onChange={(ev) => onPatch({ groupWeight: Number(ev.target.value) || 0 })}
                  />
                </label>
              )}
            </div>
          </div>
        )}
        {hasPlace && (
          <div className={styles.zone}>
            <span className={styles.zoneLbl}>Placement</span>
            <PositionPicker
              position={entry.position}
              depth={entry.depth}
              role={entry.role}
              allowed={positionsForProfile(writeFor)}
              showDepth={show("depth")}
              showRole={false}
              styles={styles}
              onPatch={onPatch}
            />
          </div>
        )}
      </div>
    </section>
  );
}
