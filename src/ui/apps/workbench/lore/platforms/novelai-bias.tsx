/**
 * NovelAI phrase-bias editor (loreBiasGroups). Pure UI shell over entry-extras helpers.
 */
import type { JSX } from "react";
import type { LoreBiasGroup, LorebookEntry } from "../../../../../entities/lorebook/schema";
import {
  biasPhraseLine,
  emptyBiasGroup,
  phrasesFromLines,
  removeBiasGroup,
  replaceBiasGroup,
} from "../entry-extras";
import { ExpandTextarea } from "../../../../components/expand";

export function NovelAiBiasBlock({
  entry,
  styles,
  onPatch,
}: {
  entry: LorebookEntry;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
}): JSX.Element {
  const groups = entry.loreBiasGroups ?? [];

  const setGroups = (next: LoreBiasGroup[] | undefined): void => {
    onPatch({ loreBiasGroups: next && next.length > 0 ? next : undefined });
  };

  return (
    <div className={styles.pcZone}>
      <div className={styles.pcZh}>
        <b>Phrase bias</b>
        <span>nudge generation toward or away from phrases while this entry is active</span>
        <em>{groups.length} group{groups.length === 1 ? "" : "s"}</em>
      </div>

      {groups.length === 0 && (
        <p className={styles.pcHint}>No bias groups. Add one to bias specific words or phrases.</p>
      )}

      {groups.map((g, i) => {
        const lines = g.phrases.map(biasPhraseLine).filter(Boolean).join("\n");
        return (
          <div key={i} className={styles.pcBiasCard}>
            <div className={styles.pcBiasHead}>
              <button
                type="button"
                className={
                  g.enabled ? styles.pcSwitch : `${styles.pcSwitch} ${styles.pcSwitchOff}`
                }
                role="switch"
                aria-checked={g.enabled}
                aria-label={`Bias group ${i + 1} enabled`}
                onClick={() =>
                  setGroups(replaceBiasGroup(groups, i, { ...g, enabled: !g.enabled }))
                }
              />
              <span className={styles.pcK}>Group {i + 1}</span>
              <label className={styles.pcBiasBias}>
                <span className={styles.pcK}>Bias</span>
                <input
                  className={styles.pcNum}
                  type="number"
                  step={0.1}
                  value={g.bias}
                  aria-label={`Bias strength for group ${i + 1}`}
                  onFocus={(ev) => ev.currentTarget.select()}
                  onChange={(ev) =>
                    setGroups(
                      replaceBiasGroup(groups, i, {
                        ...g,
                        bias: Number(ev.target.value) || 0,
                      }),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className={styles.pcBiasDel}
                aria-label={`Remove bias group ${i + 1}`}
                onClick={() => setGroups(removeBiasGroup(groups, i))}
              >
                Remove
              </button>
            </div>
            <label className={styles.pcBiasPhrases}>
              <span className={styles.pcK}>Phrases (one per line)</span>
              <ExpandTextarea
                label={`Phrases for bias group ${i + 1}`}
                className={styles.pcBiasTa}
                value={lines}
                rows={Math.min(4, Math.max(2, g.phrases.length || 2))}
                aria-label={`Phrases for bias group ${i + 1}`}
                onChange={(ev) =>
                  setGroups(
                    replaceBiasGroup(groups, i, {
                      ...g,
                      phrases: phrasesFromLines(ev.target.value, g.phrases),
                    }),
                  )
                }
              />
            </label>
            <div className={styles.pcBiasFlags}>
              {(
                [
                  ["whenInactive", "When inactive", g.whenInactive === true],
                  ["generateOnce", "Generate once", g.generateOnce === true],
                  ["ensureSequenceFinish", "Finish sequence", g.ensureSequenceFinish === true],
                ] as const
              ).map(([key, label, on]) => (
                <button
                  key={key}
                  type="button"
                  className={on ? `${styles.pcScanChip} ${styles.pcScanOn}` : styles.pcScanChip}
                  aria-pressed={on}
                  onClick={() =>
                    setGroups(replaceBiasGroup(groups, i, { ...g, [key]: !on }))
                  }
                >
                  <span className={styles.pcScanBox} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className={styles.pcBiasAdd}
        onClick={() => setGroups([...(groups ?? []), emptyBiasGroup()])}
      >
        + Bias group
      </button>
    </div>
  );
}
