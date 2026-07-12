/**
 * PhasePicker - the "Where it runs" pills (design/vs-regex-editor.html .pillRow). Capability-gated:
 * the pill set is phasesForProfile(writeFor) - a phase the lens cannot carry never draws - unioned
 * with any FOREIGN phase already on the rule, which draws dashed amber (the position-picker law's
 * isForeign, transcribed). Toggling never deletes a foreign phase's data; the lens just marks it.
 */
import type { JSX } from "react";
import type { RegexPhase } from "../../../../entities/regex/schema";
import { phasesForProfile, REGEX_WRITE_FOR_LABELS, type RegexWriteForProfile } from "../../../../core/regex";

export interface PhasePickerProps {
  phases: readonly RegexPhase[];
  writeFor: RegexWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onToggle: (phase: RegexPhase) => void;
}

const PHASE_LABELS: Record<string, string> = {
  input: "User input",
  output: "Model output",
  request: "Request",
  display: "Display",
  prompt: "Prompt",
  lorebook: "Lorebook",
  reasoning: "Reasoning",
  slash: "Slash",
  memory: "Memory",
};

const phaseLabel = (phase: RegexPhase): string => PHASE_LABELS[phase] ?? String(phase);

export function PhasePicker({ phases, writeFor, styles, onToggle }: PhasePickerProps): JSX.Element {
  const lensPhases = phasesForProfile(writeFor);
  const foreign = phases.filter((p) => !lensPhases.includes(p));
  const shown: RegexPhase[] = [...lensPhases, ...foreign];
  const lensName = REGEX_WRITE_FOR_LABELS[writeFor];

  return (
    <div className={styles.pillRow} role="group" aria-label="Where it runs">
      {shown.map((phase) => {
        const on = phases.includes(phase);
        const isForeign = !lensPhases.includes(phase);
        const cls = [styles.pill, on ? styles.pillOn : "", isForeign ? styles.pillForeign : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={phase}
            type="button"
            className={cls}
            aria-pressed={on}
            title={
              isForeign
                ? `Set under another platform; ${lensName} folds this to its closest home on export`
                : phaseLabel(phase)
            }
            onClick={() => onToggle(phase)}
          >
            {phaseLabel(phase)}
          </button>
        );
      })}
    </div>
  );
}
