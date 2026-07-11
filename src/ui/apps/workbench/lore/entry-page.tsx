/**
 * LoreEntryPage - one entry, the whole stage. Masthead with pager and on/off, then dossier
 * cards: Keys; one open When & where island (timing/chance + placement, not separate folds);
 * The passage; creator note + platform extras. Profile lens hides off-target controls; data stays.
 */
import type { JSX } from "react";
import type { LorebookEntry, SelectiveLogic } from "../../../../entities/lorebook/schema";
import { fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { TriggerEditor } from "./trigger-editor";
import { cardsForLens } from "./platforms/registry";
import { entryFireMode } from "./entry-fire-mode";
import { EntryWhenWhere } from "./entry-when-where";

export type { EntryFireMode } from "./entry-fire-mode";
export { entryFireMode, fireModePatch } from "./entry-fire-mode";

export interface EntryPageProps {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
  /** 0-based position among visible entries + the total, for the "Entry N of M" pager */
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  tokenEstimate: number;
}

const LOGIC_LABELS: readonly [SelectiveLogic, string][] = [
  ["and_any", "AND any"],
  ["and_all", "AND all"],
  ["not_any", "NOT any"],
  ["not_all", "NOT all"],
];

const insertMacro = (content: string, token: string): string => {
  if (!content) return token;
  const needsSpace = !/\s$/.test(content);
  return needsSpace ? `${content} ${token}` : content + token;
};

export function LoreEntryPage({
  entry,
  writeFor,
  styles,
  onPatch,
  index,
  count,
  onPrev,
  onNext,
  tokenEstimate,
}: EntryPageProps): JSX.Element {
  const show = (key: Parameters<typeof fieldVisible>[1]): boolean => fieldVisible(writeFor, key);
  const advanced = show("triggerRiders") && entry.triggerMode === "advanced";
  const simpleMode = !advanced;

  return (
    <div className={styles.page} aria-label={`Entry Â· ${entry.title || "(untitled)"}`}>
      {/* ---- masthead: the entry owns the stage ---- */}
      <div className={styles.pager}>
        <span className={styles.pageNo}>
          Entry {index + 1} of {count}
        </span>
        <button type="button" className={styles.pgBtn} aria-label="Previous entry" disabled={index <= 0} onClick={onPrev}>
          &#8249;
        </button>
        <button
          type="button"
          className={styles.pgBtn}
          aria-label="Next entry"
          disabled={index >= count - 1}
          onClick={onNext}
        >
          &#8250;
        </button>
        <span className={styles.pgFill} />
        <span className={styles.tokchip}>~{tokenEstimate} tokens</span>
        {show("enabled") && (
          <button
            type="button"
            className={entry.enabled ? styles.onoff : `${styles.onoff} ${styles.onoffOff}`}
            aria-pressed={entry.enabled}
            title={entry.enabled ? "This entry is on" : "This entry is off"}
            onClick={() => onPatch({ enabled: !entry.enabled })}
          >
            &#9679; {entry.enabled ? "On" : "Off"}
          </button>
        )}
      </div>
      {show("title") && (
        <input
          className={styles.entryName}
          value={entry.title}
          placeholder="Untitled entry"
          aria-label="Entry title"
          onChange={(ev) => onPatch({ title: ev.target.value })}
        />
      )}

      {/* ---- Keys ---- */}
      {show("triggers") && (
        <section className={styles.bcard} aria-label="Keys">
          <div className={styles.bchead}>
            <b>Keys</b>
            <i>when this entry speaks</i>
            {show("triggerRiders") && (
              <span className={styles.bcheadActs}>
                <button
                  type="button"
                  className={simpleMode ? `${styles.modeTab} ${styles.modeOn}` : styles.modeTab}
                  aria-pressed={simpleMode}
                  onClick={() => onPatch({ triggerMode: "simple" })}
                >
                  Simple
                </button>
                <button
                  type="button"
                  className={!simpleMode ? `${styles.modeTab} ${styles.modeOn}` : styles.modeTab}
                  aria-pressed={!simpleMode}
                  onClick={() => onPatch({ triggerMode: "advanced" })}
                >
                  Advanced
                </button>
              </span>
            )}
          </div>
          <div className={styles.bcbody}>
            {entryFireMode(entry) !== "keyed" ? (
              <p className={styles.sleepNote}>
                {entryFireMode(entry) === "always"
                  ? "Always on - keys are kept but not needed for this entry to fire."
                  : "By meaning - keys are kept but this entry fires on similarity, not exact words."}
              </p>
            ) : (
              <div className={styles.keysSplit}>
                <div className={styles.keysCol}>
                  <span className={styles.plabel}>Primary keys</span>
                  <TriggerEditor
                    triggers={entry.triggers}
                    onChange={(triggers) => onPatch({ triggers })}
                    styles={styles}
                    advanced={advanced}
                    ariaLabel="Primary keys"
                    showSpecials={show("specialTriggers")}
                    entryProbability={entry.probability}
                  />
                </div>
                {show("secondaryTriggers") && (
                  <>
                    {show("selectiveLogic") && (
                      <div className={styles.logicCol}>
                        <span className={styles.logicSpacer} aria-hidden="true">
                          &nbsp;
                        </span>
                        <select
                          className={styles.logicSel}
                          value={entry.selectiveLogic}
                          aria-label="How secondary keys combine"
                          onChange={(ev) =>
                            onPatch({ selectiveLogic: ev.target.value as SelectiveLogic })
                          }
                        >
                          {LOGIC_LABELS.map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className={styles.keysCol}>
                      <span className={styles.plabel}>Only together with (optional)</span>
                      <TriggerEditor
                        triggers={entry.secondaryTriggers}
                        onChange={(secondaryTriggers) => onPatch({ secondaryTriggers })}
                        styles={styles}
                        advanced={advanced}
                        placeholder="a second word that must also appear…"
                        ariaLabel="Secondary keys"
                        entryProbability={entry.probability}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            {show("matchOverrides") && (
              <div className={styles.matchRow} role="group" aria-label="Matching overrides">
                <span className={styles.plabel}>Matching</span>
                <button
                  type="button"
                  className={styles.matchSeg}
                  title="Override book default for whole-word matching"
                  onClick={() => {
                    const v = entry.matchWholeWords;
                    const next = v === null ? true : v ? false : null;
                    onPatch({ matchWholeWords: next });
                  }}
                >
                  Whole words ·{" "}
                  {entry.matchWholeWords === null
                    ? "inherit"
                    : entry.matchWholeWords
                      ? "on"
                      : "off"}
                </button>
                <button
                  type="button"
                  className={styles.matchSeg}
                  title="Override book default for case sensitivity"
                  onClick={() => {
                    const v = entry.caseSensitive;
                    const next = v === null ? true : v ? false : null;
                    onPatch({ caseSensitive: next });
                  }}
                >
                  Case ·{" "}
                  {entry.caseSensitive === null
                    ? "inherit"
                    : entry.caseSensitive
                      ? "on"
                      : "off"}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <EntryWhenWhere entry={entry} writeFor={writeFor} styles={styles} onPatch={onPatch} />

      {/* ---- The passage ---- */}
      {show("content") && (
        <section className={styles.bcard} aria-label="The passage">
          <div className={styles.bchead}>
            <b>The passage</b>
            <i>what the model learns</i>
            <span className={styles.bcheadActs}>
              <button
                type="button"
                className={styles.macro}
                title="Insert {{user}}"
                onClick={() => onPatch({ content: insertMacro(entry.content, "{{user}}") })}
              >
                {"{{user}}"}
              </button>
              <button
                type="button"
                className={styles.macro}
                title="Insert {{char}}"
                onClick={() => onPatch({ content: insertMacro(entry.content, "{{char}}") })}
              >
                {"{{char}}"}
              </button>
            </span>
          </div>
          <div className={styles.bcbody}>
            <textarea
              className={styles.passageTa}
              value={entry.content}
              aria-label="Entry content"
              onChange={(ev) => onPatch({ content: ev.target.value })}
            />
            <span className={styles.countRight}>
              {entry.content.length} chars Â· ~{tokenEstimate} tokens
            </span>
          </div>
        </section>
      )}

      {/* ---- Creator note: yours, never the model's ---- */}
      {show("comment") && (
        <details className={styles.bfold}>
          <summary className={styles.bchead}>
            <b>Creator note</b>
            <i>never sent to the model</i>
          </summary>
          <div className={styles.bcbody}>
            <textarea
              className={styles.textarea}
              value={entry.comment ?? ""}
              aria-label="Creator note"
              onChange={(ev) => onPatch({ comment: ev.target.value || null })}
            />
          </div>
        </details>
      )}

      {/* ---- Platform cards: one host, one file; minor host color on rail/dot/on-state ---- */}
      {cardsForLens(writeFor).map((card) => {
        const host =
          card.id === "sillytavern"
            ? styles.pcHostSt
            : card.id === "rolecall"
              ? styles.pcHostRc
              : card.id === "novelai"
                ? styles.pcHostNai
                : card.id === "risu"
                  ? styles.pcHostRisu
                  : "";
        return (
          <details
            key={card.id}
            className={[styles.bfold, styles.pcHost, host, styles.pcShell].filter(Boolean).join(" ")}
          >
            <summary className={styles.bchead}>
              <span className={styles.pcHostDot} aria-hidden="true" />
              <b>{card.label}</b>
              <i>platform extras · kept on every export</i>
            </summary>
            <div className={styles.bcbody}>
              <card.Component entry={entry} show={show} styles={styles} onPatch={onPatch} />
            </div>
          </details>
        );
      })}
    </div>
  );
}
