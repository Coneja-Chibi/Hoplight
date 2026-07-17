/**
 * Advanced pane: code-first CodeEditor with live rule breakdown + knobs.
 * For people who want to write CSS, with Assist still one click away on a selected rule.
 */
import type { JSX } from "react";
import { CodeEditor } from "../code-editor";
import type { CssDoc, CssRule } from "./model";
import { summarizeRule } from "./model";
import { RuleKnobs } from "./knobs";
import { CSS_SNIPPET_CHIPS } from "./source-pane";
import styles from "./styles.module.css";

export interface CssAdvancedPaneProps {
  value: string;
  onChange(css: string): void;
  doc: CssDoc;
  selected: CssRule | undefined;
  onSelectRule(id: string | null): void;
  onRuleChange(rule: CssRule): void;
  onChip(insert: string): void;
}

/** Code + breakdown split for advanced authors. */
export function CssAdvancedPane({
  value,
  onChange,
  doc,
  selected,
  onSelectRule,
  onRuleChange,
  onChip,
}: CssAdvancedPaneProps): JSX.Element {
  const freeform = doc.freeform.trim();
  return (
    <div className={styles.advanced} data-tour="css-advanced">
      <p className={styles.hint}>
        Code is primary. Rules on the right are parsed from your sheet. Click one to tweak knobs;
        freeform (@media / nested) stays in the source.
      </p>
      <div className={styles.advGrid}>
        <div className={styles.advCode}>
          <div className={styles.sourceHead}>
            <span className={styles.sourceLabel}>CSS source</span>
          </div>
          <div className={styles.chips}>
            {CSS_SNIPPET_CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                className={styles.chip}
                title={c.insert}
                onClick={() => onChip(c.insert)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <CodeEditor
            value={value}
            onChange={onChange}
            language="css"
            minRows={14}
            placeholder={"/* write CSS */\n.card {\n  color: #e8e4ef;\n}\n"}
            macros={[]}
          />
        </div>
        <div className={styles.advBreak}>
          <span className={styles.sourceLabel}>
            Rule breakdown · {doc.rules.length}
            {freeform ? " · freeform kept" : ""}
          </span>
          {doc.rules.length === 0 && !freeform ? (
            <p className={styles.hint}>No rules parsed yet. Type CSS on the left or import a file.</p>
          ) : null}
          <div className={styles.ruleList}>
            {doc.rules.map((r) => (
              <button
                key={r.id}
                type="button"
                className={
                  selected?.id === r.id ? `${styles.ruleBtn} ${styles.ruleBtnOn}` : styles.ruleBtn
                }
                onClick={() => onSelectRule(r.id)}
              >
                {summarizeRule(r)}
              </button>
            ))}
          </div>
          {freeform ? (
            <pre className={styles.freeformBlock} title="Unparsed / @media kept verbatim">
              {freeform.length > 400 ? `${freeform.slice(0, 400)}…` : freeform}
            </pre>
          ) : null}
          {selected ? (
            <div className={styles.advKnobs}>
              <span className={styles.knobLabel}>Assist this rule</span>
              <RuleKnobs rule={selected} onChange={onRuleChange} />
            </div>
          ) : (
            <p className={styles.hint}>Select a rule to open knobs without leaving Advanced.</p>
          )}
        </div>
      </div>
    </div>
  );
}
