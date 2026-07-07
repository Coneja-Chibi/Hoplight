/**
 * The Library app (CONTRACT V2, React) - the shelves, Vaude's deep-browse room (browsing IS the
 * Library). Empty studio = the locked first-run doors; populated = the browse room: deck chips
 * with live counts, drop-in DECK VIEWS (views/registry: grid/showcase/list), the continuous
 * art-size dial, all persisted via ctx.prefs. Opens on the deck chosen at setup. Import (drop
 * anywhere, plain-words receipts) lives here.
 * Tapping pieces STAGES them (multi-select); one Send commits the whole batch to the Workbench.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, JSX } from "react";
import type { AppContext, InspectResult, StudioEntitySummary, VaudeApp } from "../../app-contract";
import { deckMeta, knownDecks } from "../../_shared/decks";
import { deckCounts } from "./deck-core";
import { clampSize, pieceKey, SIZE_RANGE, type DeckViewContext, type PiecePeek } from "./view-contract";
import { deckView, deckViews } from "./views/registry";

/** the locked shelf-of-books mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16"/><rect x="5" y="8" width="3" height="12"/><rect x="9.5" y="5" width="3" height="15"/><path d="M15 20V9l3-1 1.6 10.8-3.4.6z"/></svg>';

const PREF_VIEW = "library.view";
const PREF_SIZE = "library.size";
const PREF_FIRST_DECK = "firstDeck"; // written by the setup wizard; the shelves open on it

const STYLE = `
.chipbtn{font-family:var(--font-big);font-weight:900;font-size:.7rem;letter-spacing:.07em;
  text-transform:uppercase;background:var(--panel);color:var(--ink);cursor:pointer;padding:.45rem .8rem}
.chipbtn.primary{background:var(--rose);color:var(--stage-white)}
.lib{display:flex;flex-direction:column;gap:.7rem;padding:clamp(.7rem,1.8vw,1.1rem);min-height:100%}
.lib .stagezone{flex:1;display:flex;flex-wrap:wrap;gap:var(--gap-l);align-items:center;justify-content:center;padding:var(--gap-l)}
.doorcard{aspect-ratio:2/3;width:clamp(11rem,22vw,16rem);display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:var(--gap-m);background:var(--panel);color:var(--ink);cursor:pointer;padding:var(--gap-m);text-align:center;
  font-family:var(--font-big);font-weight:900;font-size:clamp(1rem,1.6vw,1.3rem);line-height:1.15}
.doorcard.primary{background:var(--rose);color:var(--stage-white)}
.voice{font-style:italic;font-weight:600;color:var(--muted);text-align:center;font-size:1.05rem}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:var(--gap-l);z-index:50}
.sheet{background:var(--paper);color:var(--ink);border:var(--ink-border);box-shadow:8px 8px 0 0 var(--ink);
  max-width:38rem;width:100%;max-height:85dvh;overflow:auto;padding:var(--gap-l);display:flex;flex-direction:column;gap:var(--gap-m)}
.receipt{border:var(--ink-border);background:var(--panel);padding:var(--gap-m)}
.receipt h3{margin:0 0 .2rem;font-family:var(--font-big);font-size:1.1rem}
.receipt p{margin:.15rem 0;font-size:1rem}
.receipt.bad{border-style:dashed;color:var(--muted)}
.mono{font-family:var(--font-mono);font-size:.7rem;color:var(--muted)}
.sheet .actions{display:flex;gap:var(--gap-s);flex-wrap:wrap}
.wbbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap}
/* the staging action bar: appears only when pieces are picked (the distributed tray's commit) */
.sendbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap;background:var(--stamp-bg);
  border:3px solid var(--edge);box-shadow:4px 4px 0 0 var(--accent);padding:.4rem .55rem .4rem .7rem}
.sendbar .cnt{font-family:var(--font-big);font-weight:900;font-size:.75rem;letter-spacing:.04em;color:var(--stamp-fg)}
.sendbar .send{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--accent);color:var(--stage-ink);border:3px solid var(--edge);cursor:pointer;
  padding:.4rem .8rem;box-shadow:3px 3px 0 0 var(--edge);transition:transform .1s ease-out,box-shadow .1s ease-out}
