/**
 * Starters pane: recipe cards with English preview + use this / undo.
 */
import type { JSX, ReactNode } from "react";
import { WorkshopEhead } from "./ehead";
import { summarizeRecipe } from "./explain";
import { WorkshopNotice } from "./notice";
import { listRecipes } from "./recipes";
import styles from "./styles.module.css";

export interface WorkshopStartersProps {
  emptyTriggers: boolean;
  undo: ReactNode;
  onApply(id: string): void;
}

export function WorkshopStarters({ emptyTriggers, undo, onApply }: WorkshopStartersProps): JSX.Element {
  return (
    <>
      <WorkshopEhead
        title="Starters"
        sub="preview a pack, use it, then edit the rows"
        trailing={undo}
      />
      {emptyTriggers && (
        <WorkshopNotice kind="warn">
          You have no rules yet. Starters drop a finished When / If / Then pack you can edit.
        </WorkshopNotice>
      )}
      {listRecipes().map((r) => (
        <div className={styles.trig} key={r.id}>
          <div className={styles.th}>
            <strong
              className={styles.name}
              style={{ border: "none", background: "transparent", width: "auto" }}
            >
              {r.title}
            </strong>
            <button
              type="button"
              className={styles.addmini}
              style={{ marginLeft: "auto" }}
              onClick={() => onApply(r.id)}
            >
              use this
            </button>
          </div>
          <div className={styles.body}>
            <p className={styles.hint}>{r.blurb}</p>
            <pre className={styles.preview}>{summarizeRecipe(r)}</pre>
          </div>
        </div>
      ))}
    </>
  );
}
