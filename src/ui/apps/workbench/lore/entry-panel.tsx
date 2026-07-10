/**
 * LoreEntryPanel - one desk panel for one entry (vs-lorebook-desk-f): head (enabled, title,
 * close), the dial row, keys, position, timing, content, and a fine-control drawer for the
 * profile-gated rest. Hidden fields stay in data; visibility never prunes.
 */
import type { JSX } from "react";
import type { LorebookEntry, SelectiveLogic } from "../../../../entities/lorebook/schema";
import { fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { ToggleSwitch } from "../../../components/toggle-switch";
import { KeywordChips } from "./keyword-chips";
import { PositionPicker } from "./position-picker";

export interface EntryPanelProps {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
  /** close this panel (the entry itself stays in the book) */
  onClose: () => void;
  /** this panel holds the desk focus (accent border; the sidebar quick controls follow it) */
  focused: boolean;
  onFocus: () => void;
  /** rough authoring gauge (core estimateEntryTokens), rendered as "~N tok" */
  tokenEstimate: number;
}

const LOGIC_LABELS: readonly [SelectiveLogic, string][] = [
  ["and_any", "AND any"],
  ["and_all", "AND all"],
  ["not_any", "NOT any"],
  ["not_all", "NOT all"],
];

export function LoreEntryPanel({
  entry,
  writeFor,
  styles,
  onPatch,
  onClose,
  focused,
  onFocus,
  tokenEstimate,
}: EntryPanelProps): JSX.Element {
  const show = (key: Parameters<typeof fieldVisible>[1]): boolean => fieldVisible(writeFor, key);

  return (
    <article
      className={focused ? `${styles.panel} ${styles.panelFocused}` : styles.panel}
      onFocusCapture={onFocus}
      onPointerDownCapture={onFocus}
      aria-label={`Entry panel · ${entry.title || "(untitled)"}`}
    >
      <header className={styles.phead}>
        {show("enabled") && (
          <ToggleSwitch
            on={entry.enabled}
            onChange={(on) => onPatch({ enabled: on })}
            label={entry.enabled ? "entry is on" : "entry is off"}
          />
        )}
        {show("title") && (
          <input
            className={styles.ptitle}
            value={entry.title}
            placeholder="Untitled entry"
            aria-label="Entry title"
            onChange={(ev) => onPatch({ title: ev.target.value })}
          />
        )}
        <button type="button" className={styles.pclose} aria-label="Close panel" onClick={onClose}>
          &times;
        </button>
      </header>

      <div className={styles.controls}>
        {show("constant") && (
          <label className={styles.fld}>
            <span>Mode</span>
            <select
              className={styles.miniSel}
              value={entry.constant ? "constant" : "selective"}
              aria-label="Activation mode"
              onChange={(ev) => onPatch({ constant: ev.target.value === "constant" })}
            >
              <option value="selective">Selective</option>
              <option value="constant">Always on</option>
            </select>
          </label>
        )}
        {show("sortOrder") && (
          <label className={styles.fld}>
            <span>Order</span>
            <input
              className={styles.num}
              type="number"
              value={entry.sortOrder}
              aria-label="Insertion order"
              onChange={(ev) => onPatch({ sortOrder: Number(ev.target.value) || 0 })}
            />
          </label>
        )}
        {show("priority") && (
          <label className={styles.fld}>
            <span>Priority</span>
            <input
              className={styles.num}
              type="number"
              value={entry.priority}
              aria-label="Budget priority"
              onChange={(ev) => onPatch({ priority: Number(ev.target.value) || 0 })}
            />
          </label>
        )}
        {show("scanDepth") && (
          <label className={styles.fld}>
            <span>Scan</span>
            <input
              className={styles.num}
              type="number"
              min={0}
              placeholder="inherit"
              value={entry.scanDepth ?? ""}
              aria-label="Scan depth (blank inherits the book default)"
              onChange={(ev) => {
                const v = ev.target.value;
                onPatch({ scanDepth: v === "" ? null : Number(v) || 0 });
              }}
            />
          </label>
        )}
        <button
          type="button"
          className={entry.ignoreBudget ? `${styles.fldBtn} ${styles.fldHot}` : styles.fldBtn}
          aria-pressed={entry.ignoreBudget}
          title="Preserve: this entry skips the token budget and always survives"
          onClick={() => onPatch({ ignoreBudget: !entry.ignoreBudget })}
        >
          Preserve
        </button>
        {show("probability") && (
          <label className={styles.fld}>
            <span>Chance</span>
            <input
              className={styles.num}
              type="number"
              min={0}
              max={100}
              value={entry.probability}
              aria-label="Activation chance percent"
              onChange={(ev) => onPatch({ probability: Number(ev.target.value) || 0 })}
            />
          </label>
        )}
        <span className={styles.tokest}>~{tokenEstimate} tok</span>
      </div>

      <div className={styles.pbody}>
        {show("triggers") && (
          <>
            <span className={styles.plabel}>Primary keys</span>
            <KeywordChips
              triggers={entry.triggers}
              onChange={(triggers) => onPatch({ triggers })}
              styles={styles}
              ariaLabel="Primary keys"
            />
          </>
        )}
        {show("secondaryTriggers") && (
          <div className={styles.keysRow}>
            {show("selectiveLogic") && (
              <select
                className={styles.miniSel}
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
            )}
            <KeywordChips
              triggers={entry.secondaryTriggers}
              onChange={(secondaryTriggers) => onPatch({ secondaryTriggers })}
              styles={styles}
              placeholder="secondary (optional)…"
              ariaLabel="Secondary keys"
            />
          </div>
        )}

        {show("position") && (
          <>
            <span className={styles.plabel}>Injection position</span>
            <PositionPicker
              position={entry.position}
              depth={entry.depth}
              role={entry.role}
              showDepth={show("depth")}
              showRole={show("role")}
              styles={styles}
              onPatch={onPatch}
            />
          </>
        )}

        {(show("sticky") || show("cooldown") || show("delay") || show("recursion") || show("groupName")) && (
          <>
            <span className={styles.plabel}>Timing</span>
            <div className={styles.timeRow}>
              {show("sticky") && (
                <label className={styles.fld}>
                  <span>Sticky</span>
                  <input
                    className={styles.num}
                    type="number"
                    min={0}
                    value={entry.sticky}
                    aria-label="Sticky messages"
                    onChange={(ev) => onPatch({ sticky: Number(ev.target.value) || 0 })}
                  />
                </label>
              )}
              {show("cooldown") && (
                <label className={styles.fld}>
                  <span>Cool</span>
                  <input
                    className={styles.num}
                    type="number"
                    min={0}
                    value={entry.cooldown}
                    aria-label="Cooldown messages"
                    onChange={(ev) => onPatch({ cooldown: Number(ev.target.value) || 0 })}
                  />
                </label>
              )}
              {show("delay") && (
                <label className={styles.fld}>
                  <span>Delay</span>
                  <input
                    className={styles.num}
                    type="number"
                    min={0}
                    value={entry.delay}
                    aria-label="Delay messages"
                    onChange={(ev) => onPatch({ delay: Number(ev.target.value) || 0 })}
                  />
                </label>
              )}
              {show("recursion") && (
                <>
                  <button
                    type="button"
                    className={entry.excludeRecursion ? `${styles.fldBtn} ${styles.fldOn}` : styles.fldBtn}
                    aria-pressed={entry.excludeRecursion}
                    title="Only direct matches can find this entry"
                    onClick={() => onPatch({ excludeRecursion: !entry.excludeRecursion })}
                  >
                    No recursion in
                  </button>
                  <button
                    type="button"
                    className={entry.preventRecursion ? `${styles.fldBtn} ${styles.fldOn}` : styles.fldBtn}
                    aria-pressed={entry.preventRecursion}
                    title="This entry's content never triggers other entries"
                    onClick={() => onPatch({ preventRecursion: !entry.preventRecursion })}
                  >
                    No recursion out
                  </button>
                </>
              )}
              {show("groupName") && (
                <label className={styles.fld}>
                  <span>Group</span>
                  <input
                    className={styles.groupIn}
                    value={entry.groupName ?? ""}
                    placeholder="none"
                    aria-label="Inclusion group"
                    onChange={(ev) => onPatch({ groupName: ev.target.value || null })}
                  />
                </label>
              )}
            </div>
          </>
        )}

        {show("content") && (
          <>
            <span className={styles.plabel}>Content</span>
            <textarea
              className={styles.textarea}
              value={entry.content}
              aria-label="Entry content"
              onChange={(ev) => onPatch({ content: ev.target.value })}
            />
          </>
        )}

        <details className={styles.details}>
          <summary className={styles.label}>Fine control (profile-gated · hidden fields stay in data)</summary>
          {show("scanSources") && (
            <div className={styles.tools}>
              {(
                [
                  ["scanCharacterDescription", "Scan description"],
                  ["scanCharacterPersonality", "Scan personality"],
                  ["scanUserPersona", "Scan persona"],
                  ["scanScenario", "Scan scenario"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className={styles.chip}>
                  <input
                    type="checkbox"
                    checked={entry[key]}
                    onChange={(ev) => onPatch({ [key]: ev.target.checked })}
                  />{" "}
                  {label}
                </label>
              ))}
            </div>
          )}
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
          {show("categoryId") && (
            <label className={styles.field}>
              <span className={styles.label}>Category id</span>
              <input
                className={styles.input}
                value={entry.categoryId ?? ""}
                onChange={(ev) => onPatch({ categoryId: ev.target.value || null })}
              />
            </label>
          )}
          {show("contextConfig") && (
            <>
              <label className={styles.field}>
                <span className={styles.label}>Context prefix</span>
                <input
                  className={styles.input}
                  value={entry.contextConfig?.prefix ?? ""}
                  onChange={(ev) =>
                    onPatch({
                      contextConfig: { ...entry.contextConfig, prefix: ev.target.value || undefined },
                    })
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Context suffix</span>
                <input
                  className={styles.input}
                  value={entry.contextConfig?.suffix ?? ""}
                  onChange={(ev) =>
                    onPatch({
                      contextConfig: { ...entry.contextConfig, suffix: ev.target.value || undefined },
                    })
                  }
                />
              </label>
            </>
          )}
          {show("automationId") && (
            <label className={styles.field}>
              <span className={styles.label}>Automation id</span>
              <input
                className={styles.input}
                value={entry.automationId ?? ""}
                onChange={(ev) => onPatch({ automationId: ev.target.value || null })}
              />
            </label>
          )}
          {show("sideEffects") && entry.sideEffects && (
            <p className={styles.chip}>
              Side effects: {entry.sideEffects.effects.length} declared (opaque; not executed in Studio)
            </p>
          )}
        </details>
      </div>
    </article>
  );
}
