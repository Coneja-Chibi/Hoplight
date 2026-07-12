/**
 * Guided mode (design/vs-regex-editor.html wire 1.7, QOL 19): baby's first regex as the quiz STRUCTURE
 * - progress squares, one question at a time (what should it catch / become / where) - wearing this
 * editor's OWN binder grammar (stage panels, black borders, teal accent), never a visitor palette.
 *
 * The pattern is NEVER shown. The "it will catch" card is ASSEMBLED from engine truth, never written:
 * a fixed template, hit chips from execution-verified examplesFor matches, and ONE computed miss chip
 * derived from the user's OWN examples (guidedMiss) - rendered struck only when the engine truly
 * rejects it - plus the fixed confession line. No free-text claim about what it catches. An escape link
 * jumps to Pattern mode. Powered by the deterministic builder only; there is NO model call.
 */
import { useMemo, useState, type JSX } from "react";
import type { RegexPhase, RegexRule } from "../../../../entities/regex/schema";
import {
  buildFromExamples,
  guidedMiss,
  readoutFor,
  type RegexWriteForProfile,
} from "../../../../core/regex";
import { mulberry32 } from "../../../../core/lore/rng";
import { PhasePicker } from "./phase-picker";
import { seedFrom } from "./mode-words";

export interface ModeGuidedProps {
  rule: RegexRule;
  writeFor: RegexWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<RegexRule>) => void;
  onEscape: () => void;
}

const STEPS = [
  { k: "What should it catch?", sub: "Type a few examples of the text you want changed. Two or three is plenty - no symbols, no patterns, just the real thing." },
  { k: "What should it become?", sub: "The replacement text. Leave it empty to simply remove whatever was caught." },
  { k: "Where should it run?", sub: "Pick the pipeline stages this rule acts on - what the model says, what you type, or just how it looks." },
] as const;

export function ModeGuided({ rule, writeFor, styles, onPatch, onEscape }: ModeGuidedProps): JSX.Element {
  const [step, setStep] = useState(0);
  const [exampleText, setExampleText] = useState("");

  const examples = useMemo(() => exampleText.split(/\n/).map((e) => e.trim()).filter((e) => e.length > 0), [exampleText]);
  const built = useMemo(() => buildFromExamples(examples), [examples]);
  const readout = useMemo(
    () => readoutFor(built.pattern, built.flags, { rng: mulberry32(seedFrom(built.pattern)), count: 4 }),
    [built.pattern, built.flags],
  );
  const miss = useMemo(
    () => (built.pattern ? guidedMiss(built.pattern, built.flags, examples) : null),
    [built.pattern, built.flags, examples],
  );

  const changeExamples = (text: string): void => {
    setExampleText(text);
    const b = buildFromExamples(text.split(/\n/));
    onPatch({ find: b.pattern, flags: b.flags });
  };

  const togglePhase = (phase: RegexPhase): void => {
    const has = rule.phases.includes(phase);
    onPatch({ phases: has ? rule.phases.filter((p) => p !== phase) : [...rule.phases, phase] });
  };

  const current = STEPS[step]!;
  const nextLabel =
    step === 0 ? "Next: what should it become?" : step === 1 ? "Next: where should it run?" : "Done";

  return (
    <div className={styles.prosc}>
      <div className={styles.qprog} role="group" aria-label="Guided steps">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={
              i < step ? `${styles.qsq} ${styles.qsqDone}` : i === step ? `${styles.qsq} ${styles.qsqNow}` : styles.qsq
            }
          />
        ))}
      </div>

      <div className={styles.qcard}>
        <span className={styles.qk}>
          Step {step + 1} of 3 &middot; {rule.label.trim() || "New rule"}
        </span>
        <h3 className={styles.qtitle}>{current.k}</h3>
        <p className={styles.qsub}>{current.sub}</p>

        {step === 0 && (
          <>
            <textarea
              className={styles.qta}
              value={exampleText}
              placeholder={"is it raining\ndid it rain\nhas it rained"}
              aria-label="Examples of text to catch"
              spellCheck={false}
              onChange={(e) => changeExamples(e.target.value)}
            />
            {built.pattern !== "" && (
              <div className={styles.qcatch}>
                Got it. Lines built from your examples' words will be caught - for instance:
                <span className={styles.qhits}>
                  {readout.matches.slice(0, 3).map((m) => (
                    <span key={`h-${m}`} className={styles.qhit}>
                      {m}
                    </span>
                  ))}
                  {miss !== null && <span className={styles.qmiss}>{miss}</span>}
                </span>
                <p className={styles.qnote}>
                  It only knows words you showed it{miss !== null ? ` - "${miss}" slips through` : ""}. Add it as
                  another example if you want it caught.
                </p>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <input
            className={styles.qta}
            value={rule.replace}
            placeholder="(leave empty to remove the match)"
            aria-label="Replacement text"
            spellCheck={false}
            onChange={(e) => onPatch({ replace: e.target.value })}
          />
        )}

        {step === 2 && (
          <PhasePicker phases={rule.phases} writeFor={writeFor} styles={styles} onToggle={togglePhase} />
        )}

        <div className={styles.qnav}>
          <button
            type="button"
            className={styles.qback}
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            &larr; Back
          </button>
          <button
            type="button"
            className={styles.qnext}
            disabled={step === STEPS.length - 1}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >
            {nextLabel} {step < STEPS.length - 1 && <>&rarr;</>}
          </button>
        </div>
      </div>

      <button type="button" className={styles.escapePlan} onClick={onEscape}>
        I know patterns - take me to Pattern mode
      </button>
    </div>
  );
}
