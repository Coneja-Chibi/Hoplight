/**
 * The reading box: what the catalogs know about the text on the left.
 *
 * THIS IS OUR MODEL OF THE MACRO, NOT THE ENGINE'S ANSWER, and the wording throughout is chosen so a
 * reader can tell. It says "in this engine's catalog", never "this works" - the catalogs are
 * transcribed from each engine's capability source and are name-level, so a token being present here
 * is not a promise about its arguments. The engine box next door is where a promise comes from.
 *
 * It runs on every keystroke because it is pure and local. The engine box deliberately does not.
 */
import { useState, type JSX } from "react";
import { MACRO_DIALECT_LABELS, type MacroDialect } from "../../../core/preset/macros";
import {
  dialectTranslates,
  noTranslationNote,
  readMacros,
  travelFor,
  VERDICT_LABEL,
  type MacroReading,
} from "./lab-core";
import styles from "./styles.module.css";

/** One token, its meaning on this lens, and (on request) where it can travel. */
function TokenRow({
  row,
  lens,
}: {
  row: MacroReading;
  lens: MacroDialect;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const travel = open && row.name ? travelFor(row.token, lens) : [];

  return (
    <li className={`${styles.row}${row.depth > 0 ? ` ${styles.rowNested}` : ""}`}>
      <div className={styles.rowHead}>
        <code className={styles.token}>{row.token}</code>
        <span
          className={`${styles.verdict}${row.verdict === "known" ? ` ${styles.verdictKnown}` : ""}`}
        >
          {VERDICT_LABEL[row.verdict]}
        </span>
      </div>

      {row.description ? <p className={styles.meaning}>{row.description}</p> : null}

      {/*
        The documented form, when it is not what was typed. Separators are where this bites:
        {{roll:1d6}} and {{roll::2d6}} share a name and are not the same macro, and a lab that
        showed the meaning without the form would be teaching the wrong spelling.
      */}
      {row.documentedAs ? (
        <p className={styles.example}>
          {`written here as ${row.documentedAs}`}
        </p>
      ) : null}
      {row.example ? <p className={styles.example}>{`e.g. ${row.example}`}</p> : null}

      {row.verdict === "invokes-nothing" ? (
        <p className={styles.meaning}>
          Nothing here names a macro, so no engine will expand it. Comments and escapes look like
          this.
        </p>
      ) : null}

      {/*
        Offered only where an answer exists. A dialect the translator does not model would open to
        an empty list, which reads as "it goes nowhere" - the opposite of "we have not checked".
      */}
      {row.name && dialectTranslates(lens) ? (
        <button type="button" className={styles.more} onClick={() => setOpen(!open)}>
          {open ? "Hide other platforms" : "Where else does it work"}
        </button>
      ) : null}

      {open ? (
        <ul className={styles.travel}>
          {travel.map((t) => (
            <li key={t.lens} className={styles.travelRow}>
              <span className={styles.travelLens}>{MACRO_DIALECT_LABELS[t.lens]}</span>
              <span className={t.kind === "same" ? styles.travelSame : styles.travelFlag}>
                {t.kind === "same"
                  ? "the same token works there"
                  : t.becomes
                    ? `${t.becomes} - ${t.why}`
                    : t.why}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ReadingPane({
  text,
  lens,
}: {
  text: string;
  lens: MacroDialect;
}): JSX.Element {
  const reading = readMacros(text, lens);
  const label = MACRO_DIALECT_LABELS[lens];

  return (
    <section className={styles.box} aria-label="What the catalog says">
      <div className={styles.boxHead}>
        <h2 className={styles.boxTitle}>Reading</h2>
        <span className={styles.boxNote}>{`${label} catalog`}</span>
      </div>

      {reading.empty ? (
        <p className={styles.quiet}>
          No macros in this text yet. Type something with double braces in it, like{" "}
          <code>{"{{char}}"}</code>.
        </p>
      ) : (
        <>
          {reading.unknownNames.length > 0 ? (
            <div>
              <p className={styles.quiet}>
                {`${label} has no macro by ${reading.unknownNames.length === 1 ? "this name" : "these names"}. `}
                {"It will reach the model as literal text."}
              </p>
              <div className={styles.tokens}>
                {reading.unknownNames.map((n) => (
                  <code key={n} className={styles.deadToken}>{n}</code>
                ))}
              </div>
            </div>
          ) : null}

          <ul className={styles.rows}>
            {reading.tokens.map((row, i) => (
              <TokenRow key={`${row.token}-${i}`} row={row} lens={lens} />
            ))}
          </ul>

          <p className={styles.quiet}>
            {`Read from our catalog of ${label}, which is transcribed from that engine's own `
              + "capability source and matches on macro NAME. A name being present is not a promise "
              + "about its arguments. For that, resolve it."}
          </p>

          {/* Said once at the foot rather than beside every row, where it would be noise. */}
          {dialectTranslates(lens) ? null : (
            <p className={styles.quiet}>{noTranslationNote(lens)}</p>
          )}
        </>
      )}
    </section>
  );
}
