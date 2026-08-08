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
import type { AppContext, StudioDamagedEntry, StudioEntitySummary, HoplightApp } from "../../app-contract";
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
import { createAndOpenCharacter } from "../../_shared/new-character";
import { useEntityDelete } from "./delete-flow";
import { consumeImportRequests } from "../../_shared/import-signal";
import { peekPiece, sourceLabelFor } from "./piece-peek";
import { loadPersonaMeta, makePersonaShelf, type PersonaMeta } from "./persona-shelf-ops";
import { LIBRARY_STYLE, MARK_SVG, PREF_FIRST_DECK, PREF_SIZE, PREF_VIEW } from "./styles";
import { clampSize, pieceKey, SIZE_RANGE, type DeckViewContext, type PiecePeek } from "./view-contract";
import { deckView, deckViews } from "./views/registry";
import { DamageNotice } from "./damage-notice";
import { FirstLanding, StudioUnreachable } from "./first-landing";
import { LIBRARY_AGENT_SURFACE, usePublishLibrarySurface, useReloadOnStudioChange } from "./agent-surface";
import { isFilteredEmpty, matchesByKind, parseQuery, resultLine, searchPieces, unknownHint } from "./search-core";
import { NoMatchNotice, SearchBox } from "./search-bar";
import { SendBar } from "./send-bar";
import { attachCollections, useCollections } from "./collections-ops";
import { usePicking } from "./use-picking";
import { CollectionsBar } from "./collections-bar";

// -- the browse room --------------------------------------------------------------------------------

