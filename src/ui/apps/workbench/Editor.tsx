/**
 * Character editor shell: draft/save/lens state and presenter choice.
 * Field bodies and layouts live in presenters/; controls in controls/.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, JSX, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { AppContext, CoverageInfo, StudioEntitySummary } from "../../app-contract";
import type { OffTarget } from "../../components/platform-tabs";
import { accentVars } from "../../_shared/decks";
import { completionOf, deepEq, EDITOR_CARDS, lensVerdict, readPath, reconcileOrder, writePath } from "./editor-core";
import { signatureFromPng } from "../../../studio/signature-color";
import { hasSeenTour, tourSeenKey } from "../../tours/tour-core";
import { StubEditor, type Stub } from "../../components/native-card";
import { useVariants } from "./use-variants";
import type { NamedAssetsValue, SpritePackValue } from "../../../core/media";
import { bodyWithFaceOnly, bodyWithPack, originalWithNamedBag, originalWithPack } from "./media/session";
import { parseScale, rec, str, strArr } from "./editor-derive";
import { migrateLensTargets } from "../../../formats/_shared/extension-platforms";
import { EditorTabstrip, EditorHeader } from "./presenters/editor-chrome";
import { EditorDialogs } from "./presenters/editor-dialogs";
import { buildEditorBodyViews } from "./presenters/editor-body-views";
import { EditorLeftCard, mediaBundle, resolveArtUrl } from "./presenters/editor-left";
import { runEditorSave } from "./editor-save";
import { useEditorGuards } from "./use-editor-guards";
import styles from "./editor-styles";

const PREF_TARGETS = "editor.targets";
const PREF_OFF_TARGET = "editor.offTarget";
const PREF_EDITOR_SCALE = "editor.scale";
const PREF_EDITOR_LAYOUT = "editor.layout";
const PREF_EDITOR_MODE = "editor.mode";
const SCALE_MIN = 0.5;
const SCALE_MAX = 2;
const SCALE_STEP = 0.1;

export interface CharacterEditorProps {
  /** the fetched entity (summary fields + canonical body) - fetched once by the caller */
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  /** room chrome hoisted into the editor's own tab strip (the focus toggle) - no crumb bar exists */
  topRight?: ReactNode;
}

