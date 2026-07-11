/**
 * Health pane: inspectBook findings grouped by rule, Fix All with rescan proof (vs-lore-health).
 */
import { useMemo, type JSX } from "react";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import {
  applyAllFixes,
  inspectBook,
  type LoreFinding,
  type LoreFindingRule,
} from "../../../../core/lore";
import styles from "./health-pane.module.css";

const RULE_TITLE: Record<LoreFindingRule, string> = {
  "broken-data": "Broken data",
  "broken-numbering": "Broken numbering",
  "duplicate-key": "Duplicate keys",
  "chance-contradiction": "Chance contradiction",
  "legacy-leftovers": "Legacy leftovers",
  "key-points-nowhere": "Keys that point nowhere",
  "wakes-itself": "Wakes itself",
  "never-woken": "Never woken by others",
  "never-fires": "Never fires",
};

const RULE_ORDER: LoreFindingRule[] = [
  "broken-data",
  "chance-contradiction",
  "never-fires",
  "wakes-itself",
  "broken-numbering",
  "duplicate-key",
  "key-points-nowhere",
  "never-woken",
  "legacy-leftovers",
];

export interface HealthPaneProps {
  body: LorebookBody;
  onTransform: (fn: (b: LorebookBody) => LorebookBody) => void;
  onJumpEntry: (entryId: string) => void;
  onClose: () => void;
  /** Import heal notes (and similar) merged into the first scan. */
  extraFindings?: readonly LoreFinding[];
}

export function HealthPane({
  body,
  onTransform,
  onJumpEntry,
  onClose,
  extraFindings = [],
}: HealthPaneProps): JSX.Element {
  const findings = useMemo(
    () => [...inspectBook(body), ...extraFindings],
    [body, extraFindings],
  );

  const groups = useMemo(() => {
    const map = new Map<LoreFindingRule, LoreFinding[]>();
    for (const f of findings) {
      const list = map.get(f.rule) ?? [];
      list.push(f);
      map.set(f.rule, list);
    }
    return RULE_ORDER.filter((r) => map.has(r)).map((rule) => ({
      rule,
      items: map.get(rule)!,
      fixable: map.get(rule)!.every((f) => f.fix),
      severity: map.get(rule)!.some((f) => f.severity === "problem")
        ? ("problem" as const)
        : ("worth-a-look" as const),
    }));
  }, [findings]);

  return (
    <aside className={styles.pane} aria-label="Health check">
      <div className={styles.head}>
        <b>Health</b>
        <i>
          {findings.length === 0
            ? "clean"
            : `${findings.length} finding${findings.length === 1 ? "" : "s"}`}
        </i>
        <button type="button" className={styles.x} aria-label="Close health" onClick={onClose}>
          &times;
        </button>
      </div>
      {groups.length === 0 && (
        <p className={styles.clean}>Nothing to fix. This book looks healthy.</p>
      )}
      {groups.map((g) => (
        <section key={g.rule} className={styles.group}>
          <div className={styles.ghead}>
            <span
              className={
                g.severity === "problem" ? styles.chipBad : styles.chipWarn
              }
            >
              {g.severity === "problem" ? "Problem" : "Worth a look"}
            </span>
            <b>
              {RULE_TITLE[g.rule]} · {g.items.length}
            </b>
            {g.fixable ? (
              <button
                type="button"
                className={styles.fixAll}
                onClick={() => {
                  onTransform((b) => applyAllFixes(b, g.items));
                }}
              >
                Fix all
              </button>
            ) : (
              <span className={styles.byHand}>Fix by hand</span>
            )}
          </div>
          <ul className={styles.list}>
            {g.items.map((f, i) => (
              <li key={`${f.rule}-${f.entryId ?? "book"}-${i}`}>
                <button
                  type="button"
                  className={styles.finding}
                  disabled={!f.entryId}
                  onClick={() => {
                    if (f.entryId) onJumpEntry(f.entryId);
                  }}
                >
                  {f.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