.sendbar .send:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--edge)}
.sendbar .clear{font-family:var(--font-mono);font-weight:700;font-size:.5625rem;letter-spacing:.1em;
  text-transform:uppercase;background:transparent;color:var(--text-dim);border:2px solid var(--text-faint);
  cursor:pointer;padding:.35rem .6rem}
.sendbar .clear:hover{color:var(--text);border-color:var(--edge)}
.deckchips{display:flex;gap:.4rem;flex:1;min-width:0;overflow-x:auto;padding-bottom:2px}
.dchip{display:flex;align-items:center;gap:.45rem;flex:none;cursor:pointer;font-family:var(--font-big);
  font-weight:800;font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);
  background:var(--face);border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge);padding:.35rem .55rem;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.dchip .pip{width:10px;height:10px;flex:none;border:2px solid var(--edge);background:var(--a)}
.dchip .dc{font-family:var(--font-mono);font-weight:600;font-size:.5625rem;color:var(--text-dim)}
.dchip:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--edge)}
.dchip.on{background:var(--stamp-bg);color:var(--stamp-fg);box-shadow:3px 3px 0 0 var(--a)}
.dchip.on .dc{color:var(--stamp-fg);opacity:.7}
.viewseg{display:flex;flex:none;border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge)}
.viewseg button{border:none;border-left:3px solid var(--edge);background:var(--face);color:var(--text-dim);
  font-family:var(--font-big);font-weight:800;font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;
  padding:.4rem .6rem;cursor:pointer;display:flex;align-items:center;gap:.35rem}
.viewseg button:first-child{border-left:none}
.viewseg button.on{background:var(--stamp-bg);color:var(--stamp-fg)}
.viewseg svg{display:block}
.sizedial{display:flex;align-items:center;gap:.45rem;flex:none;border:3px solid var(--edge);
  box-shadow:3px 3px 0 0 var(--edge);background:var(--face);padding:.3rem .6rem}
.sizedial .sk{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)}
.sizedial input{appearance:none;-webkit-appearance:none;width:clamp(5rem,9vw,8rem);height:3px;background:var(--text-faint);
  outline:none;cursor:pointer}
.sizedial input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:12px;height:12px;
  background:var(--text);border:2px solid var(--edge)}
.sizedial input::-moz-range-thumb{width:12px;height:12px;background:var(--text);border:2px solid var(--edge);border-radius:0}
.prosc{position:relative;flex:1;min-height:0;background:var(--shell-panel-2);border:3px solid var(--edge);
  box-shadow:6px 6px 0 0 var(--edge);padding:.55rem;display:flex}
.libstage{position:relative;flex:1;min-height:0;background:var(--stage-well);border:3px solid var(--stage-black);overflow:hidden;
  box-shadow:inset 8px 8px 0 0 rgba(0,0,0,.7);display:flex;flex-direction:column}
.stage-crumb{display:flex;align-items:center;gap:.5rem;border-bottom:3px solid var(--stage-black);background:var(--stage-sunken);padding:.5rem .75rem;flex:none}
.stage-crumb .pip{width:11px;height:11px;border:2px solid var(--stage-black);background:var(--a)}
.stage-crumb .cn{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;color:var(--stage-paper)}
.stage-crumb .cc{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:var(--stage-mute);margin-left:auto}
.ghost-shelf{margin:auto;width:clamp(9rem,30vw,14rem);aspect-ratio:2/3;border:2px dashed var(--stage-faint);
  display:flex;align-items:center;justify-content:center;text-align:center;padding:.8rem;
  font-family:var(--font-mono);font-size:.625rem;letter-spacing:.06em;line-height:1.5;
  text-transform:uppercase;color:var(--stage-kicker)}
/* scrollbars wear the house ink, never the OS chrome */
.lib *{scrollbar-width:thin;scrollbar-color:var(--stage-seam) transparent}
.lib *::-webkit-scrollbar{width:8px;height:8px}
.lib *::-webkit-scrollbar-thumb{background:var(--stage-seam)}
.lib *::-webkit-scrollbar-track{background:transparent}
.deckchips{scrollbar-width:none}
.deckchips::-webkit-scrollbar{display:none}
/* phones: chips WRAP (everything visible, nothing hidden behind an invisible scroll), the view
   seg gets its row, the dial gets a full row so the thumb never clips (fluid law) */
