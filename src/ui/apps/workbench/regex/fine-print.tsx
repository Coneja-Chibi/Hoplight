/**
 * FinePrint - the folded advanced controls (design/vs-regex-editor.html details.card). Depth window,
 * run-on-edit, macro substitution, and who it applies to are capability-gated per Write-for lens
 * (fieldVisible); the vaud-engine extras (first match only, overlay, conditional chaining) have no
 * wire anywhere, so they always show and travel-lint marks them under a foreign lens. Every control
 * is a plain switch or select - no raw booleans, no positional flags.
 */
import type { JSX } from "react";
import type {
  RegexRule,
  RegexSubstitution,
} from "../../../../entities/regex/schema";
import { fieldVisible, type RegexWriteForProfile } from "../../../../core/regex";

export interface FinePrintProps {
  rule: RegexRule;
  rules: readonly RegexRule[];
  writeFor: RegexWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<RegexRule>) => void;
}

const SUBSTITUTIONS: readonly RegexSubstitution[] = ["none", "raw", "escaped", "after"];
const SUB_LABELS: Record<RegexSubstitution, string> = {
  none: "Off",
  raw: "Raw",
  escaped: "Escaped",
  after: "After",
};

/** A plain on/off switch (the fine-print rswitch), keyboard-operable. */
function Switch(props: {
  on: boolean;
  label: string;
  styles: Readonly<Record<string, string>>;
  onToggle: () => void;
}): JSX.Element {
  const { on, label, styles, onToggle } = props;
  return (
    <button
      type="button"
      className={on ? styles.rswitch : `${styles.rswitch} ${styles.rswitchOff}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
    />
  );
}

const parseDepth = (raw: string): number | null => {
  const v = raw.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function FinePrint({ rule, rules, writeFor, styles, onPatch }: FinePrintProps): JSX.Element {
  const showDepth = fieldVisible(writeFor, "minDepth") || fieldVisible(writeFor, "maxDepth");
  const showRunOnEdit = fieldVisible(writeFor, "runOnEdit");
  const showSubstitute = fieldVisible(writeFor, "substituteFind");
  const showCharacters = fieldVisible(writeFor, "characterIds");
  const others = rules.filter((r) => r.id !== rule.id);
  const condition = rule.condition;

  return (
    <details className={styles.finePrint}>
      <summary className={styles.fpSummary}>
        <span className={styles.cheadB}>Fine print</span>
        <span className={styles.cheadI}>depth · edits · trims · who it applies to</span>
      </summary>
      <div className={styles.fpBody}>
        {showDepth && (
          <>
            <div className={styles.rrow}>
              <span className={styles.rk}>Only messages deeper than</span>
              <input
                className={styles.rvNum}
                inputMode="numeric"
                placeholder="any"
                value={rule.minDepth ?? ""}
                aria-label="Minimum message depth"
                onChange={(e) => onPatch({ minDepth: parseDepth(e.target.value) })}
              />
            </div>
            <div className={styles.rrow}>
              <span className={styles.rk}>Only messages shallower than</span>
              <input
                className={styles.rvNum}
                inputMode="numeric"
                placeholder="any"
                value={rule.maxDepth ?? ""}
                aria-label="Maximum message depth"
                onChange={(e) => onPatch({ maxDepth: parseDepth(e.target.value) })}
              />
            </div>
          </>
        )}

        {showRunOnEdit && (
          <div className={styles.rrow}>
            <span className={styles.rk}>Run again when a message is edited</span>
            <Switch
              on={rule.runOnEdit === true}
              label="Run again when a message is edited"
              styles={styles}
              onToggle={() => onPatch({ runOnEdit: !rule.runOnEdit })}
            />
          </div>
        )}

        {showSubstitute && (
          <div className={styles.rrow}>
            <span className={styles.rk}>Macros in the find</span>
            <select
              className={styles.fpSelect}
              value={rule.substituteFind ?? "none"}
              aria-label="Macros in the find pattern"
              onChange={(e) => onPatch({ substituteFind: e.target.value as RegexSubstitution })}
            >
              {SUBSTITUTIONS.map((s) => (
                <option key={s} value={s}>
                  {SUB_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        {showCharacters && (
          <div className={styles.rrow}>
            <span className={styles.rk}>Only for these characters</span>
            <input
              className={styles.fpInput}
              placeholder="everyone"
              value={(rule.characterIds ?? []).join(", ")}
              aria-label="Only for these characters"
              onChange={(e) => {
                const ids = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0);
                onPatch({ characterIds: ids.length > 0 ? ids : undefined });
              }}
            />
          </div>
        )}

        <div className={styles.rrow}>
          <span className={styles.rk}>Replace only the first match</span>
          <Switch
            on={rule.firstMatchOnly === true}
            label="Replace only the first match"
            styles={styles}
            onToggle={() => onPatch({ firstMatchOnly: !rule.firstMatchOnly })}
          />
        </div>

        <div className={styles.rrow}>
          <span className={styles.rk}>Draw over the text instead of changing it</span>
          <Switch
            on={rule.overlay === true}
            label="Draw over the text instead of changing it"
            styles={styles}
            onToggle={() => onPatch({ overlay: !rule.overlay })}
          />
        </div>

        <div className={styles.rrow}>
          <span className={styles.rk}>Only run after another rule</span>
          <select
            className={styles.fpSelect}
            value={condition?.ruleId ?? ""}
            aria-label="Only run after another rule"
            onChange={(e) => {
              const ruleId = e.target.value;
              onPatch({
                condition: ruleId ? { ruleId, matched: condition?.matched ?? true } : undefined,
              });
            }}
          >
            <option value="">Always run</option>
            {others.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label.trim() || "Untitled rule"}
              </option>
            ))}
          </select>
        </div>

        {condition && (
          <div className={styles.rrow}>
            <span className={styles.rk}>...and that rule</span>
            <select
              className={styles.fpSelect}
              value={condition.matched ? "fired" : "missed"}
              aria-label="...and that rule"
              onChange={(e) =>
                onPatch({ condition: { ruleId: condition.ruleId, matched: e.target.value === "fired" } })
              }
            >
              <option value="fired">fired</option>
              <option value="missed">did not fire</option>
            </select>
          </div>
        )}
      </div>
    </details>
  );
}
