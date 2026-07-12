/**
 * RuleRail - the try-it rail (design/vs-regex-editor.html .rail). Quick try runs the budgeted engine
 * (applyRules) on a sample line and highlights the matches from the trace's d-flag spans, then shows
 * the resulting text and the count/time. "Open the full test bench" and the Health card are stubs for
 * later slices (the full bench and QOL 5 health lint); shown honestly, never faked.
 *
 * DEVIATION (stated): trace spans index the rule's INPUT (`before`), so the highlight marks the
 * matched input, then the result is shown plainly below - not the output-side marks the wireframe
 * draws (those would need re-running the replacement in the UI, duplicating the engine).
 */
import { useMemo, useState, type JSX, type ReactNode } from "react";
import type { RegexRule } from "../../../../entities/regex/schema";
import { applyRules, validateRule } from "../../../../core/regex";
import type { RegexFinding, TraceMatch } from "../../../../core/regex";

export interface RuleRailProps {
  rule: RegexRule;
  styles: Readonly<Record<string, string>>;
  /** Open the full test bench beside the editor; absent = the launcher stays a disabled stub. */
  onOpenBench?: () => void;
  /** This rule's slice of the set linter's findings (R4); absent = plain validate fallback. */
  findings?: readonly RegexFinding[];
  /** Open the full-check pane beside the editor (the whole set's findings). */
  onOpenHealth?: () => void;
}

const DEFAULT_SAMPLE = "She dashes off before he sprinted.";

/** Wrap each whole-match span (into `text`) in a mark; non-overlapping, left to right. */
function highlight(
  text: string,
  matches: readonly TraceMatch[],
  markClass: string | undefined,
): ReactNode {
  const spans = matches
    .map((m) => m.whole)
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  if (spans.length === 0) return text;
  const out: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.start < cursor) return;
    if (s.start > cursor) out.push(text.slice(cursor, s.start));
    out.push(
      <mark key={i} className={markClass}>
        {text.slice(s.start, s.end)}
      </mark>,
    );
    cursor = s.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export function RuleRail({ rule, styles, onOpenBench, findings, onOpenHealth }: RuleRailProps): JSX.Element {
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const hasPattern = rule.find.trim() !== "";

  // Preview one rule in isolation: force it on, run in its first phase, drop the cross-rule condition
  // and the display-only overlay so the quick try shows the concrete replacement.
  const preview = useMemo(() => {
    if (!hasPattern) return null;
    const phase = rule.phases[0] ?? "input";
    const solo: RegexRule = {
      ...rule,
      enabled: true,
      phases: [phase],
      condition: undefined,
      overlay: false,
    };
    return applyRules(sample, [solo], { phase }).traces[0] ?? null;
  }, [rule, sample, hasPattern]);

  const health = useMemo(() => validateRule(rule), [rule]);

  const matches = preview?.matches ?? [];
  const changed = preview ? preview.after !== preview.before : false;

  return (
    <aside className={styles.rail}>
      <p className={styles.railTitle}>Quick try</p>

      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b className={styles.rheadB}>Try a line</b>
        </div>
        <div className={styles.rbody}>
          <textarea
            className={styles.tryTa}
            value={sample}
            aria-label="Sample line to try"
            onChange={(e) => setSample(e.target.value)}
          />

          {!hasPattern ? (
            <div className={styles.tryOut}>Add a pattern to try this rule.</div>
          ) : preview?.error ? (
            <div className={`${styles.tryOut} ${styles.tryOutErr}`}>{preview.error}</div>
          ) : (
            <div className={styles.tryOut}>
              {highlight(preview?.before ?? sample, matches, styles.tryMark)}
              {changed && (
                <span className={styles.tryResult}>&#8594; {preview?.after}</span>
              )}
              <span className={styles.tryMeta}>
                {preview?.matchCount ?? 0} match
                {(preview?.matchCount ?? 0) === 1 ? "" : "es"} ·{" "}
                {(preview?.elapsedMs ?? 0).toFixed(1)}ms
              </span>
            </div>
          )}

          <button
            type="button"
            className={styles.openFull}
            disabled={!onOpenBench}
            title={onOpenBench ? "Open the full test bench beside the editor" : "The full test bench comes in a later slice"}
            onClick={onOpenBench}
          >
            Open the full test bench
          </button>
        </div>
      </div>

      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b className={styles.rheadB}>Health</b>
        </div>
        <div className={styles.rbody}>
          {findings !== undefined ? (
            findings.length === 0 ? (
              <p className={styles.healthLine}>&#9679; This rule looks quick and safe.</p>
            ) : (
              findings.map((f, i) => (
                <p key={`${f.rule}-${i}`} className={`${styles.healthLine} ${styles.healthNote}`}>
                  &#9679; {f.message}
                </p>
              ))
            )
          ) : health.ok ? (
            <p className={styles.healthLine}>&#9679; This rule looks quick and safe.</p>
          ) : (
            <p className={`${styles.healthLine} ${styles.healthNote}`}>
              &#9679; {health.error ?? "Check this pattern."}
            </p>
          )}
          <button
            type="button"
            className={styles.openFull}
            disabled={!onOpenHealth}
            title={onOpenHealth ? "Check every rule in this set" : "The full check needs the set editor"}
            onClick={onOpenHealth}
          >
            Open the full check
          </button>
        </div>
      </div>
    </aside>
  );
}
