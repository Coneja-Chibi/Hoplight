/**
 * NovelAI lore long tail: activation, context wrap, budget, trim/join policy.
 * Layout: design/vs-lore-platform-extras.html pass 3.2. Codec: formats/novelai/lorebook.ts.
 */
import type { JSX } from "react";
import { patchContextConfig } from "../entry-extras";
import type { LorePlatformCard, LorePlatformCardProps } from "./card-contract";

const openOptions = (known: readonly string[], current: string | undefined): string[] =>
  current && !known.includes(current) ? [...known, current] : [...known];

function Component({ entry, show, styles, onPatch }: LorePlatformCardProps): JSX.Element | null {
  const cc = entry.contextConfig;
  const patchCc = (patch: Parameters<typeof patchContextConfig>[1]): void =>
    onPatch({ contextConfig: patchContextConfig(cc, patch) });

  const any = show("naiActivation") || show("contextConfig");
  if (!any) return null;

  return (
    <>
      {show("naiActivation") && (
        <div className={styles.pcZone}>
          <div className={styles.pcZh}>
            <b>Activation</b>
            <span>when keys are allowed to fire</span>
          </div>
          <div className={styles.pcPair}>
            <div className={styles.pcCell}>
              <div className={styles.pcCellT}>
                <b>Key-relative</b>
                <span>Keys match near this entry's insertion, not only the story tail.</span>
              </div>
              <button
                type="button"
                className={
                  entry.keyRelative === true
                    ? styles.pcSwitch
                    : `${styles.pcSwitch} ${styles.pcSwitchOff}`
                }
                role="switch"
                aria-checked={entry.keyRelative === true}
                aria-label="Keys match near the entry"
                onClick={() =>
                  onPatch({ keyRelative: entry.keyRelative === true ? undefined : true })
                }
              />
            </div>
            <div className={styles.pcCell}>
              <div className={styles.pcCellT}>
                <b>Non-story</b>
                <span>Can activate outside story text (UI and other sources).</span>
              </div>
              <button
                type="button"
                className={
                  entry.nonStoryActivatable === true
                    ? styles.pcSwitch
                    : `${styles.pcSwitch} ${styles.pcSwitchOff}`
                }
                role="switch"
                aria-checked={entry.nonStoryActivatable === true}
                aria-label="Can activate outside story text"
                onClick={() =>
                  onPatch({
                    nonStoryActivatable: entry.nonStoryActivatable === true ? undefined : true,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {show("contextConfig") && (
        <>
          <div className={styles.pcZone}>
            <div className={styles.pcZh}>
              <b>Context wrap</b>
              <span>text that frames the passage</span>
            </div>
            <div className={styles.pcWrap}>
              <div>
                <span className={styles.pcWrapLab}>Prefix</span>
                <input
                  className={styles.pcText}
                  style={{ width: "100%", maxWidth: "none", marginTop: "0.16rem" }}
                  value={cc?.prefix ?? ""}
                  aria-label="Context prefix"
                  onChange={(ev) => patchCc({ prefix: ev.target.value || undefined })}
                />
              </div>
              <div className={styles.pcWrapMid}>the entry passage sits here</div>
              <div>
                <span className={styles.pcWrapLab}>Suffix</span>
                <input
                  className={styles.pcText}
                  style={{ width: "100%", maxWidth: "none", marginTop: "0.16rem" }}
                  value={cc?.suffix ?? ""}
                  aria-label="Context suffix"
                  onChange={(ev) => patchCc({ suffix: ev.target.value || undefined })}
                />
              </div>
            </div>
          </div>

          <div className={styles.pcZone}>
            <div className={styles.pcZh}>
              <b>Budget</b>
              <span>how much room this entry may take</span>
            </div>
            <div className={styles.pcTrio}>
              <label className={styles.pcTrioCell}>
                <span className={styles.pcK}>Token cap</span>
                <input
                  className={styles.pcNum}
                  type="number"
                  value={cc?.tokenBudget ?? ""}
                  placeholder="—"
                  aria-label="Token cap"
                  onChange={(ev) =>
                    patchCc({
                      tokenBudget: ev.target.value === "" ? undefined : Number(ev.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className={styles.pcTrioCell}>
                <span className={styles.pcK}>Reserved</span>
                <input
                  className={styles.pcNum}
                  type="number"
                  value={cc?.reservedTokens ?? ""}
                  placeholder="0"
                  aria-label="Reserved tokens"
                  onChange={(ev) =>
                    patchCc({
                      reservedTokens:
                        ev.target.value === "" ? undefined : Number(ev.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className={styles.pcTrioCell}>
                <span className={styles.pcK}>Offset</span>
                <input
                  className={styles.pcNum}
                  type="number"
                  value={cc?.insertionPosition ?? ""}
                  placeholder="0"
                  aria-label="Insertion offset"
                  onChange={(ev) =>
                    patchCc({
                      insertionPosition:
                        ev.target.value === "" ? undefined : Number(ev.target.value) || 0,
                    })
                  }
                />
              </label>
            </div>
          </div>

          <div className={styles.pcZone}>
            <div className={styles.pcZh}>
              <b>Trim &amp; join</b>
              <span>assembly policy when room is tight</span>
            </div>
            <div className={styles.pcTrio}>
              {(
                [
                  ["trimDirection", "Trim direction", ["doNotTrim", "trimBottom", "trimTop"]],
                  ["insertionType", "Join by", ["newline", "space", "token"]],
                  ["maximumTrimType", "Trim by", ["sentence", "newline", "token"]],
                ] as const
              ).map(([key, label, known]) => (
                <label key={key} className={styles.pcTrioCell}>
                  <span className={styles.pcK}>{label}</span>
                  <select
                    className={styles.pcSel}
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
          </div>
        </>
      )}
    </>
  );
}

const card: LorePlatformCard = {
  id: "novelai",
  label: "NovelAI",
  lenses: ["novelai"],
  Component,
};

export default card;
