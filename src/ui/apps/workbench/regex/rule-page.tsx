/**
 * RulePage - one rule owning the page (design/vs-regex-editor.html .page). THREE MODES, big switch at
 * the top, never hidden: Guided (baby's first, the quiz-card grammar), Plain words (RC's example-driven
 * builder), and Pattern (raw find / flags / replace with a live plain-words readback). Mode is a VIEW;
 * find/flags/replace on the rule are the single source of truth, so switching is lossless. The initial
 * mode is derived from the rule (an empty or words-decompilable rule opens in Plain words; an advanced
 * pattern opens in Pattern). The `replace` string is only ever plain text here - never innerHTML.
 */
import { useState, type JSX } from "react";
import type { RegexRule } from "../../../../entities/regex/schema";
import {
  decompileWordsState,
  explainPattern,
  travelLint,
  type RegexWriteForProfile,
} from "../../../../core/regex";
import { doesLine } from "./does-line";
import { PhasePicker } from "./phase-picker";
import { FinePrint } from "./fine-print";
import { ModeWords } from "./mode-words";
import { ModeGuided } from "./mode-guided";

export interface RulePageProps {
  rule: RegexRule;
  rules: readonly RegexRule[];
  writeFor: RegexWriteForProfile;
  index: number;
  count: number;
  styles: Readonly<Record<string, string>>;
  onPrev: () => void;
  onNext: () => void;
  onPatch: (patch: Partial<RegexRule>) => void;
}

type Mode = "guided" | "words" | "pattern";

/** Open a words-shaped or empty rule in Plain words; anything past the builder's grammar in Pattern. */
function initialMode(rule: RegexRule): Mode {
  if (rule.find.trim() === "") return "words";
  return decompileWordsState(rule.find, rule.flags) !== null ? "words" : "pattern";
}

