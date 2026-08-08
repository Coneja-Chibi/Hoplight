/**
 * BenchPane - the regex test bench companion (design/vs-regex-tryit.html, 1:1). Opens beside the set
 * editor via the rail's "Open the full test bench". Two tabs: Try text (paste a sample, pick the run
 * phase, watch the CHAIN - one step per rule in order, applied steps with the word diff + colored
 * capture chips, skipped steps with the plain reason, then "What comes out") and Import preview
 * (delegated to BenchImport). The chain runs the FULL rule list through the budgeted engine
 * (core/regex/apply.ts) on a short debounce - never a second matcher, never per-keystroke thrash.
 *
 * DEVIATION (stated, matching rule-rail.tsx's precedent): capture groups are shown as colored chips
 * ($1/$2 ...) below the diff rather than tinted inline inside the struck match - the token diff and
 * the group spans index the same input, and chips keep the render honest without re-running anything.
 */
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { RegexRule } from "../../../../entities/regex/schema";
import type { RegexRunResult } from "../../../../core/regex";
import { escapeRegexChars } from "../../../../core/regex/replace-ops";
import { ExpandTextarea } from "../../../components/expand";
import { InkDialog } from "../../../components/ink-dialog";
import { BenchImport } from "./bench-import";
import { CHAIN_PHASES, captureLane, diffTokens, phaseLabel, skipReasonText } from "./bench-core";
import { runRegexSandboxed } from "./run-in-worker";
import styles from "./bench-pane.module.css";

export interface BenchPaneProps {
  ctx: AppContext;
  rules: readonly RegexRule[];
  initialTab?: BenchTab;
  onClose: () => void;
  /** Hand the chosen imported rules to the host, which stages + appends them into the open set. */
  onImportPicked: (picked: RegexRule[]) => void;
}

type BenchTab = "try" | "import";

const DEFAULT_SAMPLE = '[status] HP: 42/50 [/status]\n"Well..." she said. <em>softly</em>';

/** Render a word-diff as del/ins/plain spans (same-kind runs already coalesced by diffTokens). */
function DiffBody({ before, after }: { before: string; after: string }): JSX.Element {
  const tokens = useMemo(() => diffTokens(before, after), [before, after]);
  return (
    <div className={styles.stepBody}>
      {tokens.map((t, i) =>
        t.kind === "same" ? (
          <span key={i}>{t.text}</span>
        ) : (
          <span key={i} className={t.kind === "del" ? styles.del : styles.ins}>
            {t.text}
          </span>
        ),
      )}
    </div>
  );
}

