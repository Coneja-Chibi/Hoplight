/**
 * Thin sample-match stage: authoring aid only, not host activation.
 */
import { useMemo, useState, type JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { sampleMatchEntries, type SampleMatchHit } from "../../../../core/lore";
import { ExpandTextarea } from "../../../components/expand";

export interface SampleMatchStageProps {
  entries: readonly LorebookEntry[];
  styles: Readonly<Record<string, string>>;
}

const MATCH_LABEL: Record<SampleMatchHit["matched"], string> = {
  primary: "primary key",
  secondary: "secondary key",
  constant: "constant",
  none: "no match",
};

export function SampleMatchStage({ entries, styles }: SampleMatchStageProps): JSX.Element {
  const [sample, setSample] = useState("");
  const hits = useMemo(() => sampleMatchEntries(sample, entries), [sample, entries]);
  const matched = hits.filter((h) => h.matched !== "none");

  return (
    <section className={styles.field} aria-label="Sample key match">
      <span className={styles.label}>Sample match (authoring aid)</span>
      <ExpandTextarea
        label="Sample match text"
        className={styles.textarea}
        style={{ minHeight: "3.5rem" }}
        placeholder="Type sample chat text to see which entries would key-match…"
        value={sample}
        onChange={(ev) => setSample(ev.target.value)}
      />
      <span className={styles.chip}>
        Not full activation · no recursion/budgets · {matched.length}/{entries.length} hit
      </span>
      {sample.trim() !== "" && (
        <ul className={styles.matchList}>
          {hits.map((h) => (
            <li
              key={h.entryId}
              className={h.matched === "none" ? styles.matchMiss : styles.matchHit}
            >
              <strong>{h.title || "(untitled)"}</strong>
              <span> · {MATCH_LABEL[h.matched]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