export function RulePage({
  rule,
  rules,
  writeFor,
  index,
  count,
  styles,
  onPrev,
  onNext,
  onPatch,
}: RulePageProps): JSX.Element {
  const [mode, setMode] = useState<Mode>(() => initialMode(rule));
  const explained = explainPattern(rule.find, rule.flags);
  const travel = travelLint(rule, writeFor);
  // "All three edit the same rule" holds whenever Plain words can decompile the pattern (the full
  // tune-grid grammar, not just the simple-shape `complete` check). Only a truly foreign pattern -
  // one the words builder cannot round-trip - gets the honest "beyond the builder's grammar" note.
  const wordsEditable = rule.find.trim() === "" || decompileWordsState(rule.find, rule.flags) !== null;
  const modeNote = wordsEditable
    ? "all three edit the same rule; switch any time"
    : "this pattern is beyond the builder's grammar; words view shows the parts it knows";

  const togglePhase = (phase: RegexRule["phases"][number]): void => {
    const has = rule.phases.includes(phase);
    onPatch({
      phases: has ? rule.phases.filter((p) => p !== phase) : [...rule.phases, phase],
    });
  };

  const modeButton = (m: Mode, label: string): JSX.Element => (
    <button
      type="button"
      className={mode === m ? `${styles.md} ${styles.mdOn}` : styles.md}
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pager}>
        <span className={styles.pageNo}>
          Rule {index + 1} of {count}
        </span>
        <button
          type="button"
          className={styles.pgBtn}
          aria-label="Previous rule"
          disabled={index <= 0}
          onClick={onPrev}
        >
          &#8249;
        </button>
        <button
          type="button"
          className={styles.pgBtn}
          aria-label="Next rule"
          disabled={index >= count - 1}
          onClick={onNext}
        >
          &#8250;
        </button>
        <span className={styles.fill} />
        <button
          type="button"
          className={rule.enabled ? styles.onoff : `${styles.onoff} ${styles.onoffOff}`}
          aria-pressed={rule.enabled}
          onClick={() => onPatch({ enabled: !rule.enabled })}
        >
          {rule.enabled ? "● On" : "○ Off"}
        </button>
      </div>

      <input
        className={styles.ruleName}
        value={rule.label}
        placeholder="Name this rule"
        aria-label="Rule name"
        onChange={(e) => onPatch({ label: e.target.value })}
      />
      <p className={styles.doesLine}>{doesLine(rule)}</p>

      {/* the mode switch: all three edit the same rule */}
      <div className={styles.modeBar}>
        <span className={styles.modeSet} role="group" aria-label="Authoring mode">
          {modeButton("guided", "Guided")}
          {modeButton("words", "Plain words")}
          {modeButton("pattern", "Pattern")}
        </span>
        {mode !== "guided" && <span className={styles.modeNote}>{modeNote}</span>}
      </div>

      {mode === "guided" ? (
        <ModeGuided
          rule={rule}
          writeFor={writeFor}
          styles={styles}
          onPatch={onPatch}
          onEscape={() => setMode("pattern")}
        />
      ) : (
        <>
          {/* Find */}
          <div className={styles.card}>
            <div className={styles.chead}>
              <b className={styles.cheadB}>Find</b>
              {mode === "words" ? (
                <i className={styles.cheadI}>show it what to match - it writes the pattern</i>
              ) : (
                <>
                  <i className={styles.cheadI}>pattern &middot; flags</i>
                  <button
                    type="button"
                    className={styles.escBtn}
                    disabled
                    title="Escape helper comes in a later slice"
                  >
                    Escape a literal&hellip;
                  </button>
                </>
              )}
            </div>
            <div className={styles.cbody}>
              {mode === "words" ? (
                <ModeWords rule={rule} styles={styles} onPatch={onPatch} />
              ) : (
                <>
                  <div className={styles.patRow}>
                    <input
                      className={styles.patIn}
                      value={rule.find}
                      placeholder="the pattern to match"
                      aria-label="Find pattern"
                      spellCheck={false}
                      onChange={(e) => onPatch({ find: e.target.value })}
                    />
                    <input
                      className={styles.patIn}
                      value={rule.flags}
                      placeholder="flags"
                      aria-label="Regex flags"
                      spellCheck={false}
                      onChange={(e) => onPatch({ flags: e.target.value })}
                    />
                  </div>
                  <div className={styles.readback}>
                    {rule.find.trim() === "" ? (
                      "Type or paste a pattern above; its plain-words reading appears here."
                    ) : explained.reading ? (
                      <>
                        In words: {explained.reading}
                        {!explained.complete && (
                          <span className={styles.readbackPartial}>
                            Some parts are beyond the plain-words builder.
                          </span>
                        )}
                      </>
                    ) : (
                      "This pattern uses forms the reader cannot describe yet."
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Replace */}
          <div className={styles.card}>
            <div className={styles.chead}>
              <b className={styles.cheadB}>Replace with</b>
              <i className={styles.cheadI}>empty = remove it</i>
            </div>
            <div className={styles.cbody}>
              <input
                className={styles.patIn}
                value={rule.replace}
                placeholder="(removes the match)"
                aria-label="Replacement text"
                spellCheck={false}
                onChange={(e) => onPatch({ replace: e.target.value })}
              />
            </div>
          </div>

          {/* Where it runs */}
          <div className={styles.card}>
            <div className={styles.chead}>
              <b className={styles.cheadB}>Where it runs</b>
              <i className={styles.cheadI}>phases this lens can carry</i>
            </div>
            <div className={styles.cbody}>
              <PhasePicker phases={rule.phases} writeFor={writeFor} styles={styles} onToggle={togglePhase} />
              <p className={styles.phaseHint}>
                Under a platform lens, phases that wire cannot carry disappear; a foreign phase already set
                shows dashed amber.
              </p>
              {travel.length > 0 && (
                <div className={styles.travelWrap}>
                  {travel.map((note, i) => (
                    <p key={`${note.feature}-${i}`} className={styles.travelNote}>
                      {note.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <FinePrint rule={rule} rules={rules} writeFor={writeFor} styles={styles} onPatch={onPatch} />
        </>
      )}
    </div>
  );
}
