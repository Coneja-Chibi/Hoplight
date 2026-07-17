/**
 * Assist pane: add rule for target, rule list, knobs, delete.
 */
import type { JSX } from "react";
import type { CssDoc, CssRule } from "./model";
import { summarizeRule } from "./model";
import { RuleKnobs } from "./knobs";
import type { CssTargetPack } from "./targets/contract";
import styles from "./styles.module.css";

export interface CssAssistPaneProps {
  pack: CssTargetPack;
  doc: CssDoc;
  selected: CssRule | undefined;
  onSelectRule(id: string): void;
  onAddRule(selector: string): void;
  onRuleChange(rule: CssRule): void;
  onDeleteRule(id: string): void;
}

/** Structured assist over one rule at a time. */
export function CssAssistPane({
  pack,
  doc,
  selected,
  onSelectRule,
  onAddRule,
  onRuleChange,
  onDeleteRule,
}: CssAssistPaneProps): JSX.Element {
  return (
    <div className={styles.assist} data-tour="css-assist">
      <p className={styles.hint}>
        Pick a target, tweak knobs, or write free CSS in Source. Knobs edit one rule at a time.
      </p>
      <div className={styles.packRow}>
        <span className={styles.packLabel}>Add rule for</span>
        <select
          className={styles.sel}
          defaultValue=""
          onChange={(e) => {
            const t = pack.targets.find((x) => x.id === e.target.value);
            if (!t) return;
            onAddRule(t.selector || ".card");
            e.target.value = "";
          }}
          aria-label="Add rule for target"
        >
          <option value="">choose target…</option>
          {pack.targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
              {t.selector ? ` (${t.selector})` : ""}
            </option>
          ))}
        </select>
        <button type="button" className={styles.mini} onClick={() => onAddRule(".card")}>
          + blank rule
        </button>
      </div>

      {doc.rules.length === 0 ? (
        <p className={styles.hint}>No parsed rules yet. Use a Starter or open Source and write CSS.</p>
      ) : (
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
      )}

      {selected && (
        <>
          <div className={styles.english}>{summarizeRule(selected)}</div>
          <RuleKnobs rule={selected} onChange={onRuleChange} />
          <div className={styles.actions}>
            <button type="button" className={styles.mini} onClick={() => onDeleteRule(selected.id)}>
              delete rule
            </button>
          </div>
        </>
      )}

      {doc.freeform.trim() ? (
        <p className={styles.hint}>
          Extra CSS kept as freeform (@media / nested): edit in Source. Not dropped on save.
        </p>
      ) : null}
    </div>
  );
}
