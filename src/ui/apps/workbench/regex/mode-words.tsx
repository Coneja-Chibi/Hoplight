/**
 * Plain-words mode Find body (design/vs-regex-editor.html wire 1 + 1.5, transcribed): the sub-mode
 * switch, then RC's example-driven builder. "Match these words" = family analysis, optimize chip,
 * odd-one-out warning, the tune grid, the built pattern shown plainly, its reading, and
 * execution-verified hit/miss chips. "Match by example" (example-mode.tsx) wears RC's exact readout.
 *
 * MODE IS A VIEW: find/flags on the rule are the single source of truth. This body seeds its local
 * builder state ONCE from the rule (decompileWordsState), then pushes derived find/flags out on every
 * edit; it never re-derives from the rule prop mid-edit and never overwrites the rule on mount, so an
 * advanced pattern opened here is preserved until the author actually types. The pattern is rendered
 * as plain text only - never innerHTML.
 */
import { useMemo, useState, type JSX } from "react";
import type { RegexRule } from "../../../../entities/regex/schema";
import {
  buildFromExamples,
  buildWordsPattern,
  decompileWordsState,
  EMPTY_WORDS_STATE,
  readoutFor,
  type WordsBuilderState,
} from "../../../../core/regex";
import { mulberry32 } from "../../../../core/lore/rng";
import { ExampleMode } from "./example-mode";

export interface ModeWordsProps {
  rule: RegexRule;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<RegexRule>) => void;
}

type SubMode = "words" | "example";

