/**
 * The character editor pane - vs-editor-2 TRANSCRIBED 1:1 (the locked wireframe): tab strip
 * (platform tabs + completion chips right), header row (close square + NAME + version chip left;
 * Grid|Steps + save state right), then the THREE-column bento: the portrait card (dashed frame,
 * variants strip, name + token/edited meta, Change Image / Manage Sprites stamps), the prompts
 * center, the utilities right. Lens verdicts come from /api/coverage data via editor-core
 * lensVerdict - this file names zero platforms. Wired-shut affordances (tagsheet, auto-tag, AI
 * wand/convert, image/sprite management) render exactly where the wireframe drew them, disabled
 * with their milestone named.
 *
 * One instance stays mounted per open piece (hidden, not unmounted): its React state IS the
 * unsaved draft. The draft is the WHOLE body (writePath immutable ops), so saving round-trips
 * every untouched field - the no-data-loss law, pinned in editor-core tests.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, JSX, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { AppContext, CoverageInfo, StudioEntitySummary } from "../../app-contract";
import { BentoCard } from "../../components/bento-card";
import { PlatformTabs, type OffTarget } from "../../components/platform-tabs";
import { categorizeTag, type TagCategory } from "../../../core/tag-taxonomy";
import {
  completionOf,
  deepEq,
  EDITOR_CARDS,
  KNOWN_FIELD_ORDER,
  lensVerdict,
  macroInventory,
  readPath,
  reconcileOrder,
  writePath,
  type LensVerdict,
} from "./editor-core";
import { FIELD_MODULES, type FieldModule } from "./fields";
import { signatureFromPng } from "../../../studio/signature-color";
import { hasSeenTour, tourSeenKey } from "../../tours/tour-core";
import { StubEditor, type Stub } from "../../components/native-card";
import { nativeItemsFor, nativeBentoParts, nativePlaybillSection, nativePlaybillNav } from "./native-render";
import { useVariants } from "./use-variants";
import { PortraitCard } from "./controls/portrait-card";
import { parseScale, rec, str, strArr, tokenEstimate } from "./editor-derive";
import { PlaybillView } from "./presenters/playbill-view";
import { BentoView } from "./presenters/bento-view";
import { FlowView } from "./presenters/flow-view";
import { WorkshopView } from "./presenters/workshop-view";
import { EditorModeBar } from "./presenters/editor-modebar";
import { GradientControl, PaletteControl } from "./controls/color-controls";
import { makeControlFor } from "./controls/field-control";
import styles from "./Editor.module.css";

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
  ctx: AppContext;
  piece: StudioEntitySummary;
  /** room chrome hoisted into the editor's own tab strip (the focus toggle) - no crumb bar exists */
  topRight?: ReactNode;
}

