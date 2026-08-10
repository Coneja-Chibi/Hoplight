/**
 * The Workbench app - home: the IDE (CONTRACT V2 port of the deleted vanilla index.ts). Pieces sent
 * from the Library open here; the shell's tab strip IS the tab bar, and this room shows the ACTIVE
 * piece's editor pane. Every kind opens its own writable editor (character, pack, lorebook, regex,
 * persona, preset).
 *
 * Draft persistence: one CharacterPane stays mounted (hidden via CSS) per open character, so React
 * state IS the unsaved draft across tab switches - closing the tab unmounts it, which is the discard.
 */
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, JSX, ReactNode } from "react";
import type { AppContext, StudioEntitySummary, HoplightApp } from "../../app-contract";
import { accentVars, deckMeta } from "../../_shared/decks";
import { useReopenOnStudioChange } from "../../agent/use-studio-changes";
import { useFocusMode, FocusToggle } from "../../components/focus-toggle";
import { rankRecents } from "./recents-core";
import { CharacterEditor } from "./Editor";
import { PackEditor } from "./PackEditor";
import { LorebookEditor } from "./LorebookEditor";
import { RegexSetEditor } from "./RegexSetEditor";
import { PersonaEditor } from "./PersonaEditor";
import { PresetEditor } from "./PresetEditor";
import { emptyPackBody } from "../../../entities/pack/schema";
import { emptyLorebookBody } from "../../../core/lore";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import { keyOf, paneKeyOf } from "../../_shared/piece-key";
import { WORKBENCH_AGENT_SURFACE, usePublishWorkbenchSurface } from "./agent-surface";
import styles from "./styles.module.css";

const RECENTS_SHOWN = 14; // how many "bring one up" cards the rail offers at most
const PREF_RAIL_OPEN = "workbench.recentsOpen"; // collapse survives sessions; only explicit false closes