/** Deterministic seed from a pattern so example chips stay stable across renders. */
export const seedFrom = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export function ModeWords({ rule, styles, onPatch }: ModeWordsProps): JSX.Element {
  // Seed once from the rule; a pattern outside the words grammar seeds empty (partial), never wipes.
  const [seed] = useState(() => decompileWordsState(rule.find, rule.flags));
  const [subMode, setSubMode] = useState<SubMode>("words");
  const [state, setState] = useState<WordsBuilderState>(seed ?? EMPTY_WORDS_STATE);
  const [exampleText, setExampleText] = useState("");
  // Frozen at mount: an advanced pattern was opened here (empty-at-mount is NOT partial - the author
  // is building fresh, so a later non-empty find must not flip this on).
  const [partial] = useState(() => seed === null && rule.find.trim() !== "");

  // By-example: split on newlines or commas; push a rebuilt pattern only on real edits (never mount).
  const changeExamples = (text: string): void => {
    setExampleText(text);
    const b = buildFromExamples(text.split(/[\n,]/));
    onPatch({ find: b.pattern, flags: b.flags });
  };

  const built = useMemo(() => buildWordsPattern(state), [state]);
  const readout = useMemo(
    () => readoutFor(built.pattern, built.flags, { rng: mulberry32(seedFrom(built.pattern)), count: 5 }),
    [built.pattern, built.flags],
  );

  const update = (patch: Partial<WordsBuilderState>): void => {
    const next = { ...state, ...patch };
    setState(next);
    const b = buildWordsPattern(next);
    onPatch({ find: b.pattern, flags: b.flags });
  };

  const canOptimize =
    built.optimizedWords.length > 0 && built.optimizedWords.join(", ") !== state.wordsInput.trim();

  return (
    <>
      <span className={styles.subMode} role="group" aria-label="How to describe the match">
        <button
          type="button"
          className={subMode === "words" ? `${styles.sm} ${styles.smOn}` : styles.sm}
          aria-pressed={subMode === "words"}
          onClick={() => setSubMode("words")}
        >
          Match these words
        </button>
        <button
          type="button"
          className={subMode === "example" ? `${styles.sm} ${styles.smOn}` : styles.sm}
          aria-pressed={subMode === "example"}
          onClick={() => setSubMode("example")}
        >
          Match by example
        </button>
      </span>

      {partial && (
        <p className={styles.wordNote}>
          This pattern was written another way. Typing here builds a new one from scratch.
        </p>
      )}

      {subMode === "words" ? (
        <>
          <input
            className={styles.bigIn}
            value={state.wordsInput}
            placeholder="cat, dog, queen"
            aria-label="Words to match, comma separated"
            spellCheck={false}
            onChange={(e) => update({ wordsInput: e.target.value })}
          />

          {canOptimize && (
            <div className={styles.optimize}>
              <span className={styles.optLabel}>It sees a family:</span>
              <button
                type="button"
                className={styles.optChip}
                onClick={() => update({ wordsInput: built.optimizedWords.join(", ") })}
              >
                use {built.optimizedWords.join(", ")}
              </button>
            </div>
          )}
          {built.familyWarning && <div className={styles.famWarn}>{built.familyWarning}</div>}

          <div className={styles.tuneGrid}>
            <label className={styles.tune}>
              <span className={styles.tuneLabel}>But never these</span>
              <input
                className={styles.tuneIn}
                value={state.excludeWords}
                placeholder="dashboard"
                spellCheck={false}
                onChange={(e) => update({ excludeWords: e.target.value })}
              />
            </label>
            <label className={styles.tune}>
              <span className={styles.tuneLabel}>Optional endings</span>
              <input
                className={styles.tuneIn}
                value={state.optionalSuffixes}
                placeholder="s, es, ing"
                spellCheck={false}
                onChange={(e) => update({ optionalSuffixes: e.target.value })}
              />
            </label>
            <label className={styles.tune}>
              <span className={styles.tuneLabel}>Only when followed by</span>
              <input
                className={styles.tuneIn}
                value={state.mustBeFollowedBy}
                placeholder=""
                spellCheck={false}
                onChange={(e) => update({ mustBeFollowedBy: e.target.value })}
              />
            </label>
            <label className={styles.tune}>
              <span className={styles.tuneLabel}>Never when followed by</span>
              <input
                className={styles.tuneIn}
                value={state.mustNotBeFollowedBy}
                placeholder="cam"
                spellCheck={false}
                onChange={(e) => update({ mustNotBeFollowedBy: e.target.value })}
              />
            </label>
            <button
              type="button"
              className={styles.tgl}
              aria-pressed={state.wholeWordsOnly}
              onClick={() => update({ wholeWordsOnly: !state.wholeWordsOnly })}
            >
              <span className={state.wholeWordsOnly ? styles.rswitch : `${styles.rswitch} ${styles.rswitchOff}`} />
              Whole words only
            </button>
            <button
              type="button"
              className={styles.tgl}
              aria-pressed={state.caseSensitive}
              onClick={() => update({ caseSensitive: !state.caseSensitive })}
            >
              <span className={state.caseSensitive ? styles.rswitch : `${styles.rswitch} ${styles.rswitchOff}`} />
              Match case exactly
            </button>
          </div>

          {built.wholeWordDropped && (
            <p className={styles.wordNote}>
              Whole-word matching is off here: this script has no gaps between words.
            </p>
          )}

          {built.pattern !== "" && (
            <>
              <div className={styles.readout}>
                <b className={styles.readoutLabel}>The pattern this builds</b>
                {built.pattern}
              </div>
              {readout.reading && <p className={styles.describe}>{readout.reading}</p>}
              {(readout.matches.length > 0 || readout.nearMisses.length > 0) && (
                <div className={styles.exRow}>
                  {readout.matches.map((m) => (
                    <span key={`hit-${m}`} className={`${styles.exChip} ${styles.exHit}`}>
                      {m}
                    </span>
                  ))}
                  {readout.nearMisses.slice(0, 2).map((m) => (
                    <span key={`miss-${m}`} className={`${styles.exChip} ${styles.exMiss}`}>
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <ExampleMode exampleText={exampleText} styles={styles} onChangeExamples={changeExamples} />
      )}
    </>
  );
}
