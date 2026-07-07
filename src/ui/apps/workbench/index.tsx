/**
 * The Workbench app - home: the IDE (CONTRACT V2 port of the deleted vanilla index.ts). Pieces sent
 * from the Library open here; the shell's tab strip IS the tab bar, and this room shows the ACTIVE
 * piece's editor pane. Characters get the writable editor (Editor.tsx); every other kind keeps the
 * read-only inspector until its own editor lands.
 *
 * Draft persistence: one CharacterPane stays mounted (hidden via CSS) per open character, so React
 * state IS the unsaved draft across tab switches - closing the tab unmounts it, which is the discard.
 */
import { useEffect, useState } from "react";
import type { CSSProperties, JSX, ReactNode } from "react";
import type { AppContext, StudioEntitySummary, VaudeApp } from "../../app-contract";
import { deckMeta } from "../../_shared/decks";
import { useFocusMode, FocusToggle } from "../../components/focus-toggle";
import { RenderBox } from "../../components/render-box";
import { rankRecents } from "./recents-core";
import { fieldsFor, type InspectField } from "./inspect-core";
import { CharacterEditor } from "./Editor";
import styles from "./styles.module.css";

const RECENTS_SHOWN = 14; // how many "bring one up" cards the rail offers at most
const PREF_RAIL_OPEN = "workbench.recentsOpen"; // collapse survives sessions; only explicit false closes

/** the locked bench mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="13"/><path d="M3 17h18"/><rect x="9" y="10" width="6" height="7" fill="currentColor" stroke="none"/></svg>';

const pieceKey = (id: string, kind: string): string => `${kind}:${id}`;

const portraitUrl = (e: StudioEntitySummary): string | null =>
  e.hasPortrait ? `/api/studio/portrait?kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}` : null;

const metaLine = (p: StudioEntitySummary): string => {
  const bits = [deckMeta(p.kind).plural];
  if (p.sourceFormat) bits.push(p.sourceVariant ? `${p.sourceFormat} · ${p.sourceVariant}` : p.sourceFormat);
  return bits.join("  ·  ");
};

/** the shared art + sheet frame every open piece's pane renders inside */
function PieceFrame({ ctx, piece, children }: { ctx: AppContext; piece: StudioEntitySummary; children: ReactNode }): JSX.Element {
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: piece.name, data: piece }));
  const url = portraitUrl(piece);
  return (
    <div className={styles.pane}>
      <div ref={menuRef} className={styles.art} style={url ? { backgroundImage: `url("${url}")` } : undefined}>
        {!url && <b>{piece.name.charAt(0).toUpperCase()}</b>}
      </div>
      <div className={styles.sheet}>
        <div className={styles.nm}>{piece.name}</div>
        <div className={styles.meta}>{metaLine(piece)}</div>
        {children}
      </div>
    </div>
  );
}

/** One mounted-per-open-character pane; hidden (not unmounted) while another tab is active, so its
 * edits survive the switch. Fetches its entity once, on mount. */
function CharacterPane({
  ctx,
  piece,
  hidden,
  topRight,
}: {
  ctx: AppContext;
  piece: StudioEntitySummary;
  hidden: boolean;
  topRight?: ReactNode;
}): JSX.Element {
  const [entity, setEntity] = useState<unknown | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ctx.api
      .getEntity(`kind=${encodeURIComponent(piece.kind)}&id=${encodeURIComponent(piece.id)}`)
      .then((e) => {
        if (!cancelled) setEntity(e);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        ctx.setStatus(`could not load ${piece.name}`);
      });
    return () => {
      cancelled = true;
    };
    // fetch exactly once per mounted piece: the pane stays mounted for the piece's whole tab life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id, piece.kind]);

  return (
    // the wrapper must FILL the stage (flex column, bounded height) or the pane inside can never
    // scroll - an unstyled block just grows past the stage's overflow:hidden (the unscrollable bug)
    <div className={hidden ? styles.paneWrapHidden : styles.paneWrap}>
      {/* vs-editor-2 owns the WHOLE pane (its left column IS the portrait card); PieceFrame stays
          the inspector's frame only - wrapping the editor in it doubled the art and broke 1:1 */}
      <div className={styles.paneFlush}>
        {entity ? (
          <CharacterEditor entity={entity} ctx={ctx} piece={piece} topRight={topRight} />
        ) : (
          <div className={styles.soon}>{failed ? `could not load ${piece.name}` : "loading the piece…"}</div>
        )}
      </div>
    </div>
  );
}

/** Non-character kinds: the truthful read-only inspector, re-fetched fresh each time it activates
 * (nothing here needs to survive a tab switch - there is no draft). */
