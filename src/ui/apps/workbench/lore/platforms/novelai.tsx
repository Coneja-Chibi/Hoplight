/**
 * NovelAI's lore long tail: activation flags (key-relative, non-story) and the full context
 * assembly dials. Codec: formats/novelai/lorebook.ts.
 */
import type { JSX } from "react";
import { patchContextConfig } from "../entry-extras";
import type { LorePlatformCard, LorePlatformCardProps } from "./card-contract";

/** keep an unknown carried value visible instead of silently rewriting it */
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
        <div className={styles.timeRow2}>
          <label className={styles.chip}>
            <input
              type="checkbox"
              checked={entry.keyRelative === true}
              onChange={(ev) => onPatch({ keyRelative: ev.target.checked })}
            />{" "}
            Keys match near the entry
          </label>
          <label className={styles.chip}>
            <input
              type="checkbox"
              checked={entry.nonStoryActivatable === true}
              onChange={(ev) => onPatch({ nonStoryActivatable: ev.target.checked })}
            />{" "}
            Can activate outside story text
          </label>
        </div>
      )}
      {show("contextConfig") && (
        <>
          <span className={styles.plabel}>Context assembly</span>
          <div className={styles.timeRow2}>
            <label className={styles.headFld}>
              <span>Prefix</span>
              <input
                className={styles.groupIn}
                value={cc?.prefix ?? ""}
                aria-label="Context prefix"
                onChange={(ev) => patchCc({ prefix: ev.target.value || undefined })}
              />
            </label>
            <label className={styles.headFld}>
              <span>Suffix</span>
              <input
                className={styles.groupIn}
                value={cc?.suffix ?? ""}
                aria-label="Context suffix"
                onChange={(ev) => patchCc({ suffix: ev.target.value || undefined })}
              />
            </label>
            <label className={styles.headFld}>
              <span>Token cap</span>
              <input
                className={styles.headNum}
                type="number"
                min={0}
                value={cc?.tokenBudget ?? ""}
                placeholder="—"
                aria-label="Per-entry token cap"
                onChange={(ev) =>
                  patchCc({ tokenBudget: ev.target.value === "" ? undefined : Number(ev.target.value) || 0 })
                }
              />
            </label>
            <label className={styles.headFld}>
              <span>Reserved</span>
              <input
                className={styles.headNum}
                type="number"
                min={0}
                value={cc?.reservedTokens ?? ""}
                placeholder="0"
                aria-label="Reserved tokens"
                onChange={(ev) =>
                  patchCc({ reservedTokens: ev.target.value === "" ? undefined : Number(ev.target.value) || 0 })
                }
              />
            </label>
            <label className={styles.headFld}>
              <span>Offset</span>
              <input
                className={styles.headNum}
                type="number"
                value={cc?.insertionPosition ?? ""}
                placeholder="0"
                aria-label="Insertion offset"
                onChange={(ev) =>
                  patchCc({ insertionPosition: ev.target.value === "" ? undefined : Number(ev.target.value) || 0 })
                }
              />
            </label>
          </div>
          <div className={styles.timeRow2}>
            {(
              [
                ["trimDirection", "Trim", ["doNotTrim", "trimBottom", "trimTop"]],
                ["insertionType", "Join by", ["newline", "space", "token"]],
                ["maximumTrimType", "Trim by", ["sentence", "newline", "token"]],
              ] as const
            ).map(([key, label, known]) => (
              <label key={key} className={styles.headFld}>
                <span>{label}</span>
                <select
                  className={styles.headSel}
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