export function BenchPane({
  ctx,
  rules,
  initialTab = "try",
  onClose,
  onImportPicked,
}: BenchPaneProps): JSX.Element {
  const [tab, setTab] = useState<BenchTab>(initialTab);
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const [debounced, setDebounced] = useState(sample);
  const [phase, setPhase] = useState(CHAIN_PHASES[0]!.phase);
  const [escOpen, setEscOpen] = useState(false);
  const [escInput, setEscInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<RegexRunResult>({ text: sample, traces: [], overlays: [] });
  const [runError, setRunError] = useState<string | null>(null);

  // Short debounce: the sample runs "on every keystroke", but through one settled value, not a storm.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(sample), 140);
    return () => clearTimeout(id);
  }, [sample]);

  const currentPhaseLabel = phaseLabel(phase);

  useEffect(() => {
    const controller = new AbortController();
    void runRegexSandboxed(debounced, rules, { phase, signal: controller.signal }).then((run) => {
      if (run.ok) {
        setResult(run.result);
        setRunError(null);
      } else if (run.reason !== "cancelled") {
        setResult({ text: debounced, traces: [], overlays: [] });
        setRunError(run.error);
      }
    });
    return () => controller.abort();
  }, [debounced, rules, phase]);
  const overlayById = useMemo(
    () => new Map(result.overlays.map((o) => [o.ruleId, o])),
    [result.overlays],
  );

  const labelFor = (ruleId: string, index: number): string => {
    const r = rules.find((x) => x.id === ruleId);
    return r?.label?.trim() || `Rule ${index + 1}`;
  };

  const escaped = escapeRegexChars(escInput);

  const copyEscaped = (): void => {
    void navigator.clipboard?.writeText(escaped).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => ctx.setStatus("could not reach the clipboard"),
    );
  };

  return (
    <aside className={styles.pane} aria-label="Regex test bench">
      <div className={styles.phead}>
        <b className={styles.pheadB}>Test bench</b>
        <span className={styles.tabs} role="tablist" aria-label="Test bench mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "try"}
            className={tab === "try" ? `${styles.tab} ${styles.tabOn}` : styles.tab}
            onClick={() => setTab("try")}
          >
            Try text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "import"}
            className={tab === "import" ? `${styles.tab} ${styles.tabOn}` : styles.tab}
            onClick={() => setTab("import")}
          >
            Import preview
          </button>
        </span>
        <button type="button" className={styles.pclose} aria-label="Close test bench" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className={styles.pbody}>
        {tab === "import" ? (
          <BenchImport ctx={ctx} sample={sample} existingRules={rules} onImportPicked={onImportPicked} />
        ) : (
          <>
            <div className={styles.sampleCard}>
              <div className={styles.schead}>
                <b className={styles.scheadB}>Sample</b>
                <i className={styles.scheadI}>runs on every keystroke</i>
                <button
                  type="button"
                  className={styles.escBtn}
                  onClick={() => {
                    setEscInput("");
                    setEscOpen(true);
                  }}
                >
                  Escape a literal&hellip;
                </button>
              </div>
              <div className={styles.scbody}>
                <ExpandTextarea
                  label="Sample text to run the rules on"
                  className={styles.ta}
                  value={sample}
                  aria-label="Sample text to run the rules on"
                  onChange={(e) => setSample(e.target.value)}
                />
                <div className={styles.phaseRow}>
                  <span>Run as</span>
                  <select
                    className={styles.phaseSel}
                    value={phase}
                    aria-label="Run the chain as this phase"
                    onChange={(e) => setPhase(e.target.value)}
                  >
                    {CHAIN_PHASES.map((p) => (
                      <option key={p.phase} value={p.phase}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <span className={styles.phaseOr}>or</span>
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    disabled
                    title="Lands with Rehearsal"
                  >
                    Pull real chat lines&hellip;
                  </button>
                </div>
              </div>
            </div>

            {rules.length === 0 ? (
              <p className={styles.emptyChain}>This set has no rules yet. Add one to see the chain.</p>
            ) : runError ? (
              <p className={styles.emptyChain}>{runError}</p>
            ) : (
              result.traces.map((trace, i) => {
                const label = labelFor(trace.ruleId, i);
                const stepNo = i + 1;

                if (!trace.applied) {
                  const warn = Boolean(trace.error);
                  return (
                    <div
                      key={trace.ruleId}
                      className={warn ? `${styles.stepSkip} ${styles.stepSkipWarn}` : styles.stepSkip}
                    >
                      <b>
                        {stepNo} &middot; {label}
                      </b>
                      {warn ? (
                        <span className={styles.skipWarnText}>{trace.error}</span>
                      ) : (
                        <span>
                          skipped -{" "}
                          {skipReasonText(trace.skipReason ?? "", {
                            rulePhases: rules.find((r) => r.id === trace.ruleId)?.phases ?? [],
                            currentPhaseLabel,
                          })}
                        </span>
                      )}
                    </div>
                  );
                }

                const overlay = overlayById.get(trace.ruleId);
                const firstMatch = trace.matches?.[0];
                const chips =
                  firstMatch?.groups
                    .map((g, gi) =>
                      g ? { lane: captureLane(gi), n: gi + 1, text: trace.before.slice(g.start, g.end) } : null,
                    )
                    .filter((c): c is { lane: 1 | 2 | 3 | 4; n: number; text: string } => c !== null) ?? [];
                const slow = trace.elapsedMs > 50;

                return (
                  <div key={trace.ruleId} className={styles.step}>
                    <div className={styles.stepHead}>
                      <span className={styles.stepNo}>{stepNo}</span>
                      <b className={styles.stepHeadB}>{label}</b>
                      <span className={styles.stepStat}>
                        <em>
                          {trace.matchCount} match{trace.matchCount === 1 ? "" : "es"}
                        </em>{" "}
                        &middot; <span className={slow ? styles.slow : undefined}>{trace.elapsedMs.toFixed(1)}ms</span>
                      </span>
                    </div>

                    {overlay ? (
                      <>
                        <div className={styles.overlayNote}>Shows as an overlay - the text is untouched</div>
                        <div className={styles.groups}>
                          {overlay.matches.map((m, mi) => (
                            <span key={mi} className={styles.gchip}>
                              <i>over</i>
                              {trace.before.slice(m.whole.start, m.whole.end)}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <DiffBody before={trace.before} after={trace.after} />
                        {chips.length > 0 && (
                          <div className={styles.groups}>
                            {chips.map((c) => (
                              <span key={c.n} className={`${styles.gchip} ${styles[`c${c.lane}`]}`}>
                                <i>${c.n}</i>
                                {c.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}

            {rules.length > 0 && (
              <div className={styles.finalOut}>
                <b className={styles.finalOutB}>What comes out</b>
                {result.text}
              </div>
            )}
          </>
        )}
      </div>

      {escOpen && (
        <InkDialog onDismiss={() => setEscOpen(false)} ariaLabel="Escape a literal">
          <div className={styles.escSheet}>
            <p className={styles.escHead}>Escape a literal</p>
            <p className={styles.escHint}>
              Paste plain text and get a pattern that matches it exactly, special characters and all.
            </p>
            <ExpandTextarea
              label="Literal text to escape"
              className={styles.ta}
              value={escInput}
              aria-label="Literal text to escape"
              placeholder="Paste text like  a[b].c*  here"
              onChange={(e) => setEscInput(e.target.value)}
            />
            <div className={styles.escOut} aria-label="Escaped pattern">
              {escaped || <span style={{ opacity: 0.5 }}>the escaped pattern shows here</span>}
            </div>
            <div className={styles.escActs}>
              <button
                type="button"
                className={styles.escCopy}
                disabled={escInput === ""}
                onClick={copyEscaped}
              >
                {copied ? "Copied" : "Copy pattern"}
              </button>
              <button type="button" className={styles.ghostBtn} onClick={() => setEscOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </InkDialog>
      )}
    </aside>
  );
}
