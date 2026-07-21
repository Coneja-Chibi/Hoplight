/**
 * The Library app (CONTRACT V2, React) - the shelves, Hoplight's deep-browse room (browsing IS the
 * Library). Empty studio = the locked first-run doors; populated = the browse room: deck chips
 * with live counts, drop-in DECK VIEWS (views/registry: grid/showcase/list), the continuous
 * art-size dial, all persisted via ctx.prefs. Opens on the deck chosen at setup. Import (drop
 * anywhere, plain-words receipts) lives here.
 * Tapping pieces STAGES them (multi-select); one Send commits the whole batch to the Workbench.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, JSX } from "react";
import type { AppContext, StudioEntitySummary, HoplightApp } from "../../app-contract";
import { deckMeta, knownDecks } from "../../_shared/decks";
import { deckCounts } from "./deck-core";
import {
  ImportOverlay,
  makeImportRunners,
  pickFiles,
  type ImportState,
} from "./import-flow";
import {
  LoreWorkshopDialog,
  type LoreWorkshopState,
} from "./lore-workshop-dialog";
import {
  attachSearchKeys,
  loadLoreMeta,
  makeLoreShelf,
  type LoreMeta,
} from "./lore-shelf-ops";
import {
  loadRegexMeta,
  makeRegexShelf,
  type RegexMeta,
  type RegexWorkshopState,
} from "./regex-shelf-ops";
import { RegexWorkshopDialog } from "./regex-workshop-dialog";
import { NewInDeckButton } from "./new-in-deck-button";
import { useEntityDelete } from "./delete-flow";
import { loadPersonaMeta, makePersonaShelf, type PersonaMeta } from "./persona-shelf-ops";
import { LIBRARY_STYLE, MARK_SVG, PREF_FIRST_DECK, PREF_SIZE, PREF_VIEW } from "./styles";
import { clampSize, pieceKey, SIZE_RANGE, type DeckViewContext, type PiecePeek } from "./view-contract";
import { deckView, deckViews } from "./views/registry";

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

/**
 * "RoleCall · V3" / "CC V2" from the summary's source fields; null = made from scratch. The
 * generic Tavern reader's "Default" label meant nothing on a card chip - a plain character card
 * is a CC (character card) of some spec version, so say that.
 */