@media(max-width:40rem){
  .lib{padding:.5rem;gap:.5rem}
  .wbbar{gap:.4rem}
  .deckchips{flex:1 1 100%;order:1;flex-wrap:wrap;overflow:visible;padding-bottom:0}
  .viewseg{order:2}
  .sizedial{order:3;flex:1 1 100%;min-width:0}
  .sizedial input{flex:1;width:auto;min-width:0}
  .prosc{padding:.3rem;box-shadow:4px 4px 0 0 var(--edge)}
  .lib .stagezone{gap:var(--gap-m);padding:var(--gap-m)}
  .doorcard{width:clamp(9rem,42vw,12rem)}
}
`;

// -- import flow (unchanged: plain-words receipts, never blocks good files on a bad one) ------------

interface ReadFile {
  filename: string;
  result: InspectResult;
}

interface ImportState {
  phase: "reading" | "done";
  reads: ReadFile[];
}

function ReceiptCard({ r }: { r: ReadFile }): JSX.Element {
  if (r.result.ok && r.result.receipt) {
    return (
      <div className="receipt">
        <h3>{r.result.receipt.name}</h3>
        <p>{r.result.receipt.kindLine}</p>
        {r.result.receipt.extras.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        <div className="mono">see everything we read</div>
      </div>
    );
  }
  return (
    <div className="receipt bad">
      <h3>{r.filename}</h3>
      <p>{r.result.error ?? "We could not read this one."}</p>
    </div>
  );
}

function ImportOverlay({
  state,
  onCommit,
  onCancel,
}: {
  state: ImportState;
  onCommit: () => void;
  onCancel: () => void;
}): JSX.Element {
  if (state.phase === "reading") {
    return (
      <div className="overlay">
        <div className="sheet">
          <h2>Reading your files</h2>
        </div>
      </div>
    );
  }
  const good = state.reads.filter((r) => r.result.ok);
  return (
    <div className="overlay">
      <div className="sheet">
        <h2>{good.length === state.reads.length ? "All read." : "Here is what we read."}</h2>
        {state.reads.map((r, i) => (
          <ReceiptCard key={i} r={r} />
        ))}
        <div className="actions">
          <button className="chipbtn primary stamp" disabled={good.length === 0} onClick={onCommit}>
            {`Put ${good.length} on the shelf`}
          </button>
          <button className="chipbtn stamp" onClick={onCancel}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function pickFiles(onFiles: (files: File[]) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.addEventListener("change", () => onFiles([...(input.files ?? [])]));
  input.click();
}

// -- the browse room --------------------------------------------------------------------------------

const portraitUrl = (e: StudioEntitySummary): string | null =>
  e.hasPortrait ? `/api/studio/portrait?kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}` : null;

/** Fetch a piece's own words for close-up views; tolerant (null on any failure). */
async function peekPiece(ctx: AppContext, e: StudioEntitySummary): Promise<PiecePeek | null> {
  try {
    const entity = (await ctx.api.getEntity(
      `kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`,
    )) as { body?: { identity?: { tagline?: string }; persona?: { description?: string } } };
    const tagline = entity.body?.identity?.tagline;
    const description = entity.body?.persona?.description;
    if (!tagline && !description) return null;
    return { tagline, description };
  } catch {
    return null;
  }
}

/** "RoleCall · V3" / "Default · V2" from the summary's source fields; null = made from scratch. */
function sourceLabelFor(formatLabels: Map<string, string>, e: StudioEntitySummary): string | null {
  if (!e.sourceFormat) return null;
  const base = formatLabels.get(e.sourceFormat) ?? e.sourceFormat;
  return e.sourceVariant ? `${base} · ${e.sourceVariant.toUpperCase()}` : base;
}

/** Parse a static first-party icon constant into a live SVG node (no innerHTML, house rule). */
function Icon({ svg }: { svg: string }): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.replaceChildren();
    box.append(document.importNode(new DOMParser().parseFromString(svg, "image/svg+xml").documentElement, true));
  }, [svg]);
  return <span ref={ref} className="ico" />;
}

function Library({ ctx }: { ctx: AppContext }): JSX.Element {
  const firstDeck = ctx.prefs.get(PREF_FIRST_DECK);
  const [entities, setEntities] = useState<StudioEntitySummary[]>([]);
  const [activeKind, setActiveKind] = useState(typeof firstDeck === "string" && firstDeck ? firstDeck : "character");
  const [formatLabels, setFormatLabels] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [, setWorkbenchTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const [sizeRem, setSizeRem] = useState(() => clampSize(ctx.prefs.get(PREF_SIZE)));

  const reload = useCallback(() => {
    void (async () => {
      setEntities(await ctx.api.listEntities());
    })();
  }, [ctx]);

  useEffect(() => {
    // the workbench-driven repaint: sending/removing/focusing pieces elsewhere flips the "on the
    // workbench" marks here without this room ever calling render itself (see the sendbar handler)
    const unsub = ctx.workbench.onChange(() => setWorkbenchTick((t) => t + 1));
    void ctx.api.formats().then((formats) => {
      setFormatLabels(new Map(formats.map((f) => [f.id, f.generic ? "Default" : f.friendly])));
    });
    reload();
    return unsub;
  }, [ctx, reload]);

  const allCss = useMemo(() => STYLE + deckViews().map((v) => v.css).join("\n"), []);

  const openKeys = new Set(ctx.workbench.pieces().map(pieceKey));
  // drop any staged key that has since gone (opened elsewhere or deleted) so the count never lies
  const selectedValid = new Set(
    [...selected].filter((k) => !openKeys.has(k) && entities.some((e) => pieceKey(e) === k)),
  );

  const decks = deckCounts(entities, knownDecks().map((d) => d.kind));
  const deck = deckMeta(activeKind);
  const inDeck = entities.filter((e) => e.kind === activeKind);

  useEffect(() => {
    ctx.setStatus(
      entities.length === 0
        ? "empty studio"
        : `${deck.plural.toLowerCase()} · ${inDeck.length} of ${entities.length} pieces`,
    );
  }, [ctx, entities.length, deck, inDeck.length]);

  const runImport = (files: File[]): void => {
    void (async () => {
      setImportState({ phase: "reading", reads: [] });
      const read: ReadFile[] = [];
      for (const file of files) {
        read.push({ filename: file.name, result: await ctx.api.inspectFile(file) });
      }
      setImportState({ phase: "done", reads: read });
    })();
  };

  const commitImport = (): void => {
    if (!importState) return;
    void (async () => {
      const good = importState.reads.filter((r) => r.result.ok);
      for (const r of good) await ctx.api.saveEntity(r.result.entity);
      setImportState(null);
      reload();
    })();
  };

  const onDrop = (evt: DragEvent<HTMLDivElement>): void => {
    evt.preventDefault();
    const files = [...(evt.dataTransfer?.files ?? [])];
    if (files.length) runImport(files);
  };

  if (entities.length === 0) {
    // FIRST LANDING (locked): two massive door-cards, verbatim copy, nothing else competing.
    return (
      <div className="lib" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <style>{allCss}</style>
        <div className="stagezone seam">
          <button className="doorcard primary stamp" onClick={() => pickFiles(runImport)}>
            Drag and drop to import asset
          </button>
          <button className="doorcard stamp" onClick={() => ctx.setStatus("the editor arrives next slice")}>
            Click here to start fresh
          </button>
        </div>
        <p className="voice">Every pack starts with a first card.</p>
        {importState && (
          <ImportOverlay state={importState} onCommit={commitImport} onCancel={() => setImportState(null)} />
        )}
      </div>
    );
  }

  const view = deckView(ctx.prefs.get(PREF_VIEW));

  const vctx: DeckViewContext = {
    entities: inDeck,
    deck,
    open: openKeys,
    selected: selectedValid,
    menus: ctx.menus,
    portraitUrl,
    sourceLabel: (e) => sourceLabelFor(formatLabels, e),
    peek: (e) => peekPiece(ctx, e),
    onPiece: (e) => {
      const key = pieceKey(e);
      if (openKeys.has(key)) {
        ctx.setStatus(`${e.name} is already on the Workbench`); // open = annotation, not a toggle
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
  };

  return (
    <div
      className="lib"
      ref={rootRef}
      style={{ "--card-w": `${sizeRem}rem` } as CSSProperties}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <style>{allCss}</style>
      <div className="wbbar">
        <div className="deckchips">
          {decks.map(({ kind, count }) => {
            const meta = deckMeta(kind);
            return (
              <button
                key={kind}
                className={`dchip${kind === activeKind ? " on" : ""}`}
                style={{ "--a": meta.accent } as CSSProperties}
                onClick={() => setActiveKind(kind)}
              >
                <span className="pip" />
                {meta.plural}
                <span className="dc">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="viewseg">
          {deckViews().map((v) => (
            <button
              key={v.id}
              className={v.id === view.id ? "on" : undefined}
              title={`${v.label} view`}
              onClick={() => ctx.prefs.set(PREF_VIEW, v.id)}
            >
              <Icon svg={v.iconSvg} />
              {v.label}
            </button>
          ))}
        </div>
        <label className="sizedial">
          <span className="sk">art</span>
          <input
            type="range"
            min={SIZE_RANGE.min}
            max={SIZE_RANGE.max}
            step={0.5}
            defaultValue={sizeRem}
            title="Art size"
            onInput={(ev) => {
              const val = clampSize(Number((ev.target as HTMLInputElement).value));
              rootRef.current?.style.setProperty("--card-w", `${val}rem`); // live, no re-render
            }}
            onChange={(ev) => {
              const val = clampSize(Number((ev.target as HTMLInputElement).value));
              setSizeRem(val);
              ctx.prefs.set(PREF_SIZE, val);
            }}
          />
        </label>
      </div>

      {/* the staging action bar: only real when pieces are picked; ONE Send commits the whole set */}
      {selectedValid.size > 0 && (
        <div className="sendbar">
          <span className="cnt">{`${selectedValid.size} ${selectedValid.size === 1 ? "piece" : "pieces"} staged`}</span>
          <button
            className="send"
            onClick={() => {
              const byKey = new Map(entities.map((e) => [pieceKey(e), e]));
              const batch = [...selectedValid].map((k) => byKey.get(k)).filter((e): e is StudioEntitySummary => !!e);
              setSelected(new Set());
              // sendMany opens the pieces (firing workbench.onChange -> this room repaints with the
              // staged marks gone) and, in "always" mode, navigates to the Workbench; forcing our
              // own render here would clobber that navigation, so we deliberately don't.
              ctx.workbench.sendMany(batch);
            }}
          >
            {`Send ${selectedValid.size === 1 ? "it" : `all ${selectedValid.size}`} to the Workbench`}
          </button>
          <button className="clear" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      <div className="prosc">
        <div className="libstage" style={{ "--a": deck.accent } as CSSProperties}>
          <div className="stage-crumb">
            <span className="pip" />
            <span className="cn">{deck.plural}</span>
            <span className="cc">{inDeck.length ? `${view.label.toLowerCase()} · ${inDeck.length}` : "deck empty"}</span>
          </div>
          {inDeck.length === 0 ? (
            <div className="ghost-shelf">{`your first ${activeKind} lands here · import or start fresh`}</div>
          ) : (
            <view.Component ctx={vctx} />
          )}
        </div>
      </div>

      {importState && (
        <ImportOverlay state={importState} onCommit={commitImport} onCancel={() => setImportState(null)} />
      )}
    </div>
  );
}

const app: VaudeApp = {
  manifest: {
    id: "library",
    title: "The Library",
    markSvg: MARK_SVG,
    accent: "#3b82f6", // hardcode-ok: this app's own identity color in the shell manifest, not theme chrome
    order: 20,
    subtitle: "app",
    firstRunLanding: true, // JOURNEY 1.1: a fresh studio lands on the two doors
  },
  Component: Library,
};

export default app;