/** Build the writable pane for one canonical character (the vs-editor-2 surface, 1:1). */
export function CharacterEditor({ entity, ctx, piece, topRight }: CharacterEditorProps): JSX.Element {
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
  const [targets, setTargets] = useState<string[]>(() => strArr(ctx.prefs.get(PREF_TARGETS)));
  const [offTarget, setOffTarget] = useState<OffTarget>(() =>
    ctx.prefs.get(PREF_OFF_TARGET) === "hide" ? "hide" : "dim",
  );
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
    if (saving || !dirty) return;
    const name = str(readPath(baseDraft, "identity.name")).trim();
    if (!name) {
      ctx.setStatus("a name is required before saving");
      return;
    }
    setSaving(true);
    try {
      let newBody = baseDraft;
      if (init.hadOrder || JSON.stringify(order) !== JSON.stringify(KNOWN_FIELD_ORDER)) {
        newBody = writePath(newBody, "presentation.fieldOrder", [...order]);
      }
      await ctx.api.saveEntity({ ...init.ent, body: newBody, original: originalDraft });
      setBaseline(structuredClone(newBody));
      setBaseDraft(newBody);
      setNativeBaseline(structuredClone(originalDraft));
      orderBaselineRef.current = [...order];
      ctx.setStatus(`${name} saved`);
    } catch (e) {
      ctx.setStatus(`save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [ctx, dirty, baseDraft, originalDraft, init.ent, init.hadOrder, order, saving]);

  // the shell tab wears THE dirty dot (row-3's "saved locally" pill is dead - one indicator, one
  // home). ctx stays OUT of these deps: it is a stable adapter whose identity churns on every
  // store write, and identity-retriggered writers are how the status ping-pong loop was born.
  useEffect(() => {
    ctx.workbench.setDirty(piece.id, piece.kind, dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, piece.id, piece.kind]);

  // completion reports in the STATUS BAR (passive status does not rent space in a control row);
  // only what is MISSING is worth words
  const missingChips = chips.filter(([, ok]) => !ok).map(([label]) => label.toLowerCase()).join(" · ");
  useEffect(() => {
    ctx.setStatus(missingChips === "" ? `${doneCount}/${chips.length} · piece complete` : `${doneCount}/${chips.length} · needs ${missingChips}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount, missingChips]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); // the shell owns no save; without this the browser offers to save the page
        void doSave();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (dirty) e.preventDefault(); // the standard unsaved-changes prompt
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [doSave, dirty]);

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

  // -- left column: the portrait card (wireframe 1:1) ------------------------------------------------

  const artUrl = piece.hasPortrait
    ? `/api/studio/portrait?kind=${encodeURIComponent(piece.kind)}&id=${encodeURIComponent(piece.id)}`
    : null;
  const updatedAt = ((): string | null => {
    const t = readPath(draft, "attribution.updatedAt");
    return typeof t === "number" && Number.isFinite(t) ? new Date(t * 1000).toLocaleDateString() : null;
  })();

  const leftCard = (
    <PortraitCard
      artUrl={artUrl}
      name={text("identity.name") || piece.name}
      tokens={tokenEstimate(draft)}
      updatedAt={updatedAt}
      sourceVariant={piece.sourceVariant}
      vary={vary}
      styles={styles}
    />
  );

  // -- field controls --------------------------------------------------------------------------------

  // Signature color: one concept, two storage shapes. One color is a solid signature
  // (presentation.signatureColor); two or three blend into a gradient (presentation.gradientColors).
  // The editor works one unified list; the setter routes it to the shape that matches the count, so a
  // solid and a blend never both hold a value.
  const sigSolid = str(readPath(draft, "presentation.signatureColor"));
  const gradRaw = strArr(readPath(draft, "presentation.gradientColors"));
  const gradient = gradRaw.length > 0 ? gradRaw : sigSolid ? [sigSolid] : [];
  const setGradient = (rows: string[]): void => {
    const clean = rows.filter(Boolean).slice(0, 3);
    if (clean.length >= 2) {
      setField("presentation.gradientColors", clean);
      setField("presentation.signatureColor", "");
    } else if (clean.length === 1) {
      setField("presentation.signatureColor", clean[0]!);
      setField("presentation.gradientColors", []);
    } else {
      setField("presentation.signatureColor", "");
      setField("presentation.gradientColors", []);
    }
  };
  const gradientBody = <GradientControl value={gradient} onChange={setGradient} styles={styles} />;

  const palette = ((): { label?: string; name?: string; hex: string }[] => {
    const raw = readPath(draft, "presentation.palette");
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => rec(s)).filter((s) => typeof s.hex === "string") as { label?: string; name?: string; hex: string }[];
  })();
  const setPalette = (rows: { label?: string; name?: string; hex: string }[]): void =>
    setField("presentation.palette", rows.filter((r) => r.hex));
  const paletteBody = <PaletteControl value={palette} onChange={setPalette} styles={styles} />;

  // the field-rendering engine (controlFor + the composite bodies + renderSub) lives in field-control;
  // it threads draft/setField/styles + the gradient/palette/portrait bodies built above.
  const { controlFor, proseBody } = makeControlFor({ draft, setField, styles, gradientBody, paletteBody, leftCard });

  // The guided quiz: one question per bright card (your setup's language), the character taking shape
  // on the stage beside it. Pure view over the draft; Skip/Next only move the cursor. The portrait is
  // the stage, not a question, so it drops out of the walked list.
  const walkable = FIELD_MODULES.filter((m) => m.kind !== "portrait");
  // the platform lens drives the walk: with targets selected, HIDE drops questions no selected
  // platform carries (fewer questions), DIM keeps them (marked below). Empty selection = ask all.
  const moduleVerdict = (m: FieldModule): LensVerdict => lensVerdict([m.path], targets, coverage);
  const hidByLens = targets.length > 0 && offTarget === "hide";
  const lensWalk = hidByLens ? walkable.filter((m) => !moduleVerdict(m).off) : walkable;
  // per-field lens for the bento/playbill layouts: a field no selected platform carries HIDES under
  // the hide treatment and DIMS (stays visible, honest) under dim. Empty selection = the full card.
  const lensHides = (m: FieldModule): boolean => hidByLens && moduleVerdict(m).off;
  const lensDims = (m: FieldModule): boolean => targets.length > 0 && offTarget === "dim" && moduleVerdict(m).off;
  // never strand the walk empty (a near-empty platform under HIDE) - fall back to the full list.
  const flowModules = lensWalk.length > 0 ? lensWalk : walkable;
  const entityAccent =
    str(readPath(draft, "presentation.signatureColor")) ||
    strArr(readPath(draft, "presentation.gradientColors"))[0] ||
    artAccent ||
    undefined;

  const flowView = (
    <FlowView
      flowModules={flowModules}
      flowIndex={flowIndex}
      setFlowIndex={setFlowIndex}
      moduleVerdict={moduleVerdict}
      controlFor={controlFor}
      proseBody={proseBody}
      draft={draft}
      setField={setField}
      text={text}
      platformLabel={platformLabel}
      saving={saving}
      doSave={doSave}
      quizRef={quizRef}
      activeCardRef={activeCardRef}
      splitPct={splitPct}
      onSplitDown={onSplitDown}
      artUrl={artUrl}
      piece={piece}
      styles={styles}
    />
  );

  // Grid presenter: ONE bento per field (not per section) so the boxes pack naturally as a masonry -
  // a short field is a short box, a big prose field is a tall box, and they flow to fill the width
  // instead of a few giant section columns. Reads FIELD_MODULES in registry order (section-grouped),
  // so related fields stay adjacent. controlFor is the shared renderer with the quiz.
  // ===== BENTO layout, transcribed 1:1 from design/vs-editor-2.html. Fixed 3 columns: the face +
  // sealed rail | everything you write | presentation + meta. Fields render from FIELD_MODULES via
  // controlFor - the LAYOUT is data (a column's ordered cards, each naming its module ids), so a
  // second layout (playbill) and drag-drop are just different data over the same registry.
  const moduleById = new Map(FIELD_MODULES.map((m) => [m.id, m]));
  const bcard = (title: string, ids: readonly string[]): JSX.Element | null => {
    const mods = ids
      .map((id) => moduleById.get(id))
      .filter((m): m is FieldModule => m !== undefined && !lensHides(m));
    if (mods.length === 0) return null; // all fields hidden by the lens -> drop the whole card
    return (
      <BentoCard key={title} title={title}>
        {mods.map((m) => (
          <div key={m.id} className={`${styles.bfield}${lensDims(m) ? ` ${styles.dimlens}` : ""}`}>
            <span className={styles.blabel}>
              {m.sheetLabel}
              {m.required && <span className={styles.qreq}> *</span>}
            </span>
            {controlFor(m)}
          </div>
        ))}
      </BentoCard>
    );
  };

  // macro inventory: scan the prose the way the wireframe does - every {{macro}} with a count.
  const macroCounts = macroInventory(draft);
  const macroCard = (
    <BentoCard key="macros" title="Variables · Macro Inventory">
      {macroCounts.length === 0 ? (
        <div className={styles.blabel}>No macros detected yet</div>
      ) : (
        macroCounts.map(([name, n]) => (
          <div key={name} className={styles.mrow}>
            <span className={styles.mname}>{name}</span>
            <span className={styles.mcnt}>{`× ${n}`}</span>
          </div>
        ))
      )}
    </BentoCard>
  );

  // sealed cargo: the FOREIGN-format twin(s) kept for lossless round-trip, shown honestly. Vaude's own
  // internal keys (vaud-studio bookkeeping, vaud-json passthrough) are not sealed cargo - exclude them.
  const originalFormats = Object.keys(rec(init.ent.original)).filter((k) => k !== "vaud-studio" && k !== "vaud-json");
  const sealedCard =
    originalFormats.length === 0 ? null : (
      <BentoCard key="sealed" title="Sealed Cargo">
        <div className={styles.sealed}>
          {`The original ${originalFormats.map((k) => platformLabel(k)).join(" and ")} card is kept here whole and re-emitted byte-for-byte when you export back to that format. Read-only.`}
        </div>
      </BentoCard>
    );

  // native fields are LENS-DRIVEN: a platform's fields appear ONLY when you TARGET it in the lens (even
  // empty, ready to fill), NOT merely because the card carries that platform's data - the Sealed Cargo
  // already preserves that; target the platform to edit it. ONE shared definition feeds BOTH layouts.
  const nativeKeys = targets.filter((k) => k !== "vaud-studio" && k !== "vaud-json");
  const nativeItems = nativeItemsFor(nativeKeys, (p) => readPath(originalDraft, p), setNative, setNativeStub);
  const nb = nativeBentoParts(nativeItems);

  const bentoView = (
    <BentoView
      bcard={bcard}
      leftCard={leftCard}
      sealedCard={sealedCard}
      macroCard={macroCard}
      columns={nb.columns}
      spanRow={nb.spanRow}
      styles={styles}
    />
  );

  // ===== PLAYBILL layout, transcribed from design/vs-editor-v2.html, with the Bill and the character
  // image SWAPPED (owner's call): portrait LEFT, the Acts form center, the act nav (The Bill) RIGHT.
  // Same FIELD_MODULES, arranged as vertical "acts" (field-group sections) with a jump nav - the
  // second layout over the one registry, proving the modularity.
  const ACTS: ReadonlyArray<{ id: string; no: string; title: string; ids: readonly string[] }> = [
    { id: "identity", no: "Act I", title: "Identity", ids: ["name", "tagline", "fullName", "title", "age", "pronouns", "nickname", "culture", "characterVersion", "tags", "rating"] },
    { id: "persona", no: "Act II", title: "Persona", ids: ["personality", "scenario", "appearance", "structuredKind", "structuredAttributes", "voice", "imagePrompt", "imagePromptRows"] },
    { id: "prompts", no: "Act III", title: "Prompts", ids: ["systemPrompt", "postHistoryInstructions", "prefill", "additionalText", "depthInjections"] },
    { id: "greetings", no: "Act IV", title: "Greetings", ids: ["firstMes", "alternateGreetings", "groupOnlyGreetings"] },
    { id: "examples", no: "Act V", title: "Examples", ids: ["mesExample"] },
    { id: "discovery", no: "Act VI", title: "Discovery", ids: ["genre", "fandom", "contentWarnings"] },
    { id: "attribution", no: "Act VII", title: "Attribution", ids: ["creator", "creatorNotes", "publicNote", "originalCreator", "source", "sourceUrl", "license", "creatorNotesMultilingual"] },
    { id: "presentation", no: "Act VIII", title: "Presentation", ids: ["gradient", "palette", "background", "spotlight", "mediaLinks", "visualKind"] },
    { id: "settings", no: "Act IX", title: "Settings", ids: ["talkativeness", "risuSettings", "bias"] },
  ];
  const WIDE_KINDS = new Set(["prose", "greetings", "list", "keyvalue", "list-subeditor", "structured-subeditor", "spotlight", "background", "palette", "gradient", "asset-gallery", "tags", "rating"]);
  const actModules = (ids: readonly string[]): FieldModule[] =>
    ids.map((id) => moduleById.get(id)).filter((m): m is FieldModule => m !== undefined);
  const playbillView = (
    <PlaybillView
      leftCard={leftCard}
      sealedCard={sealedCard}
      acts={ACTS}
      actModules={actModules}
      lensHides={lensHides}
      lensDims={lensDims}
      wideKinds={WIDE_KINDS}
      controlFor={controlFor}
      nativeItems={nativeItems}
      nativeSection={nativePlaybillSection}
      nativeNav={nativePlaybillNav}
      styles={styles}
    />
  );

  // the behavior/scripts workspace, offered beside the fields only for cards that carry behavior (Risu
  // selected, or the card already has scripts). Its console runs the data-format triggers for real.
  const hasBehavior = targets.includes("risu") || Object.keys(rec(readPath(draft, "behavior"))).length > 0;
  const workshopView = <WorkshopView draft={draft} setField={setField} />;

  // the editor-wide scale uses zoom (not transform) so the editor REFLOWS as it shrinks - the bento
  // grid is column-WIDTH based, so smaller = more, narrower bento columns that fill the freed space
  // (like browser zoom), never a shrink-into-the-corner with an empty void. --a rides along.
  const rootStyle: CSSProperties = {
    ...(entityAccent !== undefined ? { ["--a"]: entityAccent } : {}),
    ...(editorScale !== 1 ? { zoom: editorScale } : {}),
  };
  return (
    <div className={styles.root} style={rootStyle}>
      {nativeStub && (
        <StubEditor title={nativeStub.title} note={nativeStub.note} onClose={() => setNativeStub(null)}>
          {nativeStub.view}
        </StubEditor>
      )}
      {/* row 1: platform lens tabs + off-target + completion chips (vs-editor-2 tabstrip) */}
      <div className={styles.tabstrip} data-tour="lens">
        <PlatformTabs
          platforms={coverage.map((c) => ({ id: c.id, label: platformLabel(c.id) }))}
          selected={targets}
          onToggle={toggleTarget}
          onClear={() => {
            setTargets([]);
            ctx.prefs.set(PREF_TARGETS, []);
          }}
          offTarget={offTarget}
          onOffTarget={pickOffTarget}
        />
        <span className={styles.done}>
          <span className={styles.frac}>{`${doneCount}/${chips.length}`}</span>
          {chips.map(([label, ok]) => (
            <span key={label} className={`${styles.chip}${ok ? ` ${styles.chipOk}` : ""}`}>
              {label}
            </span>
          ))}
        </span>
      </div>

      {/* row 2: back + name + version | scale + Grid/Steps + saved status (vs-editor-2 header) */}
      <div className={styles.hdr}>
        <button type="button" className={styles.back} aria-label="Close" title="Close" onClick={() => ctx.workbench.remove(piece.id, piece.kind)}>
          &#8592;
        </button>
        <b>{(text("identity.name") || piece.name).toUpperCase()}</b>
        {/* the version badge is a short label (V2, v1, 2024-final); a URL or a long string is not a
            version, so keep it out of the badge rather than blow out the header */}
        {text("identity.characterVersion") !== "" && text("identity.characterVersion").length <= 16 && (
          <span className={styles.vchip}>{text("identity.characterVersion")}</span>
        )}
        <span className={styles.hdrRight}>
          <span className={styles.escale} title="Scale the editor">
            <button type="button" className={styles.escaleStep} onClick={() => stepScale(-1)} disabled={editorScale <= SCALE_MIN} aria-label="Scale editor down" title="Smaller">
              &#8722;
            </button>
            <button type="button" className={styles.escalePct} onClick={() => setEditorScale(1)} title="Reset to 100%">
              {`${Math.round(editorScale * 100)}%`}
            </button>
            <button type="button" className={styles.escaleStep} onClick={() => stepScale(1)} disabled={editorScale >= SCALE_MAX} aria-label="Scale editor up" title="Bigger">
              &#43;
            </button>
          </span>
          {/* layout + mode are onboarding-taught preferences; Fields | Workshop shows for behavior cards */}
          <EditorModeBar
            onboarded={onboarded}
            mode={mode}
            setMode={setMode}
            editorLayout={editorLayout}
            setEditorLayout={setEditorLayout}
            hasBehavior={hasBehavior}
            workshop={workshop}
            setWorkshop={setWorkshop}
            styles={styles}
          />
          <button type="button" className={styles.save} data-tour="save" disabled={saving || !dirty} onClick={() => void doSave()} title="Save · ctrl+s">
            {saving ? "Saving…" : dirty ? "Save" : "● Saved locally"}
          </button>
          {topRight}
        </span>
      </div>

      {workshop && hasBehavior ? workshopView : mode === "grid" ? (editorLayout === "playbill" ? playbillView : bentoView) : flowView}
    </div>
  );
}