/** the locked bench mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
  '<path d="M3 11h18"/><path d="M6 11v9M18 11v9"/><rect x="8.5" y="3.5" width="7" height="7.5"/>' +
  "</svg>";

const portraitUrl = (e: StudioEntitySummary): string | null =>
  e.hasPortrait ? `/api/studio/portrait?kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}` : null;

/** One mounted-per-open editable piece; hidden (not unmounted) while another tab is active. */
function EditablePane({
  ctx,
  piece,
  hidden,
  beside,
  topRight,
}: {
  ctx: AppContext;
  piece: StudioEntitySummary;
  hidden: boolean;
  /** rendered as the second pane of a split: seam on its left, ordered after the active pane */
  beside?: boolean;
  topRight?: ReactNode;
}): JSX.Element {
  const [source, setSource] = useState<{ entity: unknown; revision: string } | null>(null);
  const [failed, setFailed] = useState(false);

  /** Named so a studio change can run it again; the mount effect just calls it once. */
  const load = useCallback((): (() => void) => {
    let cancelled = false;
    void ctx.api
      .getEditableEntity(`kind=${encodeURIComponent(piece.kind)}&id=${encodeURIComponent(piece.id)}`)
      .then((loaded) => {
        if (!cancelled) setSource(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        ctx.setStatus(`could not load ${piece.name}`);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id, piece.kind]);

  useEffect(() => load(), [load]);

  /**
   * THE FILE CHANGED UNDERNEATH: re-read it, unless this piece has unsaved work.
   *
   * The agent applying a change writes the same file this editor is showing, and without this the
   * bench went on displaying what it read when it opened - which is exactly the "it said it
   * applied it and nothing moved" the rail had. Declining while dirty is the rule Kit's rail
   * settled: a stale view is an annoyance, losing a rearrange is not.
   */
  useReopenOnStudioChange(
    piece,
    ctx.workbench.dirty()[keyOf(piece.id, piece.kind)] === true,
    () => { load(); },
  );

  const editor =
    source == null ? null
    : piece.kind === "pack" ? (
      <PackEditor entity={source.entity} revision={source.revision} ctx={ctx} piece={piece} topRight={topRight} />
    ) : piece.kind === "lorebook" ? (
      <LorebookEditor entity={source.entity} revision={source.revision} ctx={ctx} piece={piece} topRight={topRight} />
    ) : piece.kind === "regex" ? (
      <RegexSetEditor entity={source.entity} revision={source.revision} ctx={ctx} piece={piece} topRight={topRight} />
    ) : piece.kind === "persona" ? (
      <PersonaEditor entity={source.entity} revision={source.revision} ctx={ctx} piece={piece} topRight={topRight} />
    ) : piece.kind === "preset" ? (
      <PresetEditor entity={source.entity} revision={source.revision} ctx={ctx} piece={piece} topRight={topRight} />
    ) : (
      <CharacterEditor entity={source.entity} revision={source.revision} ctx={ctx} piece={piece} topRight={topRight} />
    );

  return (
    <div
      className={
        hidden ? styles.paneWrapHidden : beside ? `${styles.paneWrap} ${styles.paneWrapBeside}` : styles.paneWrap
      }
      style={beside ? { order: 1 } : undefined}
    >
      <div className={styles.paneFlush}>
        {editor ?? (
          <div className={styles.soon}>
            {failed ? `could not load ${piece.name}` : "loading the piece…"}
          </div>
        )}
      </div>
    </div>
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
      style={accentVars(entity.accent ?? deckMeta(entity.kind).accent) as CSSProperties}
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
  const activeKey = active ? keyOf(active.id, active.kind) : "";
  useEffect(() => {
    if (activeKey) setOpen(false);
  }, [activeKey]);

  const openKeys = new Set(ctx.workbench.pieces().map((p) => keyOf(p.id, p.kind)));
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
            <RecentCard key={keyOf(e.id, e.kind)} ctx={ctx} entity={e} />
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
    // rail-only data: a failed load leaves the rail empty, which is survivable, but never unhandled
    void ctx.api
      .listEntities()
      .then(setEntities)
      .catch(() => ctx.setStatus("could not load the shelf list · the studio may be unreachable"));
    // mount-once on purpose: ctx identity churns on every store write (whole-store reactivity), and
    // the shelf list only feeds the recents rail - refreshing it per keystroke would be noise
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pieces = ctx.workbench.pieces();
  const active = ctx.workbench.active();
  const beside = ctx.workbench.beside();
  // paneKey includes focusEntry so one lorebook can sit beside itself on two entries
  const activeKey = active ? paneKeyOf(active) : "";
  const besideKey = beside ? paneKeyOf(beside) : "";
  const editablePieces = pieces.filter(
    (p) =>
      p.kind === "character" ||
      p.kind === "pack" ||
      p.kind === "lorebook" ||
      p.kind === "regex" ||
      p.kind === "persona" ||
      p.kind === "preset",
  );
  // the split is real only when the beside piece can actually render an editor here
  const splitOn =
    besideKey !== "" && editablePieces.some((p) => paneKeyOf(p) === besideKey);

  // the agent window's live half: which pieces are open, which one is being edited, which are unsaved
  usePublishWorkbenchSurface(ctx, { pieces, activeKey, besideKey: splitOn ? besideKey : "" });

  useEffect(() => {
    if (active) return; // ONE writer per status line: the editor owns it while a piece is open
    ctx.setStatus(pieces.length === 0 ? "the workbench is clear" : `${pieces.length} open`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces.length, activeKey]);

  const focusNode = <FocusToggle focused={focused} onToggle={toggle} />;

  const newPack = async (): Promise<void> => {
    const body = emptyPackBody("New pack");
    // guarded like EditablePane's save: these two buttons are the empty workbench's only CTAs, and a
    // failed save must say so instead of visibly doing nothing
    let saved: Awaited<ReturnType<typeof ctx.api.saveEntity>>;
    try {
      saved = await ctx.api.saveEntity({
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "pack",
        id: "pack",
        body,
      });
    } catch (e) {
      ctx.setStatus(`could not create the pack · ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const summary: StudioEntitySummary = {
      id: saved.id,
      kind: "pack",
      name: saved.name || body.name,
      accent: saved.accent,
    };
    ctx.workbench.send(summary);
    setEntities((prev) => {
      if (prev.some((e) => e.kind === "pack" && e.id === saved.id)) return prev;
      return [...prev, summary];
    });
    ctx.setStatus(`opened pack folder · ${summary.name}`);
  };

  const newLorebook = async (): Promise<void> => {
    const body = emptyLorebookBody("Untitled lorebook");
    let saved: Awaited<ReturnType<typeof ctx.api.saveEntity>>;
    try {
      saved = await ctx.api.saveEntity({
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "lorebook",
        id: "lorebook",
        body,
      });
    } catch (e) {
      ctx.setStatus(`could not create the lorebook · ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const summary: StudioEntitySummary = {
      id: saved.id,
      kind: "lorebook",
      name: saved.name || body.name,
      accent: saved.accent,
    };
    ctx.workbench.send(summary);
    setEntities((prev) => {
      if (prev.some((e) => e.kind === "lorebook" && e.id === saved.id)) return prev;
      return [...prev, summary];
    });
    ctx.setStatus(`opened lorebook · ${summary.name}`);
  };

  return (
    <div className={`${styles.room}${focused ? ` ${styles.focused}` : ""}`}>
      <div className={styles.stage} style={accentVars(active?.accent) as CSSProperties | undefined}>
        {!active && (
          <div className={styles.ghostRoom}>
            nothing is open on the workbench · open the Library and send pieces here · each one opens as a tab above
            <div className={styles.ghostFocus}>
              {focusNode}
              <button type="button" className={styles.newPackBtn} onClick={() => void newPack()}>
                New pack folder
              </button>
              <button type="button" className={styles.newPackBtn} onClick={() => void newLorebook()}>
                New lorebook
              </button>
            </div>
          </div>
        )}
        <div className={splitOn ? `${styles.paneRow} ${styles.paneRowSplit}` : styles.paneRow}>
          {editablePieces.map((p) => {
            const key = paneKeyOf(p);
            return (
              <EditablePane
                key={key}
                ctx={ctx}
                piece={p}
                hidden={key !== activeKey && !(splitOn && key === besideKey)}
                beside={splitOn && key === besideKey}
                topRight={focusNode}
              />
            );
          })}
        </div>
      </div>
      {/* the rail is an empty-bench amenity: while a piece is open, even its folded label is a
          dead row - it vanishes entirely and returns when the bench clears */}
      {!focused && !active && <RecentsRail ctx={ctx} entities={entities} />}
    </div>
  );
}

const app: HoplightApp = {
  manifest: {
    id: "workbench",
    title: "The Workbench",
    markSvg: MARK_SVG,
    accent: "var(--stage-warn)", // hardcode-ok: app identity color, not theme chrome
    order: 10,
    subtitle: "app · home",
    editsPieces: true, // the shell's tab strip focuses into this room
    agentSurface: WORKBENCH_AGENT_SURFACE,
  },
  Component: ({ ctx }) => <WorkbenchRoom ctx={ctx} />,
};

export default app;
