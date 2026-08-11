/**
 * The macro bible: every macro this platform publishes, and clicking one puts it in your text.
 *
 * INSERT, NOT COPY, and that is the whole difference between a reference and a lab. The Workbench's
 * MacroReference copies to the clipboard because it sits beside a prompt block it must not touch;
 * here there is a scratch box six inches away whose entire purpose is being experimented in, so a
 * click lands the token at the caret and you press Resolve.
 *
 * SEARCHABLE, because the catalogs are big enough that a wall of pills is a reference nobody reads -
 * Lumiverse publishes 238 macros, RoleCall 176. The filter is pure and lives in lab-core.
 *
 * Groups, names, descriptions and examples are the CATALOG's, shown as written. Nothing here
 * paraphrases an engine's own words, because a paraphrase is a claim we would then have to defend.
 */
import { useMemo, useState, type JSX } from "react";
import type { PresetWriteForProfile } from "../../../core/preset/capabilities";
import { PRESET_WRITE_FOR_LABELS } from "../../../core/preset/capabilities";
import { bibleFor, bibleSize, filterBible } from "./lab-core";
import styles from "./styles.module.css";

export function BiblePane({
  lens,
  onInsert,
}: {
  lens: PresetWriteForProfile;
  /** hand a token to the scratch box; the caret arithmetic belongs to the caller */
  onInsert: (token: string) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const groups = useMemo(() => bibleFor(lens), [lens]);
  const shown = useMemo(() => filterBible(groups, query), [groups, query]);
  const total = bibleSize(lens);
  const searching = query.trim().length > 0;

  const toggle = (name: string): void =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const shownCount = shown.reduce((n, g) => n + g.macros.length, 0);

  return (
    <section className={styles.box} aria-label="Every macro this platform has">
      <div className={styles.boxHead}>
        <h2 className={styles.boxTitle}>Macro bible</h2>
        <span className={styles.boxNote}>
          {searching ? `${shownCount} of ${total}` : `${total} macros`}
        </span>
      </div>

      <input
        className={styles.field}
        value={query}
        placeholder="Search by name, meaning or alias"
        aria-label="Search macros"
        onChange={(e) => setQuery(e.target.value)}
      />

      <p className={styles.quiet}>
        {`Click any macro to drop it into your text. Words and meanings are ${PRESET_WRITE_FOR_LABELS[lens]}'s own.`}
      </p>

      {shown.length === 0 ? (
        <p className={styles.quiet}>
          {`Nothing in ${PRESET_WRITE_FOR_LABELS[lens]}'s catalog matches that. It may exist on `}
          {"another platform - try one of the others above."}
        </p>
      ) : (
        <div className={styles.rows}>
          {shown.map((group) => {
            // A search is a request to SEE the results, so matches open themselves. Collapsing
            // straight back to headings after typing would hide the thing that was asked for.
            const isOpen = searching || open.has(group.name);
            return (
              <div key={group.name} className={styles.row}>
                <button
                  type="button"
                  className={styles.groupHead}
                  aria-expanded={isOpen}
                  onClick={() => toggle(group.name)}
                >
                  <span className={styles.token}>{group.name}</span>
                  <span className={styles.verdict}>{group.macros.length}</span>
                </button>

                {isOpen ? (
                  <>
                    <p className={styles.meaning}>{group.description}</p>
                    <ul className={styles.entries}>
                      {group.macros.map((m) => (
                        <li key={m.macro} className={styles.entry}>
                          <button
                            type="button"
                            className={styles.insert}
                            title={`Insert ${m.macro}`}
                            onClick={() => onInsert(m.macro)}
                          >
                            {m.macro}
                          </button>
                          <span className={styles.entryDesc}>{m.description}</span>
                          {m.example ? (
                            <span className={styles.example}>{`e.g. ${m.example}`}</span>
                          ) : null}
                          {/*
                            Aliases are shown because an engine that resolves ~180 alternate names
                            will happily run text written with any of them, and somebody reading
                            another author's preset needs to recognise the one in front of them.
                          */}
                          {m.aliases && m.aliases.length > 0 ? (
                            <span className={styles.example}>
                              {`also written ${m.aliases.map((a) => `{{${a}}}`).join(" ")}`}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