/** Build the writable pane for one canonical character (the vs-editor-2 surface, 1:1). */
export function CharacterEditor({ entity, revision, ctx, piece, topRight }: CharacterEditorProps): JSX.Element {
  const revisionRef = useRef(revision);
  const [init] = useState(() => {
    const ent = rec(entity);
    const baseline = structuredClone(rec(ent.body));
    const savedOrder = rec(baseline.presentation).fieldOrder;
    return {
      ent,
      baseline,
      hadOrder: Array.isArray(savedOrder) && savedOrder.length > 0,
      order: reconcileOrder(savedOrder),
    };
  });
  const [baseline, setBaseline] = useState(init.baseline);
  const [baseDraft, setBaseDraft] = useState(init.baseline);
  // portrait-strip variants: `draft` DISPLAYS the base with the active variant merged in, and `setField`
  // writes either the base or the active variant's overrides. Save + dirty stay on baseDraft. (use-variants)
  const vary = useVariants(baseDraft, setBaseDraft);
  const draft = vary.draft;
  const setField = vary.setField;
  // the entity's kept-whole original (the platform natives) edits separately from the canonical body,
  // then merges back at save. Native fields (per platform) bind here through readPath/writePath.
  // tolerate the pre-rename key so cards saved before the migration still surface their native data
  const initOriginal = (): Record<string, unknown> => rec(init.ent.original ?? init.ent.escrow ?? {});
  const [originalDraft, setOriginalDraft] = useState(() => structuredClone(initOriginal()));
  const [nativeBaseline, setNativeBaseline] = useState(() => structuredClone(initOriginal()));
  const [order] = useState(init.order);
  const orderBaselineRef = useRef(init.order);
  const [saving, setSaving] = useState(false);
  // Quiz is the default presenter; Grid (the bento) is the power view. The toggle in the header
  // switches between them - both pure views over the same draft - and the choice is remembered, so a
  // creator who lives in Grid is not dropped back into the quiz on every open.
  const [mode, setModeState] = useState<"grid" | "interview">(() =>
    ctx.prefs.get(PREF_EDITOR_MODE) === "grid" ? "grid" : "interview",
  );
  const setMode = (m: "grid" | "interview"): void => {
    setModeState(m);
    ctx.prefs.set(PREF_EDITOR_MODE, m);
  };
  const [flowIndex, setFlowIndex] = useState(0); // how many questions the guided flow has revealed
  const [workshop, setWorkshop] = useState(false); // the behavior/scripts workspace, beside the field editor
  const [exportOpen, setExportOpen] = useState(false);
  const [spritesOpen, setSpritesOpen] = useState(false);
  const [spritesFocusLabel, setSpritesFocusLabel] = useState<string | null>(null);
  const [namedOpen, setNamedOpen] = useState(false);
  const [packCatalog, setPackCatalog] = useState<{ id: string; name: string }[]>([]);
  const activeCardRef = useRef<HTMLDivElement>(null);

  // drag-resizable split between the question card and the stage (the user sets the balance)
  const [splitPct, setSplitPct] = useState(42);
  const quizRef = useRef<HTMLDivElement>(null);
  const onSplitDown = (e: ReactPointerEvent): void => {
    e.preventDefault();
    const move = (ev: PointerEvent): void => {
      const el = quizRef.current;
      if (el === null) return;
      const r = el.getBoundingClientRect();
      const pct = ((ev.clientX - r.left) / r.width) * 100;
      setSplitPct(Math.max(24, Math.min(72, pct)));
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flowIndex]);

  // the character's own accent, derived from its portrait art (signatureColor), lights the stage.
  // Client-side decode: the portrait bytes are fetched once and reduced to one hue; failure = no color.
  const [artAccent, setArtAccent] = useState<string | null>(null);
  useEffect(() => {
    if (!piece.hasPortrait) {
      setArtAccent(null);
      return;
    }
    let cancelled = false;
    const url = `/api/studio/portrait?kind=${encodeURIComponent(piece.kind)}&id=${encodeURIComponent(piece.id)}`;
    void (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const color = signatureFromPng(new Uint8Array(await res.arrayBuffer()));
        if (!cancelled && color !== null) setArtAccent(color);
      } catch {
        // no accent; the stage falls back to the house accent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [piece.id, piece.kind, piece.hasPortrait]);
  const [coverage, setCoverage] = useState<CoverageInfo[]>([]);
  // Fold retired thin-host tabs (characterai/crushon/janitor) into Default once.
  const [targets, setTargets] = useState<string[]>(() => {
    const raw = strArr(ctx.prefs.get(PREF_TARGETS));
    const next = migrateLensTargets(raw);
    if (JSON.stringify(next) !== JSON.stringify(raw)) ctx.prefs.set(PREF_TARGETS, next);
    return next;
  });
  // Default hide: lean platforms (Pyg, etc.) must not leave a wall of empty off-target shells.
  // Dim remains available for "show me what will not travel" honesty.
  const [offTarget, setOffTarget] = useState<OffTarget>(() => {
    const v = ctx.prefs.get(PREF_OFF_TARGET);
    if (v === "dim") return "dim";
    return "hide";
  });
  // editor-wide content scale, remembered APP-WIDE (prefs, same as targets): sizes the grid/quiz
  // content up or down. Persists across characters, presenters, and fullscreen; 1 = default.
  const [editorScale, setEditorScaleState] = useState<number>(() => parseScale(ctx.prefs.get(PREF_EDITOR_SCALE)));
  // the ref holds the live scale so rapid +/- clicks accumulate from the latest value, not a stale
  // render's (two quick clicks would otherwise both read the same number and lose a step).
  const scaleRef = useRef(editorScale);
  const setEditorScale = (next: number): void => {
    const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(next * 100) / 100));
    scaleRef.current = clamped;
    setEditorScaleState(clamped);
    ctx.prefs.set(PREF_EDITOR_SCALE, clamped);
  };
  const stepScale = (dir: -1 | 1): void => setEditorScale(scaleRef.current + dir * SCALE_STEP);
  // which grid-mode layout: the Bento (default) or the Playbill. Remembered app-wide; both are pure
  // views over FIELD_MODULES, selectable here and in Settings.
  const [editorLayout, setEditorLayoutState] = useState<"bento" | "playbill">(() =>
    ctx.prefs.get(PREF_EDITOR_LAYOUT) === "playbill" ? "playbill" : "bento",
  );
  const setEditorLayout = (l: "bento" | "playbill"): void => {
    setEditorLayoutState(l);
    ctx.prefs.set(PREF_EDITOR_LAYOUT, l);
  };
  // once the workbench tour has run, the layout/mode toggles retire from this header to Settings; they
  // show here only during onboarding so the tour has a real control to teach. Recomputed each render,
  // so finishing the tour hides them and "Replay tutorials" brings them back.
  const onboarded = hasSeenTour(ctx.prefs.get(tourSeenKey("workbench")));

  useEffect(() => {
    void ctx.api.coverage().then(setCoverage).catch(() => setCoverage([]));
    // mount-once: coverage claims change only when formats change (a rebuild), never mid-session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderDirty = JSON.stringify(order) !== JSON.stringify(orderBaselineRef.current);
  const dirty = orderDirty || !deepEq(baseDraft, baseline) || !deepEq(originalDraft, nativeBaseline);
  const setNative = (path: string, value: unknown): void => setOriginalDraft((d) => writePath(d, path, value));
  // one stub-modal state for the whole editor: a native link-out (lorebook/regex) opens it, both layouts share it
  const [nativeStub, setNativeStub] = useState<Stub | null>(null);
  const text = (path: string): string => str(readPath(draft, path));

  const platformLabel = useCallback(
    (id: string): string => {
      const hit = coverage.find((c) => c.id === id);
      return hit ? (hit.label.split(" ")[0] ?? id) : id;
    },
    [coverage],
  );
  const done = completionOf(draft);
  const lensClean = targets.length > 0 && EDITOR_CARDS.every((c) => lensVerdict(c.paths, targets, coverage).missing.length === 0);
  const chips = [
    ["Portrait", done.portrait],
    ["Name", done.name],
    ["Core Prompts", done.corePrompts],
    ["Greeting", done.greeting],
    ["Tags", done.tags],
    ["Lens Check", lensClean],
  ] as const;
  const doneCount = chips.filter(([, ok]) => ok).length;

  const doSave = useCallback(async (): Promise<void> => {
    await runEditorSave({
      saving,
      dirty,
      baseDraft,
      originalDraft,
      order,
      initEnt: init.ent,
      hadOrder: init.hadOrder,
      setSaving,
      setBaseline,
      setNativeBaseline,
      setBaseDraft,
      setOriginalDraft,
      orderBaselineRef,
      expectedRevision: revisionRef.current,
      saveEntity: (entity, expectedRevision) => ctx.api.saveEditedEntity(entity, expectedRevision),
      setRevision: (next) => {
        revisionRef.current = next;
      },
      setStatus: (msg) => ctx.setStatus(msg),
    });
  }, [ctx, dirty, baseDraft, originalDraft, init.ent, init.hadOrder, order, saving]);

  useEditorGuards(ctx, piece, dirty, doSave);

  // completion reports in the STATUS BAR (passive status does not rent space in a control row);
  // only what is MISSING is worth words
  const missingChips = chips.filter(([, ok]) => !ok).map(([label]) => label.toLowerCase()).join(" · ");
  useEffect(() => {
    ctx.setStatus(missingChips === "" ? `${doneCount}/${chips.length} · piece complete` : `${doneCount}/${chips.length} · needs ${missingChips}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount, missingChips]);

  const toggleTarget = (id: string): void => {
    setTargets((prev) => {
      const next = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id];
      ctx.prefs.set(PREF_TARGETS, next);
      return next;
    });
  };
  const pickOffTarget = (m: OffTarget): void => {
    setOffTarget(m);
    ctx.prefs.set(PREF_OFF_TARGET, m);
  };

  const { mediaCaps, spritePack, spriteCount, namedBag, namedCount } = mediaBundle(
    baseDraft,
    originalDraft,
    targets,
  );
  const artUrl = resolveArtUrl({
    draft,
    varyActiveId: vary.activeId,
    piece,
  });

  const applySpritePack = (pack: SpritePackValue, groups?: Record<string, SpritePackValue>): void => {
    setBaseDraft((d) => bodyWithPack(d, pack));
    setOriginalDraft((o) => originalWithPack(o, pack, groups));
  };

  const applyFaceOnly = (pack: SpritePackValue, wantLabel?: string | null): void => {
    const { body, pack: empty } = bodyWithFaceOnly(baseDraft, pack, wantLabel);
    setBaseDraft(body);
    setOriginalDraft((o) => originalWithPack(o, empty));
  };

  const applyNamed = (value: NamedAssetsValue): void => {
    setOriginalDraft((o) => originalWithNamedBag(o, value));
  };

  useEffect(() => {
    if (!spritesOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const [chars, packs] = await Promise.all([
          ctx.api.listEntities("character"),
          ctx.api.listEntities("pack"),
        ]);
        if (cancelled) return;
        const rows: { id: string; name: string }[] = [];
        for (const p of packs) {
          rows.push({ id: `pack:${p.id}`, name: `Pack · ${p.name || p.id}` });
        }
        for (const c of chars) {
          if (c.id === piece.id) continue;
          rows.push({ id: `character:${c.id}`, name: `Char · ${c.name || c.id}` });
        }
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setPackCatalog(rows);
      } catch {
        if (!cancelled) setPackCatalog([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spritesOpen, ctx.api, piece.id]);

  const knowledgeRefs = ((): string[] => {
    const raw = readPath(baseDraft, "knowledgeRefs");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  })();

  const leftCard = (
    <EditorLeftCard
      artUrl={artUrl}
      draft={draft}
      piece={piece}
      vary={vary}
      styles={styles}
      setField={setField}
      mediaCaps={mediaCaps}
      spriteCount={spriteCount}
      namedCount={namedCount}
      setSpritesOpen={setSpritesOpen}
      setSpritesFocusLabel={setSpritesFocusLabel}
      setNamedOpen={setNamedOpen}
      ctx={ctx}
      knowledgeRefs={knowledgeRefs}
      onKnowledgeRefsChange={(next) => setField("knowledgeRefs", next.length ? next : "")}
    />
  );

  const bodyViews = buildEditorBodyViews({
    draft,
    setField,
    styles,
    leftCard,
    vary,
    coverage,
    targets,
    offTarget,
    artAccent,
    flowIndex,
    setFlowIndex,
    saving,
    doSave,
    quizRef,
    activeCardRef,
    splitPct,
    onSplitDown,
    artUrl,
    piece,
    originalDraft,
    setNative,
    setNativeStub,
    mediaSprites: mediaCaps.sprites,
    setSpritesOpen,
    initOriginalKeys: Object.keys(rec(init.ent.original)),
    platformLabel,
    ctx,
    text,
  });
  const {
    lensActive,
    lensVisibleCount,
    lensTotalCount,
    flowView,
    bentoView,
    playbillView,
    workshopView,
    hasBehavior,
    entityAccent,
  } = bodyViews;

  // the editor-wide scale uses zoom (not transform) so the editor REFLOWS as it shrinks - the bento
  // grid is column-WIDTH based, so smaller = more, narrower bento columns that fill the freed space
  // (like browser zoom), never a shrink-into-the-corner with an empty void. --a rides along.
  const rootStyle: CSSProperties = {
    ...(accentVars(entityAccent) ?? {}),
    ...(editorScale !== 1 ? { zoom: editorScale } : {}),
  };
  return (
    <div className={styles.root} style={rootStyle}>
      {nativeStub && (
        <StubEditor title={nativeStub.title} note={nativeStub.note} onClose={() => setNativeStub(null)}>
          {nativeStub.view}
        </StubEditor>
      )}
      <EditorTabstrip
        coverage={coverage}
        targets={targets}
        platformLabel={platformLabel}
        toggleTarget={toggleTarget}
        clearTargets={() => {
          setTargets([]);
          ctx.prefs.set(PREF_TARGETS, []);
        }}
        offTarget={offTarget}
        pickOffTarget={pickOffTarget}
        lensActive={lensActive}
        lensVisibleCount={lensVisibleCount}
        lensTotalCount={lensTotalCount}
        doneCount={doneCount}
        chips={chips}
        styles={styles}
      />
      <EditorHeader
        name={text("identity.name") || piece.name}
        version={text("identity.characterVersion")}
        onClose={() => ctx.workbench.remove(piece.id, piece.kind)}
        editorScale={editorScale}
        stepScale={stepScale}
        setEditorScale={setEditorScale}
        scaleMin={SCALE_MIN}
        scaleMax={SCALE_MAX}
        onboarded={onboarded}
        mode={mode}
        setMode={setMode}
        editorLayout={editorLayout}
        setEditorLayout={setEditorLayout}
        hasBehavior={hasBehavior}
        workshop={workshop}
        setWorkshop={setWorkshop}
        saving={saving}
        dirty={dirty}
        doSave={doSave}
        openExport={() => setExportOpen(true)}
        topRight={topRight}
        styles={styles}
      />

      {workshop && hasBehavior ? workshopView : mode === "grid" ? (editorLayout === "playbill" ? playbillView : bentoView) : flowView}

      <EditorDialogs
        exportOpen={exportOpen}
        setExportOpen={setExportOpen}
        spritesOpen={spritesOpen}
        setSpritesOpen={setSpritesOpen}
        setSpritesFocusLabel={setSpritesFocusLabel}
        spritesFocusLabel={spritesFocusLabel}
        namedOpen={namedOpen}
        setNamedOpen={setNamedOpen}
        ctx={ctx}
        piece={piece}
        initEnt={init.ent}
        baseDraft={baseDraft}
        originalDraft={originalDraft}
        name={text("identity.name") || piece.name}
        mediaSprites={mediaCaps.sprites}
        mediaSpriteGroups={mediaCaps.spriteGroups}
        mediaNamedAssets={mediaCaps.namedAssets}
        spritePack={spritePack}
        namedBag={namedBag}
        targets={targets}
        packCatalog={packCatalog}
        applyFaceOnly={applyFaceOnly}
        applySpritePack={applySpritePack}
        applyNamed={applyNamed}
      />
    </div>
  );
}