function InspectorPane({ ctx, piece }: { ctx: AppContext; piece: StudioEntitySummary }): JSX.Element {
  const [fields, setFields] = useState<InspectField[]>([]);

  useEffect(() => {
    let cancelled = false;
    setFields([]);
    void ctx.api
      .getEntity(`kind=${encodeURIComponent(piece.kind)}&id=${encodeURIComponent(piece.id)}`)
      .then((entity) => {
        if (cancelled) return;
        setFields(fieldsFor(piece.kind, (entity as { body?: unknown }).body));
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, piece.id, piece.kind]);

  return (
    <PieceFrame ctx={ctx} piece={piece}>
      <div className={styles.sheet} style={{ gap: ".7rem" }}>
        {fields.map((f) => (
          <div className={styles.field} key={f.k}>
            <div className={styles.fk}>{f.k}</div>
            <div className={styles.fv}>
              <RenderBox value={f.v} format={f.format} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.soon}>read-only for now · full editing lands here next</div>
    </PieceFrame>
  );
}

function RecentCard({ ctx, entity }: { ctx: AppContext; entity: StudioEntitySummary }): JSX.Element {
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: entity.name, data: entity }));
  const url = portraitUrl(entity);
  return (
    <button
      ref={menuRef}
      type="button"
      className={styles.rcard}
      style={{ "--a": entity.accent ?? deckMeta(entity.kind).accent } as CSSProperties}
      title={`Bring ${entity.name} up`}
      onClick={() => ctx.workbench.send(entity)}
    >
      <div className={styles.rcov} style={url ? { backgroundImage: `url("${url}")` } : undefined}>
        {!url && <b>{entity.name.charAt(0).toUpperCase()}</b>}
      </div>
      <div className={styles.rnm}>{entity.name}</div>
    </button>
  );
}

/** The low deck of recently imported/opened pieces - the "wanna bring this one up?" offer. Renders
 * nothing when no entity qualifies (empty studio, or everything recent is already an open tab). */
function RecentsRail({ ctx, entities }: { ctx: AppContext; entities: StudioEntitySummary[] }): JSX.Element | null {
  const [open, setOpen] = useState<boolean>(() => ctx.prefs.get(PREF_RAIL_OPEN) !== false); // default open

  // editing takes the room: whenever the ACTIVE piece changes, the rail folds itself away
  // (the show button still reopens it; the next piece folds it again)
  const active = ctx.workbench.active();
  const activeKey = active ? pieceKey(active.id, active.kind) : "";
  useEffect(() => {
    if (activeKey) setOpen(false);
  }, [activeKey]);

  const openKeys = new Set(ctx.workbench.pieces().map((p) => pieceKey(p.id, p.kind)));
  const recent = rankRecents(entities, ctx.workbench.recents(), openKeys, RECENTS_SHOWN);
  if (recent.length === 0) return null;

  const toggleOpen = (): void => {
    const next = !open;
    setOpen(next);
    ctx.prefs.set(PREF_RAIL_OPEN, next);
  };

  return (
    <div className={styles.recents}>
      <button type="button" className={styles.rlabel} aria-expanded={open} onClick={toggleOpen}>
        <span className={styles.pip} />
        recent · bring one up
        <span className={styles.rtog}>{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className={styles.strip}>
          {recent.map((e) => (
            <RecentCard key={pieceKey(e.id, e.kind)} ctx={ctx} entity={e} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Subscribes to the shell's workbench-change signal (open pieces / active tab) and forces a
 * re-render so `ctx.workbench.pieces()/.active()` (plain getters, not reactive on their own) stay
 * live in this component. */
function useWorkbenchTick(ctx: AppContext): void {
  const [, setTick] = useState(0);
  useEffect(() => ctx.workbench.onChange(() => setTick((t) => t + 1)), [ctx]);
}

function WorkbenchRoom({ ctx }: { ctx: AppContext }): JSX.Element {
  useWorkbenchTick(ctx);
  const [entities, setEntities] = useState<StudioEntitySummary[]>([]);
  const { focused, toggle } = useFocusMode();

  useEffect(() => {
    void ctx.api.listEntities().then(setEntities);
    // mount-once on purpose: ctx identity churns on every store write (whole-store reactivity), and
    // the shelf list only feeds the recents rail - refreshing it per keystroke would be noise
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pieces = ctx.workbench.pieces();
  const active = ctx.workbench.active();
  const activeKey = active ? pieceKey(active.id, active.kind) : "";
  const characterPieces = pieces.filter((p) => p.kind === "character");

  useEffect(() => {
    if (active) return; // ONE writer per status line: the editor owns it while a piece is open
    ctx.setStatus(pieces.length === 0 ? "the workbench is clear" : `${pieces.length} open`);
    // ctx is a stable adapter over the store; depending on its identity re-fires this on every
    // store write and (with a second writer) ping-pongs the status into an update-depth loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces.length, activeKey]);

  // NO crumb bar and NO prosc wrapper: the name lives in the shell tab strip + the editor header,
  // the count lives in the status bar, and every wrapper layer between the window and the cards is
  // prime vertical space (the editor's own top rows are the room's chrome now). The focus toggle
  // rides inside the editor's tab strip; the empty room keeps it beside the ghost text.
  const focusNode = <FocusToggle focused={focused} onToggle={toggle} />;
  return (
    <div className={`${styles.room}${focused ? ` ${styles.focused}` : ""}`}>
      <div className={styles.stage} style={active?.accent ? ({ "--a": active.accent } as CSSProperties) : undefined}>
        {!active && (
          <div className={styles.ghostRoom}>
            nothing is open on the workbench · open the Library and send pieces here · each one opens as a tab above
            <div className={styles.ghostFocus}>{focusNode}</div>
          </div>
        )}
        {characterPieces.map((p) => (
          <CharacterPane
            key={pieceKey(p.id, p.kind)}
            ctx={ctx}
            piece={p}
            hidden={pieceKey(p.id, p.kind) !== activeKey}
            topRight={focusNode}
          />
        ))}
        {active && active.kind !== "character" && <InspectorPane ctx={ctx} piece={active} />}
      </div>
      {/* the rail is an empty-bench amenity: while a piece is open, even its folded label is a
          dead row - it vanishes entirely and returns when the bench clears */}
      {!focused && !active && <RecentsRail ctx={ctx} entities={entities} />}
    </div>
  );
}

const app: VaudeApp = {
  manifest: {
    id: "workbench",
    title: "The Workbench",
    markSvg: MARK_SVG,
    accent: "#e6a52a", // hardcode-ok: app identity color, not theme chrome
    order: 10,
    subtitle: "app · home",
    editsPieces: true, // the shell's tab strip focuses into this room
  },
  Component: ({ ctx }) => <WorkbenchRoom ctx={ctx} />,
};

export default app;