const portraitUrl = (e: StudioEntitySummary): string | null =>
  e.hasPortrait ? `/api/studio/portrait?kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}` : null;

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
  const [damaged, setDamaged] = useState<StudioDamagedEntry[]>([]);
  const [studioDir, setStudioDir] = useState<string>();
  /** an unreachable studio is NOT an empty one; without this the two render identically */
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeKind, setActiveKind] = useState(typeof firstDeck === "string" && firstDeck ? firstDeck : "character");
  const [formatLabels, setFormatLabels] = useState<Map<string, string>>(new Map());
  const picking = usePicking();
  const selected = picking.selected;
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [query, setQuery] = useState("");
  const [workshop, setWorkshop] = useState<LoreWorkshopState | null>(null);
  const [regexWorkshop, setRegexWorkshop] = useState<RegexWorkshopState | null>(null);
  const [loreMeta, setLoreMeta] = useState<Record<string, LoreMeta>>({});
  const [regexMeta, setRegexMeta] = useState<Record<string, RegexMeta>>({});
  const [personaMeta, setPersonaMeta] = useState<Record<string, PersonaMeta>>({});
  const [, setWorkbenchTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const [sizeRem, setSizeRem] = useState(() => clampSize(ctx.prefs.get(PREF_SIZE)));
  const collections = useCollections(ctx);

  const reload = useCallback(() => {
    // apiFetchJson throws on any non-2xx by design, so an un-caught reload turned a dev-server
    // restart or a storage hiccup into an unhandled rejection. A failed read is not an empty studio.
    void (async () => {
      try {
        const [inventory, version] = await Promise.all([
          ctx.api.studioInventory(),
          ctx.api.version().catch(() => ({ version: "", studioDir: undefined })),
        ]);
        const list = inventory.entities;
        setEntities(list);
        setDamaged(inventory.damaged);
        setStudioDir(version.studioDir);
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
    // Format labels are decorative; shelves still work when this request fails.
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
    picking.replace([]);
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

  /**
   * SEARCH IS A PASS OVER STATE, NEVER A RE-FETCH. The whole studio is already in memory here, so
   * a keystroke costs one walk of 164 objects and zero round trips; asking the server per keystroke
   * would also re-read every lorebook, book by book (see useReloadOnStudioChange's note on what
   * that costs).
   *
   * It runs over the WHOLE studio rather than the active deck, because "no presets match, but
   * three lorebooks do" is the answer somebody actually needs when they cannot remember which shelf
   * they put a thing on. The stage still shows one deck; the chips and the no-match notice carry
   * the rest.
   */
  const parsed = useMemo(() => parseQuery(query), [query]);
  const records = useMemo(
    () =>
      // Collection membership rides in the same way a lorebook's keywords do: attached by the room,
      // because a piece cannot know which groups somebody put it in. See collections-ops.ts.
      attachCollections(
        attachSearchKeys(entities, loreMeta).map((e) => ({ ...e, sourceLabel: sourceLabelFor(formatLabels, e) })),
        collections.index,
      ),
    [entities, loreMeta, formatLabels, collections.index],
  );
  const hits = useMemo(() => searchPieces(records, parsed), [records, parsed]);
  const perDeck = matchesByKind(hits);
  const matched = new Map(perDeck.map((m) => [m.kind, m.count]));
  const inDeck = hits.filter((h) => h.piece.kind === activeKind).map((h) => h.piece);
  const deckTotal = decks.find((d) => d.kind === activeKind)?.count ?? 0;
  const elsewhere = hits.length - inDeck.length;
  const searchLine = resultLine({
    active: parsed.active, deckPlural: deck.plural, shown: inDeck.length, deckTotal, elsewhere,
  });

  /** Stage every piece on the active shelf that is not open on the Workbench. While a search is
   *  running that means every MATCH, which is the only reading of "all" that agrees with the eye. */
  const selectAll = (): void =>
    picking.replace(inDeck.filter((e) => !openKeys.has(pieceKey(e))).map(pieceKey));

  const stagedRefs = entities.filter((e) => selectedValid.has(pieceKey(e)));

  useReloadOnStudioChange(reload);
  /**
   * The FILTERED shelf is what gets published, and the search text rides along. Republishing while
   * somebody types is real state change, not the render echo agent-surface.ts guards against: the
   * shelf genuinely changed. The filter has to be named there, or an agent reads "3 characters"
   * off a studio holding forty and reports the other thirty-seven as missing.
   */
  usePublishLibrarySurface(ctx, {
    deck: deck.plural, inDeck, total: entities.length, damaged, staged: selectedValid, loadFailed,
    filter: parsed.active ? query : undefined,
  });

  useEffect(() => {
    ctx.setStatus(
      loadFailed
        ? "could not reach the studio · your pieces are still on disk"
        : entities.length === 0
          ? damaged.length > 0
            ? `no readable pieces · ${damaged.length} unreadable ${damaged.length === 1 ? "file" : "files"}`
            : "empty studio"
          : searchLine || `${deck.plural.toLowerCase()} · ${inDeck.length} of ${entities.length} pieces`,
    );
  }, [ctx, damaged.length, entities.length, deck, inDeck.length, loadFailed, searchLine]);

  const { runImport, commitImport, cancelImport } = makeImportRunners({ ctx, importState, setImportState, reload });

  // the shell's Import button + global file drops arrive here: picker when empty-handed,
  // straight to the receipts when files rode along. Latest runImport via ref (stable listener).
  const runImportRef = useRef(runImport);
  runImportRef.current = runImport;
  useEffect(
    () =>
      consumeImportRequests((files) => {
        if (files) runImportRef.current(files);
        else pickFiles((picked) => runImportRef.current(picked));
      }),
    [],
  );

  const onDrop = (evt: DragEvent<HTMLDivElement>): void => {
    evt.preventDefault();
    const files = [...(evt.dataTransfer?.files ?? [])];
    if (files.length) runImport(files);
  };

  /** Shelve a freshly created piece without waiting for a whole studio re-read. */
  const addEntity = (summary: StudioEntitySummary): void =>
    setEntities((prev) =>
      prev.some((e) => e.kind === summary.kind && e.id === summary.id) ? prev : [...prev, summary],
    );

  const overlay = importState ? (
    <ImportOverlay
      state={importState}
      onCommit={commitImport}
      onCancel={cancelImport}
      onAddMore={() => pickFiles((f) => runImport(f, true))}
    />
  ) : null;

  const doors = { css: allCss, damaged, studioDir };
  if (loadFailed) return <StudioUnreachable {...doors} onRetry={reload} />;

  if (entities.length === 0) {
    return (
      <FirstLanding
        {...doors}
        onDrop={onDrop}
        onPickImport={() => pickFiles(runImport)}
        onStartFresh={() => {
          void createAndOpenCharacter(ctx).then(
            (summary) => {
              addEntity(summary);
              ctx.workbench.open(summary);
              ctx.setStatus(`opened character · ${summary.name}`);
            },
            (err) => ctx.setStatus(err instanceof Error ? err.message : "could not create a character"),
          );
        }}
        overlay={overlay}
      />
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
    onPiece: (e, mods) => {
      const key = pieceKey(e);
      if (openKeys.has(key) && !mods?.shift) {
        ctx.setStatus(`${e.name} is already on the Workbench`); // open = annotation, not a toggle
        return;
      }
      // Ranges run over what is DRAWN, so the order is this deck's, after search and ranking.
      picking.press(key, mods ?? { shift: false, meta: false }, inDeck.map(pieceKey), openKeys);
    },
    onSweep: (cards, box, additive) => { picking.sweep(cards, box, additive, openKeys); },
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
      <DamageNotice entries={damaged} studioDir={studioDir} prefs={ctx.prefs} />
      <div className="wbbar">
        <div className="deckchips" data-tour="decks">
          {decks.map(({ kind, count }) => {
            const meta = deckMeta(kind);
            // While a search runs the chip counts MATCHES, so the row doubles as the cross-deck
            // result summary; the title keeps the real total so no count ever reads as a loss.
            const shown = matched.get(kind) ?? 0;
            return (
              <button
                key={kind}
                className={`dchip${kind === activeKind ? " on" : ""}${parsed.active && shown === 0 ? " nil" : ""}`}
                style={{ "--a": meta.accent } as CSSProperties}
                title={parsed.active ? `${String(shown)} of ${String(count)} match` : `${String(count)} in the studio`}
                onClick={() => setActiveKind(kind)}
              >
                <span className="pip" />
                {meta.plural}
                <span className="dc">{parsed.active ? shown : count}</span>
              </button>
            );
          })}
        </div>
        <SearchBox value={query} onChange={setQuery} hint={unknownHint(parsed.unknown)} />
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

      <CollectionsBar room={collections} query={query} setQuery={setQuery} staged={stagedRefs} />

      <SendBar
        staged={selectedValid}
        entities={entities}
        onSend={(batch) => {
          picking.replace([]);
          // sendMany opens the pieces (firing workbench.onChange -> this room repaints with the
          // staged marks gone) and, in "always" mode, navigates to the Workbench; forcing our
          // own render here would clobber that navigation, so we deliberately don't.
          ctx.workbench.sendMany(batch);
        }}
        onDelete={(batch) => del.requestDelete(batch)}
        onSelectAll={selectAll}
        onClear={() => picking.replace([])}
      />

      <div className="prosc">
        <div className="libstage" style={{ "--a": deck.accent } as CSSProperties}>
          <div className="stage-crumb">
            <span className="pip" />
            <span className="cn">{deck.plural}</span>
            <span className="cc">
              {inDeck.length
                ? `${view.label.toLowerCase()} · ${inDeck.length}${parsed.active ? ` of ${deckTotal}` : ""}`
                : isFilteredEmpty(parsed, deckTotal)
                  ? "no match"
                  : "deck empty"}
            </span>
            {inDeck.length > 0 && (
              <span style={{ marginLeft: "auto", display: "flex", gap: "0.35rem" }}>
                <NewInDeckButton compact kind={activeKind} ctx={ctx} onCreated={addEntity} />
                {selectedValid.size === 0 && (
                  <button className="crumbsel" onClick={selectAll}>
                    Select all
                  </button>
                )}
              </span>
            )}
          </div>
          {inDeck.length === 0 ? (
            // A SHELF FILTERED TO NOTHING IS NOT AN EMPTY SHELF, and the reverse holds too: a deck
            // holding nothing was not filtered. isFilteredEmpty owns both halves of that judgement.
            isFilteredEmpty(parsed, deckTotal) ? (
              <NoMatchNotice
                query={query}
                deckPlural={deck.plural}
                deckTotal={deckTotal}
                elsewhere={perDeck.filter((m) => m.kind !== activeKind)}
                onJump={setActiveKind}
                onClear={() => setQuery("")}
              />
            ) : (
              <div className="ghost-shelf">
                {`your first ${activeKind} lands here · import or start fresh`}
                <NewInDeckButton kind={activeKind} ctx={ctx} onCreated={addEntity} />
              </div>
            )
          ) : (
            <view.Component ctx={vctx} />
          )}
        </div>
      </div>

      {overlay}
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
    agentSurface: LIBRARY_AGENT_SURFACE,
  },
  Component: Library,
};

export default app;
