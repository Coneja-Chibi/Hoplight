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

  return (
    <>
      {show("scanSources") && (
        <>
          <span className={styles.plabel}>Also scan these for keys</span>
          <div className={styles.timeRow2}>
            {SCAN_KEYS.map(([key, label]) => (
              <label key={key} className={styles.chip}>
                <input
                  type="checkbox"
                  checked={entry[key] === true}
                  onChange={(ev) => onPatch({ [key]: ev.target.checked })}
                />{" "}
                {label}
              </label>
            ))}
          </div>
        </>
      )}
      {(show("vectorized") || show("groupTuning")) && (
        <div className={styles.timeRow2}>
          {show("vectorized") && (
            <label className={styles.chip}>
              <input
                type="checkbox"
                checked={entry.vectorized === true}
                onChange={(ev) => onPatch({ vectorized: ev.target.checked })}
              />{" "}
              Vectorized (RAG)
            </label>
          )}
          {show("groupTuning") && (
            <>
              <button
                type="button"
                className={entry.groupOverride === true ? `${styles.fldBtn} ${styles.fldOn}` : styles.fldBtn}
                aria-pressed={entry.groupOverride === true}
                title="This entry always wins its inclusion group"
                onClick={() => onPatch({ groupOverride: entry.groupOverride === true ? undefined : true })}
              >
                Group override
              </button>
              <button
                type="button"
                className={entry.useGroupScoring === true ? `${styles.fldBtn} ${styles.fldOn}` : styles.fldBtn}
                aria-pressed={entry.useGroupScoring === true}
                title="Pick the group winner by match score instead of weight"
                onClick={() => onPatch({ useGroupScoring: entry.useGroupScoring === true ? undefined : true })}
              >
                Group scoring
              </button>
            </>
          )}
        </div>
      )}
      {(show("displayIndex") || show("automationId")) && (
        <div className={styles.timeRow2}>
          {show("displayIndex") && (
            <label className={styles.headFld} title="SillyTavern's cosmetic list order (not placement)">
              <span>List index</span>
              <input
                className={styles.headNum}
                type="number"
                value={entry.displayIndex ?? ""}
                placeholder="—"
                aria-label="List display index (blank follows order)"
                onChange={(ev) => {
                  const v = ev.target.value;
                  onPatch({ displayIndex: v === "" ? null : Number(v) || 0 });
                }}
              />
            </label>
          )}
          {show("automationId") && (
            <label className={styles.headFld} title="Bind this entry to a Quick Reply automation">
              <span>Automation id</span>
              <input
                className={styles.groupIn}
                value={entry.automationId ?? ""}
                aria-label="Automation id"
                onChange={(ev) => onPatch({ automationId: ev.target.value || null })}
              />
            </label>
          )}
        </div>
      )}
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
