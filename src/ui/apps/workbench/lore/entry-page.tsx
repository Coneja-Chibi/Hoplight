/**
 * LoreEntryPage - one entry, the whole stage (vs-lorebook-binder-2, 1:1). Masthead with the
 * pager and on/off, then the dossier cards: Keys, Placement (one row), The passage, Timing &
 * chance folded with an honest summary, and the self-styled Fine control drawer. Profile lens
 * hides off-target controls; data stays.
 */
import type { JSX } from "react";
import type { LorebookEntry, SelectiveLogic } from "../../../../entities/lorebook/schema";
import { fieldVisible, positionsForProfile, type LoreWriteForProfile } from "../../../../core/lore";
import { TriggerEditor } from "./trigger-editor";
import { PositionPicker } from "./position-picker";
import { cardsForLens } from "./platforms/registry";

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

/** the masthead's italic line: an honest computed sentence, never a stored field */
function firesLine(entry: LorebookEntry): string {
  if (entry.constant) return "Always on - it speaks in every scene.";
  const words = entry.triggers.map((t) => t.keyword).filter(Boolean);
  if (words.length === 0) return "No keys yet - it never fires.";
  const shown = words.slice(0, 5).join(", ");
  return `Fires on: ${shown}${words.length > 5 ? ` and ${words.length - 5} more` : ""}.`;
}

/** the Timing & chance fold's honest summary of what it currently hides */
function timingLine(entry: LorebookEntry): string {
  const parts: string[] = [];
  if (entry.sticky > 0) parts.push(`sticks for ${entry.sticky}`);
  if (entry.cooldown > 0) parts.push(`cools down ${entry.cooldown}`);
  if (entry.delay > 0) parts.push(`waits ${entry.delay} messages`);
  if (entry.preventRecursion) parts.push("never triggers others");
  if (entry.delayUntilRecursion > 0) parts.push(`waits for recursion ${entry.delayUntilRecursion}`);
  if (entry.groupName) parts.push(`in group "${entry.groupName}"`);
  if (parts.length === 0) return "Fires every time, immediately. Open to add stickiness, cooldowns, or recursion rules.";
  return `Currently: ${parts.join(" · ")}.`;
}

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
    <div className={styles.page} aria-label={`Entry · ${entry.title || "(untitled)"}`}>
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
      <p className={styles.entryLine}>{firesLine(entry)}</p>

      {/* ---- Keys ---- */}
      {show("triggers") && (
        <section className={styles.bcard} aria-label="Keys">
          <div className={styles.bchead}>
            <b>Keys</b>
            <i>when this entry speaks</i>
            {show("constant") && (
              <select
                className={styles.headSel}
                value={entry.constant ? "constant" : "keyed"}
                aria-label="Activation mode"
                onChange={(ev) => onPatch({ constant: ev.target.value === "constant" })}
              >
                <option value="keyed">Keyword-fired</option>
                <option value="constant">Always on</option>
              </select>
            )}
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
            {entry.constant && (
              <p className={styles.cardHint}>Always on - the keys below are kept but not needed.</p>
            )}
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
                        onChange={(ev) => onPatch({ selectiveLogic: ev.target.value as SelectiveLogic })}
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
          </div>
        </section>
      )}

      {/* ---- Timing & chance: directly under Keys (it shapes WHEN the keys fire) ---- */}
      {(show("sticky") || show("cooldown") || show("delay") || show("recursion") || show("groupName")) && (
        <details className={styles.bfold}>
          <summary className={styles.bchead}>
            <b>Timing &amp; chance</b>
            <i>folded until you need it</i>
          </summary>
          <div className={styles.bcbody}>
            <p className={styles.foldNote}>{timingLine(entry)}</p>
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
                    aria-label="Cooldown messages"
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
                      className={recursionMode === mode ? `${styles.seg} ${styles.segOn}` : styles.seg}
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
                      onChange={(ev) => onPatch({ delayUntilRecursion: Number(ev.target.value) || 1 })}
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
        </details>
      )}

      {/* ---- Placement: ONE row of pills ---- */}
      {show("position") && (
        <section className={styles.bcard} aria-label="Placement">
          <div className={styles.bchead}>
            <b>Placement</b>
            <i>where it lands in the prompt</i>
          </div>
          <div className={styles.bcbody}>
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
        </section>
      )}

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
              {entry.content.length} chars · ~{tokenEstimate} tokens
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

      {/* ---- Platform cards: one platform, one card, one def file (the character editor's
           native-fields doctrine) - surfaced by the active lens; Vaude shows them all ---- */}
      {cardsForLens(writeFor).map((card) => (
        <details key={card.id} className={styles.bfold}>
          <summary className={styles.bchead}>
            <b>{card.label}</b>
            <i>platform extras · kept on every export</i>
          </summary>
          <div className={styles.bcbody}>
            <card.Component entry={entry} show={show} styles={styles} onPatch={onPatch} />
          </div>
        </details>
      ))}
    </div>
  );
}
