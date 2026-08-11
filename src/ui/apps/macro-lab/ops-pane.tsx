/**
 * The operations table: one row per thing a macro can DO, one column per platform.
 *
 * WHY AN OPERATION AND NOT A NAME. Names lie in both directions. `{{random::a::b}}` picks from a
 * list on SillyTavern and is a numeric range on RoleCall - same spelling, different operation - and
 * `random.pick` is spelled `{{pick::a::b::c}}` on Lumiverse, a different name for the same thing.
 * A table keyed on names would show those as, respectively, a match and a gap. Both wrong.
 *
 * THE EMPTY CELLS ARE THE CONTENT. Somebody reads this to find out whether the thing they rely on
 * exists where they are going, so rows are ordered by how few platforms carry them: the portability
 * problems sit at the top instead of scattered alphabetically.
 *
 * WHAT IT DOES NOT COVER, said plainly on screen rather than left to be discovered: ops.ts annotates
 * DIVERGENCE, not everything. The many macro names that already mean the same thing everywhere carry
 * no operation and are not rows here - they are in the bible. This table answers "where do the
 * engines disagree", which is a smaller and more useful question than "what macros exist".
 */
import { type JSX } from "react";
import { MACRO_DIALECT_LABELS } from "../../../core/preset/macros";
import { OPERATION_ABSENT, OPERATION_LENSES, operationRows } from "./lab-core";
// Two sheets on purpose: the box chrome and the insert pill are shared with the bible, the grid is
// this pane's alone. See ops.module.css.
import grid from "./ops.module.css";
import styles from "./styles.module.css";

/** ops are dotted `family.action`; the action alone reads better once the family is a heading. */
const actionOf = (op: string): string => op.slice(op.indexOf(".") + 1).replace(/-/g, " ");

export function OpsPane({ onInsert }: { onInsert: (token: string) => void }): JSX.Element {
  const rows = operationRows();
  const gaps = rows.filter((r) => r.carriedBy < OPERATION_LENSES.length).length;

  return (
    <section className={styles.box} aria-label="What each platform calls the same operation">
      <div className={styles.boxHead}>
        <h2 className={styles.boxTitle}>Operations</h2>
        <span className={styles.boxNote}>{`${rows.length} operations · ${gaps} with gaps`}</span>
      </div>

      <p className={styles.quiet}>
        Every row is one thing a macro can do, and every column is what that platform calls it. A
        blank cell means that platform has no macro for it at all, so text relying on it will not
        survive the move. Click a spelling to drop it into your text.
      </p>

      <div className={grid.tableWrap}>
        <table className={grid.table}>
          <thead>
            <tr>
              <th scope="col">Operation</th>
              {OPERATION_LENSES.map((lens) => (
                <th key={lens} scope="col">{MACRO_DIALECT_LABELS[lens]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.op}>
                <th scope="row" className={grid.opCell}>
                  <span className={grid.opAction}>{actionOf(row.op)}</span>
                  <span className={grid.opFamily}>{row.family}</span>
                </th>
                {row.byLens.map((cell) => (
                  <td key={cell.lens} className={cell.forms.length === 0 ? grid.gap : undefined}>
                    {cell.forms.length === 0 ? (
                      // Named, not left blank. An empty cell reads as "not filled in yet"; this
                      // reads as the finding it is.
                      <span className={grid.gapWord}>none</span>
                    ) : (
                      cell.forms.map((form) => (
                        <button
                          key={form.macro}
                          type="button"
                          className={styles.insert}
                          title={form.description}
                          onClick={() => onInsert(form.macro)}
                        >
                          {form.macro}
                        </button>
                      ))
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.quiet}>
        Only operations where the engines DISAGREE appear here. A macro name that already means the
        same thing everywhere carries no operation annotation and lives in the bible instead.
      </p>

      {/*
        A platform with no column is a platform we have not finished modelling, and saying so is the
        difference between a gap in Hoplight and a gap in the engine. A RisuAI column reading "none"
        down every row would assert it cannot do randomness, conditionals or text shaping - all of
        which it plainly can. Left out, and named.
      */}
      {OPERATION_ABSENT.length > 0 ? (
        <p className={styles.quiet}>
          {`${OPERATION_ABSENT.map((l) => MACRO_DIALECT_LABELS[l]).join(", ")} has no column here `}
          {"yet. Its macro list is complete in the bible, but Hoplight has not yet mapped which of "}
          {"these operations each of its macros performs - so a column would show our gap as its "}
          {"gap. That mapping is read from the engine, one macro at a time."}
        </p>
      ) : null}
    </section>
  );
}
