/**
 * HealthPane - the full check beside the editor (R4, the lore Health pane's regex twin). Renders
 * the set linter's findings (core/regex/inspect.ts) grouped problems-first: each row is the plain
 * message plus a "Go to rule" jump and, when the finding carries a safe data fix (disable a
 * duplicate), a Fix button that applies it to the SESSION - nothing is written until Save.
 * Hosted in the rail column exactly like the bench (never a modal, per the companion-pane law).
 */
import type { JSX } from "react";
import type { RegexRule } from "../../../../entities/regex/schema";
import type { RegexFinding } from "../../../../core/regex";
import hp from "./health-pane.module.css";

export interface HealthPaneProps {
  findings: readonly RegexFinding[];
  rules: readonly RegexRule[];
  onClose: () => void;
  onGoTo: (ruleId: string) => void;
  onFix: (finding: RegexFinding) => void;
}

function Row({
  finding,
  onGoTo,
  onFix,
}: {
  finding: RegexFinding;
  onGoTo: (ruleId: string) => void;
  onFix: (finding: RegexFinding) => void;
}): JSX.Element {
  return (
    <div className={finding.severity === "problem" ? `${hp.row} ${hp.rowProblem}` : hp.row}>
      <p className={hp.rowMsg}>{finding.message}</p>
      <span className={hp.rowActs}>
        {finding.ruleId && (
          <button type="button" className={hp.act} onClick={() => onGoTo(finding.ruleId!)}>
            Go to rule
          </button>
        )}
        {finding.fix && (
          <button type="button" className={`${hp.act} ${hp.actFix}`} onClick={() => onFix(finding)}>
            Fix: switch it off
          </button>
        )}
      </span>
    </div>
  );
}

export function HealthPane({ findings, rules, onClose, onGoTo, onFix }: HealthPaneProps): JSX.Element {
  const problems = findings.filter((f) => f.severity === "problem");
  const notes = findings.filter((f) => f.severity === "worth-a-look");
  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <section className={hp.pane} aria-label="Full check">
      <div className={hp.phead}>
        <b className={hp.pheadB}>Full check</b>
        <span className={hp.pheadKick}>every rule, checked for real</span>
        <button type="button" className={hp.close} aria-label="Close the full check" onClick={onClose}>
          &#215;
        </button>
      </div>

      {findings.length === 0 ? (
        <p className={hp.allClear}>
          &#9679; Everything checks out. {enabledCount} rule{enabledCount === 1 ? "" : "s"} on, none
          broken, none slow, none stepping on each other.
        </p>
      ) : (
        <div className={hp.groups}>
          {problems.length > 0 && (
            <div className={hp.group}>
              <p className={hp.groupTitle}>Problems</p>
              {problems.map((f, i) => (
                <Row key={`p${i}`} finding={f} onGoTo={onGoTo} onFix={onFix} />
              ))}
            </div>
          )}
          {notes.length > 0 && (
            <div className={hp.group}>
              <p className={hp.groupTitle}>Worth a look</p>
              {notes.map((f, i) => (
                <Row key={`n${i}`} finding={f} onGoTo={onGoTo} onFix={onFix} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