function sourceLabelFor(formatLabels: Map<string, string>, e: StudioEntitySummary): string | null {
  if (!e.sourceFormat) return null;
  const base = formatLabels.get(e.sourceFormat) ?? e.sourceFormat;
  const variant = e.sourceVariant?.toUpperCase();
  if (base === "Default") return variant ? `CC ${variant}` : "CC";
  return variant ? `${base} · ${variant}` : base;
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
  /** an unreachable studio is NOT an empty one; without this the two render identically */
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeKind, setActiveKind] = useState(typeof firstDeck === "string" && firstDeck ? firstDeck : "character");
  const [formatLabels, setFormatLabels] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [workshop, setWorkshop] = useState<LoreWorkshopState | null>(null);
  const [regexWorkshop, setRegexWorkshop] = useState<RegexWorkshopState | null>(null);
  const [loreMeta, setLoreMeta] = useState<Record<string, LoreMeta>>({});
  const [regexMeta, setRegexMeta] = useState<Record<string, RegexMeta>>({});
  const [personaMeta, setPersonaMeta] = useState<Record<string, PersonaMeta>>({});
  const [, setWorkbenchTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const [sizeRem, setSizeRem] = useState(() => clampSize(ctx.prefs.get(PREF_SIZE)));

  const reload = useCallback(() => {
    // apiFetchJson throws on any non-2xx by design, so an un-caught reload turned a dev-server
    // restart or a storage hiccup into an unhandled rejection. Worse, entities stayed [] and an
    // EMPTY list is indistinguishable from a FAILED one - the room then showed the brand-new-user
    // first landing, i.e. told a user with 32 pieces that their studio was gone. Track the failure
    // instead of inferring emptiness from it. (audit ASYNC-002)
    void (async () => {
      try {
        const list = await ctx.api.listEntities();
        setEntities(list);
        setLoadFailed(false);
        setLoreMeta(await loadLoreMeta(ctx, list));
        setRegexMeta(await loadRegexMeta(ctx, list));
        setPersonaMeta(await loadPersonaMeta(ctx, list));
      } catch {
        setLoadFailed(true);
      }
    })();
  }, [ctx]);

  useEffect(() => {
    // the workbench-driven repaint: sending/removing/focusing pieces elsewhere flips the "on the
    // workbench" marks here without this room ever calling render itself (see the sendbar handler)
    const unsub = ctx.workbench.onChange(() => setWorkbenchTick((t) => t + 1));
    // format labels are decoration: if the call fails the shelves still work, so swallow it rather
    // than let it reject unhandled (audit ASYNC-002)
    void ctx.api
      .formats()
      .then((formats) => {
        setFormatLabels(new Map(formats.map((f) => [f.id, f.generic ? "Default" : f.friendly])));
      })
      .catch(() => {
        /* labels stay unset; sourceLabel already falls back */
      });
    reload();
    return unsub;
  }, [ctx, reload]);

  const del = useEntityDelete(ctx, () => {
    setSelected(new Set());
    reload();
  });

  const allCss = useMemo(() => LIBRARY_STYLE + deckViews().map((v) => v.css).join("\n"), []);

  const openKeys = new Set(ctx.workbench.pieces().map(pieceKey));
  // drop any staged key that has since gone (opened elsewhere or deleted) so the count never lies
  const selectedValid = new Set(
    [...selected].filter((k) => !openKeys.has(k) && entities.some((e) => pieceKey(e) === k)),
  );

  const decks = deckCounts(entities, knownDecks().map((d) => d.kind));
  const deck = deckMeta(activeKind);
  const inDeck = attachSearchKeys(
    entities.filter((e) => e.kind === activeKind),
    loreMeta,
  );

  /** Stage every piece on the active shelf that is not open on the Workbench. */
  const selectAll = (): void =>
    setSelected(new Set(inDeck.filter((e) => !openKeys.has(pieceKey(e))).map(pieceKey)));

  useEffect(() => {
    ctx.setStatus(
      loadFailed
        ? "could not reach the studio · your pieces are still on disk"
        : entities.length === 0
          ? "empty studio"
          : `${deck.plural.toLowerCase()} · ${inDeck.length} of ${entities.length} pieces`,
    );
  }, [ctx, entities.length, deck, inDeck.length, loadFailed]);

  const { runImport, commitImport } = makeImportRunners({ ctx, importState, setImportState, reload });

  const onDrop = (evt: DragEvent<HTMLDivElement>): void => {
    evt.preventDefault();
    const files = [...(evt.dataTransfer?.files ?? [])];
    if (files.length) runImport(files);
  };

  if (loadFailed) {
    // NOT the first landing: this user may have a full studio we simply could not read. Offering
    // "start fresh" here would read as "your work is gone" (and invite them to act on it).
    return (
      <div className="lib">
        <style>{allCss}</style>
        <div className="stagezone seam">
          <p className="voice">Could not reach the studio. Your pieces are still on disk.</p>
          <button className="doorcard stamp" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

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
          <ImportOverlay
            state={importState}
            onCommit={commitImport}
            onCancel={() => setImportState(null)}
            onAddMore={() => pickFiles((f) => runImport(f, true))}
          />
        )}
      </div>
    );
  }

  const view = deckView(ctx.prefs.get(PREF_VIEW), activeKind);

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
    loreShelf:
      activeKind === "lorebook"
        ? makeLoreShelf({
            ctx,
            loreMeta,
            setLoreMeta,
            setWorkshop,
            reload,
          })
        : undefined,
    regexShelf:
      activeKind === "regex"
        ? makeRegexShelf({
            ctx,
            regexMeta,
            setRegexMeta,
            setWorkshop: setRegexWorkshop,
            reload,
          })
        : undefined,
    personaShelf:
      activeKind === "persona"
        ? makePersonaShelf({ ctx, personaMeta, setEntities })
        : undefined,
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
        <div className="deckchips" data-tour="decks">
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
        <div className="viewseg" data-tour="views">
          {deckViews(activeKind).map((v) => (
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
        <label className="sizedial" data-tour="size">
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
          <button
            className="del"
            onClick={() => {
              const byKey = new Map(entities.map((e) => [pieceKey(e), e]));
              del.requestDelete(
                [...selectedValid]
                  .map((k) => byKey.get(k))
                  .filter((e): e is StudioEntitySummary => !!e),
              );
            }}
          >
            {`Delete ${selectedValid.size === 1 ? "it" : `all ${selectedValid.size}`}`}
          </button>
          <button className="clear" onClick={selectAll}>
            Select all
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
            {inDeck.length > 0 && selectedValid.size === 0 && (
              <button className="crumbsel" onClick={selectAll}>
                Select all
              </button>
            )}
          </div>
          {inDeck.length === 0 ? (
            <div className="ghost-shelf">
              {`your first ${activeKind} lands here · import or start fresh`}
              <NewInDeckButton
                kind={activeKind}
                ctx={ctx}
                onCreated={(summary) =>
                  setEntities((prev) =>
                    prev.some((e) => e.kind === summary.kind && e.id === summary.id)
                      ? prev
                      : [...prev, summary],
                  )
                }
              />
            </div>
          ) : (
            <view.Component ctx={vctx} />
          )}
        </div>
      </div>

      {importState && (
        <ImportOverlay
          state={importState}
          onCommit={commitImport}
          onCancel={() => setImportState(null)}
          onAddMore={() => pickFiles((f) => runImport(f, true))}
        />
      )}
      {workshop && (
        <LoreWorkshopDialog
          ctx={ctx}
          state={workshop}
          onDismiss={() => setWorkshop(null)}
          onDone={() => {
            setWorkshop(null);
            reload();
          }}
        />
      )}
      {regexWorkshop && (
        <RegexWorkshopDialog
          ctx={ctx}
          state={regexWorkshop}
          onDismiss={() => setRegexWorkshop(null)}
          onDone={() => {
            setRegexWorkshop(null);
            reload();
          }}
        />
      )}
      {del.confirm}
    </div>
  );
}

const app: HoplightApp = {
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
