/**
 * NovelAI fine-control cluster (activation flags + context assembly).
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { patchContextConfig } from "./entry-extras";
import styles from "./entry-drawer.module.css";

const openOptions = (known: readonly string[], current: string | undefined): string[] =>
  current && !known.includes(current) ? [...known, current] : [...known];

export function EntryDrawerNaiSection({
  entry,
  show,
  onPatch,
}: {
  entry: LorebookEntry;
  show: (key: string) => boolean;
  onPatch: (patch: Partial<LorebookEntry>) => void;
}): JSX.Element {
  const cc = entry.contextConfig;
  const patchCc = (patch: Parameters<typeof patchContextConfig>[1]): void =>
    onPatch({ contextConfig: patchContextConfig(cc, patch) });

  return (
    <details className={styles.section}>
      <summary>NovelAI</summary>
      <div className={styles.sectionBody}>
        {show("naiActivation") && (
          <div className={styles.row}>
            <label
              className={entry.keyRelative === true ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            >
              <input
                type="checkbox"
                checked={entry.keyRelative === true}
                onChange={(ev) => onPatch({ keyRelative: ev.target.checked })}
              />
              Keys match near the entry
            </label>
            <label
              className={
                entry.nonStoryActivatable === true ? `${styles.chip} ${styles.chipOn}` : styles.chip
              }
            >
              <input
                type="checkbox"
                checked={entry.nonStoryActivatable === true}
                onChange={(ev) => onPatch({ nonStoryActivatable: ev.target.checked })}
              />
              Activate outside story text
            </label>
          </div>
        )}
        {show("contextConfig") && (
          <>
            <span className={styles.lbl}>Context assembly</span>
            <div className={styles.row}>
              <label className={styles.fld}>
                <span>Prefix</span>
                <input
                  className={styles.text}
                  value={cc?.prefix ?? ""}
                  onChange={(ev) => patchCc({ prefix: ev.target.value || undefined })}
                />
              </label>
              <label className={styles.fld}>
                <span>Suffix</span>
                <input
                  className={styles.text}
                  value={cc?.suffix ?? ""}
                  onChange={(ev) => patchCc({ suffix: ev.target.value || undefined })}
                />
              </label>
              <label className={styles.fld}>
                <span>Token cap</span>
                <input
                  className={styles.num}
                  type="number"
                  min={0}
                  value={cc?.tokenBudget ?? ""}
                  placeholder="—"
                  onChange={(ev) =>
                    patchCc({
                      tokenBudget: ev.target.value === "" ? undefined : Number(ev.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className={styles.fld}>
                <span>Reserved</span>
                <input
                  className={styles.num}
                  type="number"
                  min={0}
                  value={cc?.reservedTokens ?? ""}
                  placeholder="0"
                  onChange={(ev) =>
                    patchCc({
                      reservedTokens: ev.target.value === "" ? undefined : Number(ev.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className={styles.fld}>
                <span>Offset</span>
                <input
                  className={styles.num}
                  type="number"
                  value={cc?.insertionPosition ?? ""}
                  placeholder="0"
                  onChange={(ev) =>
                    patchCc({
                      insertionPosition:
                        ev.target.value === "" ? undefined : Number(ev.target.value) || 0,
                    })
                  }
                />
              </label>
            </div>
            <div className={styles.row}>
              {(
                [
                  ["trimDirection", "Trim", ["doNotTrim", "trimBottom", "trimTop"]],
                  ["insertionType", "Join by", ["newline", "space", "token"]],
                  ["maximumTrimType", "Trim by", ["sentence", "newline", "token"]],
                ] as const
              ).map(([key, label, known]) => (
                <label key={key} className={styles.fld}>
                  <span>{label}</span>
                  <select
                    className={styles.sel}
                    value={cc?.[key] ?? ""}
                    aria-label={label}
                    onChange={(ev) => patchCc({ [key]: ev.target.value || undefined })}
                  >
                    <option value="">default</option>
                    {openOptions(known, cc?.[key]).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
