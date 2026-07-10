/**
 * NovelAI's lore long tail: activation flags (key-relative, non-story) and the full context
 * assembly dials, in the card row grammar. Codec: formats/novelai/lorebook.ts.
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

  const numRow = (
    label: string,
    key: "tokenBudget" | "reservedTokens" | "insertionPosition",
    placeholder: string,
  ): JSX.Element => (
    <div className={styles.pcRow}>
      <span className={styles.pcK}>{label}</span>
      <input
        className={styles.pcNum}
        type="number"
        value={cc?.[key] ?? ""}
        placeholder={placeholder}
        aria-label={label}
        onChange={(ev) => patchCc({ [key]: ev.target.value === "" ? undefined : Number(ev.target.value) || 0 })}
      />
    </div>
  );

  return (
    <>
      {show("naiActivation") && (
        <div className={styles.pcSection}>
          <span className={styles.pcLabel}>Activation</span>
          <div className={styles.pcRow}>
            <span className={styles.pcK}>Keys match near the entry</span>
            <button
              type="button"
              className={entry.keyRelative === true ? styles.pcSwitch : `${styles.pcSwitch} ${styles.pcSwitchOff}`}
              role="switch"
              aria-checked={entry.keyRelative === true}
              aria-label="Keys match near the entry"
              onClick={() => onPatch({ keyRelative: entry.keyRelative === true ? undefined : true })}
            />
          </div>
          <div className={styles.pcRow}>
            <span className={styles.pcK}>Can activate outside story text</span>
            <button
              type="button"
              className={
                entry.nonStoryActivatable === true ? styles.pcSwitch : `${styles.pcSwitch} ${styles.pcSwitchOff}`
              }
              role="switch"
              aria-checked={entry.nonStoryActivatable === true}
              aria-label="Can activate outside story text"
              onClick={() => onPatch({ nonStoryActivatable: entry.nonStoryActivatable === true ? undefined : true })}
            />
          </div>
        </div>
      )}
      {show("contextConfig") && (
        <div className={styles.pcSection}>
          <span className={styles.pcLabel}>Context assembly</span>
          <div className={styles.pcRow}>
            <span className={styles.pcK}>Prefix</span>
            <input
              className={styles.pcText}
              value={cc?.prefix ?? ""}
              aria-label="Context prefix"
              onChange={(ev) => patchCc({ prefix: ev.target.value || undefined })}
            />
          </div>
          <div className={styles.pcRow}>
            <span className={styles.pcK}>Suffix</span>
            <input
              className={styles.pcText}
              value={cc?.suffix ?? ""}
              aria-label="Context suffix"
              onChange={(ev) => patchCc({ suffix: ev.target.value || undefined })}
            />
          </div>
          {numRow("Token cap", "tokenBudget", "—")}
          {numRow("Reserved tokens", "reservedTokens", "0")}
          {numRow("Insertion offset", "insertionPosition", "0")}
          {(
            [
              ["trimDirection", "Trim direction", ["doNotTrim", "trimBottom", "trimTop"]],
              ["insertionType", "Join by", ["newline", "space", "token"]],
              ["maximumTrimType", "Trim by", ["sentence", "newline", "token"]],
            ] as const
          ).map(([key, label, known]) => (
            <div key={key} className={styles.pcRow}>
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
            </div>
          ))}
        </div>
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
