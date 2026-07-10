/**
 * SillyTavern's lore long tail (its own card - never smushed with Chub or Lumiverse): the six
 * extra scan sources, RAG vectorization, group override/scoring, the cosmetic display index, the
 * automation binding, and the character filter. Codec: formats/sillytavern/lorebook.ts.
 */
import type { JSX } from "react";
import type { LorePlatformCard, LorePlatformCardProps } from "./card-contract";
import { CharacterFilterBlock } from "./filter-block";

const SCAN_KEYS = [
  ["scanCharacterDescription", "Description"],
  ["scanCharacterPersonality", "Personality"],
  ["scanUserPersona", "Persona"],
  ["scanScenario", "Scenario"],
  ["scanCharacterDepthPrompt", "Depth prompt"],
  ["scanCreatorNotes", "Creator notes"],
] as const;

function Component({ entry, show, styles, onPatch }: LorePlatformCardProps): JSX.Element | null {
  const any =
    show("scanSources") || show("vectorized") || show("groupTuning") || show("displayIndex") ||
    show("automationId") || show("characterFilter");
  if (!any) return null;

  const switchRow = (
    label: string,
    on: boolean,
    title: string,
    flip: () => void,
  ): JSX.Element => (
    <div className={styles.pcRow}>
      <span className={styles.pcK}>{label}</span>
      <button
        type="button"
        className={on ? styles.pcSwitch : `${styles.pcSwitch} ${styles.pcSwitchOff}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        title={title}
        onClick={flip}
      />
    </div>
  );

  return (
    <>
      {show("scanSources") && (
        <div className={styles.pcSection}>
          <span className={styles.pcLabel}>Also scan these for keys</span>
          <div className={styles.pcChecks}>
            {SCAN_KEYS.map(([key, label]) => (
              <label key={key} className={styles.pcCheck}>
                <input
                  type="checkbox"
                  checked={entry[key] === true}
                  onChange={(ev) => onPatch({ [key]: ev.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className={styles.pcSection}>
        <span className={styles.pcLabel}>Search &amp; groups</span>
        {show("vectorized") &&
          switchRow("Vectorized (RAG)", entry.vectorized === true, "Match by embedding similarity, not keywords", () =>
            onPatch({ vectorized: entry.vectorized === true ? undefined : true }),
          )}
        {show("groupTuning") && (
          <>
            {switchRow("Group override", entry.groupOverride === true, "This entry always wins its inclusion group", () =>
              onPatch({ groupOverride: entry.groupOverride === true ? undefined : true }),
            )}
            {switchRow(
              "Group scoring",
              entry.useGroupScoring === true,
              "Pick the group winner by match score instead of weight",
              () => onPatch({ useGroupScoring: entry.useGroupScoring === true ? undefined : true }),
            )}
          </>
        )}
        {show("displayIndex") && (
          <div className={styles.pcRow}>
            <span className={styles.pcK}>List index (cosmetic)</span>
            <input
              className={styles.pcNum}
              type="number"
              value={entry.displayIndex ?? ""}
              placeholder="—"
              aria-label="List display index (blank follows order)"
              onChange={(ev) => {
                const v = ev.target.value;
                onPatch({ displayIndex: v === "" ? null : Number(v) || 0 });
              }}
            />
          </div>
        )}
        {show("automationId") && (
          <div className={styles.pcRow}>
            <span className={styles.pcK}>Automation id</span>
            <input
              className={styles.pcText}
              value={entry.automationId ?? ""}
              aria-label="Automation id"
              onChange={(ev) => onPatch({ automationId: ev.target.value || null })}
            />
          </div>
        )}
      </div>
      {show("characterFilter") && <CharacterFilterBlock entry={entry} styles={styles} onPatch={onPatch} />}
    </>
  );
}

const card: LorePlatformCard = {
  id: "sillytavern",
  label: "SillyTavern",
  lenses: ["sillytavern"],
  Component,
};

export default card;
