/**
 * FlowView - the guided quiz presenter: one question per bright card (the setup's language) with the
 * character taking shape on the stage beside it. Pure view over the draft; Back/Next/Complete only move
 * the cursor or save. Lifted from Editor.tsx as the third sibling presenter (bento / playbill / flow).
 * The shell owns the lens derivation (flowModules, moduleVerdict) + the render engine (controlFor,
 * proseBody) and injects them; the walk cursor, answer bodies, and dossier are flow-only and live here.
 */
import type { CSSProperties, JSX, PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { readPath, type LensVerdict } from "../editor-core";
import { type FieldModule } from "../fields";
import { str, strArr, tokenEstimate } from "../editor-derive";
import { OptionCards } from "../controls/option-cards";

type Styles = Readonly<Record<string, string>>;

export interface FlowViewProps {
  /** the walked list (lens-filtered by the shell); never empty */
  flowModules: FieldModule[];
  flowIndex: number;
  setFlowIndex(i: number): void;
  /** per-module lens verdict, for the "not carried on" note */
  moduleVerdict(m: FieldModule): LensVerdict;
  /** the shared render engine (same instance the bento/playbill use) */
  controlFor(m: FieldModule): JSX.Element;
  proseBody(id: string, path: string): JSX.Element;
  draft: unknown;
  setField(path: string, value: unknown): void;
  text(path: string): string;
  platformLabel(id: string): string;
  saving: boolean;
  doSave(): void | Promise<void>;
  quizRef: RefObject<HTMLDivElement | null>;
  activeCardRef: RefObject<HTMLDivElement | null>;
  splitPct: number;
  onSplitDown(e: ReactPointerEvent): void;
  artUrl: string | null;
  piece: StudioEntitySummary;
  styles: Styles;
}

const RATING_OPTIONS: ReadonlyArray<{ value: string; title: string; sub: string }> = [
  { value: "", title: "Unrated", sub: "Not set. We guess from the tags." },
  { value: "all-ages", title: "All ages", sub: "Safe for everyone. No mature themes." },
  { value: "mature", title: "Mature", sub: "Adult themes, violence, some spice." },
  { value: "explicit", title: "Explicit", sub: "Anything goes. After dark." },
];

const snippet = (s: string): string => (s.length > 84 ? `${s.slice(0, 84).trimEnd()}…` : s);

export function FlowView(props: FlowViewProps): JSX.Element {
  const {
    flowModules, flowIndex, setFlowIndex, moduleVerdict, controlFor, proseBody, draft, setField, text,
    platformLabel, saving, doSave, quizRef, activeCardRef, splitPct, onSplitDown, artUrl, piece, styles,
  } = props;

  const flowAt = Math.min(flowIndex, flowModules.length - 1);
  const active = flowModules[flowAt]!;
  const goFlow = (i: number): void => setFlowIndex(Math.max(0, Math.min(i, flowModules.length - 1)));
  const filled = (m: FieldModule): boolean => {
    const v = readPath(draft, m.path);
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  };
  const answeredCount = flowModules.filter(filled).length;

  // the answer per kind: text/prose get a ruled write field; rating gets pickable cards (the rose
  // PICKED snap); the composite editors keep their bespoke bodies inside the card.
  const answerFor = (m: FieldModule): JSX.Element => {
    if (m.kind === "rating") {
      return <OptionCards options={RATING_OPTIONS} value={text(m.path)} onSelect={(v) => setField(m.path, v)} styles={styles} />;
    }
    if (m.kind === "text") {
      return <input className={styles.write} placeholder={m.placeholder} value={text(m.path)} onChange={(e) => setField(m.path, e.target.value)} />;
    }
    // prose renders through RenderBox (rendered by default, one click to edit the source)
    if (m.kind === "prose") return <div className={styles.composite}>{proseBody(m.id, m.path)}</div>;
    return <div className={styles.composite}>{controlFor(m)}</div>;
  };

  const stageName = text("identity.name") || piece.name;
  // one dossier line per module, shown as a short display value; the sheet grows richer with each answer
  const dossierValue = (m: FieldModule): string => {
    const raw = readPath(draft, m.path);
    if (typeof raw === "string") return snippet(raw);
    if (Array.isArray(raw)) return m.kind === "tags" || m.kind === "list" ? strArr(raw).join(" · ") : `${raw.length} set`;
    if (raw !== null && typeof raw === "object") return "set";
    return "";
  };
  // the growing record: every field REACHED so far, in order (filled shows its value, skipped is
  // marked, the current one is "answering now") - so it grows predictably, never cherry-picked.
  const dossierRows = flowModules.slice(0, flowAt + 1);

  return (
    <div className={styles.quiz} ref={quizRef} style={{ ["--ql"]: `${splitPct}%` } as CSSProperties}>
      <div className={styles.qcol}>
        <div className={styles.qcard} ref={activeCardRef}>
          <span className={styles.qframe} />
          <div className={styles.qtop}>
            <span className={styles.qstep}>{active.step}</span>
            <span className={styles.qprog}>
              <span className={styles.qdots}>
                {flowModules.map((mod, i) => (
                  <i key={mod.id} className={i < flowAt ? styles.qdotDone : i === flowAt ? styles.qdotNow : undefined} />
                ))}
              </span>
              {`${flowAt + 1} of ${flowModules.length}`}
            </span>
          </div>
          <h2 className={styles.qbig}>
            {active.question}
            {active.required && <span className={styles.qreq}> *</span>}
          </h2>
          {active.helper !== undefined && <p className={styles.qsay}>{active.helper}</p>}
          {moduleVerdict(active).missing.length > 0 && (
            <p className={styles.qmiss}>{`not carried on: ${moduleVerdict(active).missing.map(platformLabel).join(", ")}`}</p>
          )}
          <div className={styles.qanswer}>{answerFor(active)}</div>
          <div className={styles.qcontrols}>
            <button type="button" className={styles.qskip} disabled={flowAt === 0 && active.kind !== "rating"} onClick={() => goFlow(flowAt - 1)}>
              &larr; Back
            </button>
            {flowAt === flowModules.length - 1 ? (
              <button type="button" className={`stamp ${styles.qnext}`} disabled={saving} onClick={() => void doSave()}>
                {saving ? "Saving…" : "Complete"}
              </button>
            ) : (
              <button type="button" className={`stamp ${styles.qnext}`} onClick={() => goFlow(flowAt + 1)}>
                Next &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className={styles.splitter}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        onPointerDown={onSplitDown}
      />

      <div className={styles.stagecol}>
        <p className={styles.stagecap}>
          Your character <em>&middot; taking shape</em>
        </p>
        <div className={styles.stage}>
          <span className={`${styles.cr} ${styles.crtl}`} />
          <span className={`${styles.cr} ${styles.crtr}`} />
          <span className={`${styles.cr} ${styles.crbl}`} />
          <span className={`${styles.cr} ${styles.crbr}`} />
          <div className={styles.stinner}>
            <div className={styles.pcol}>
              <div className={styles.pplate}>
                {artUrl !== null && <img className={styles.pimg} src={artUrl} alt="" />}
              </div>
              <b className={styles.pname}>{stageName}</b>
            </div>
            <div className={styles.dossier}>
              {dossierRows.map((m) => {
                const has = filled(m);
                return (
                  <div key={m.id} className={`${styles.drow}${has ? "" : ` ${styles.drowAwait}`}`}>
                    <span className={styles.dk}>{m.sheetLabel}</span>
                    <span className={styles.dv}>{has ? dossierValue(m) : m.id === active.id ? "answering now…" : "skipped"}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.floor} />
          <div className={styles.taking}>{`~${tokenEstimate(draft)} tokens · ${answeredCount} of ${flowModules.length} answered`}</div>
        </div>
      </div>
    </div>
  );
}
