/**
 * Assemble field controls + lens filtering + bento/playbill/flow/workshop views for CharacterEditor.
 * State remains in Editor; this is pure construction over draft/setters.
 */
import type { CSSProperties, JSX, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import type { AppContext, CoverageInfo, StudioEntitySummary } from "../../../app-contract";
import type { OffTarget } from "../../../components/platform-tabs";
import { lensVerdict, type LensVerdict } from "../editor-core";
import { FIELD_MODULES, type FieldModule } from "../fields";
import { readPath } from "../editor-core";
import { rec, str, strArr } from "../editor-derive";
import { GradientControl, PaletteControl } from "../controls/color-controls";
import { makeControlFor } from "../controls/field-control";
import { nativeItemsFor, nativeBentoParts, nativePlaybillSection, nativePlaybillNav } from "../native-render";
import { PlaybillView } from "./playbill-view";
import { BentoView } from "./bento-view";
import { FlowView } from "./flow-view";
import { WorkshopView } from "../workshop";
import {
  ACTS,
  WIDE_KINDS,
  PANEL_KINDS,
} from "./editor-layout-data";
import {
  buildBcard,
  buildMacroCard,
  buildSealedCard,
  moduleByIdMap,
  actModulesOf,
} from "./editor-grid-build";
import type { useVariants } from "../use-variants";

type VaryApi = ReturnType<typeof useVariants>;

const LENS_ALWAYS_ON = new Set(["tags"]);

export function buildEditorBodyViews(opts: {
  draft: unknown;
  setField(path: string, value: unknown): void;
  styles: Readonly<Record<string, string>>;
  leftCard: ReactNode;
  vary: VaryApi;
  coverage: CoverageInfo[];
  targets: string[];
  offTarget: OffTarget;
  artAccent: string | null;
  flowIndex: number;
  setFlowIndex(n: number | ((p: number) => number)): void;
  saving: boolean;
  doSave(): void;
  quizRef: RefObject<HTMLDivElement | null>;
  activeCardRef: RefObject<HTMLDivElement | null>;
  splitPct: number;
  onSplitDown(e: ReactPointerEvent): void;
  artUrl: string | null;
  piece: StudioEntitySummary;
  originalDraft: Record<string, unknown>;
  setNative(path: string, value: unknown): void;
  setNativeStub(s: import("../../../components/native-card").Stub | null): void;
  mediaSprites: boolean;
  setSpritesOpen(v: boolean): void;
  initOriginalKeys: string[];
  platformLabel(id: string): string;
  ctx: AppContext;
  text(path: string): string;
}): {
  controlFor: (m: FieldModule) => JSX.Element;
  proseBody: (id: string, path: string) => JSX.Element;
  lensActive: boolean;
  lensVisibleCount: number;
  lensTotalCount: number;
  flowView: JSX.Element;
  bentoView: JSX.Element;
  playbillView: JSX.Element;
  workshopView: JSX.Element;
  hasBehavior: boolean;
  entityAccent: string | undefined;
  rootStyle: CSSProperties;
  editorScaleNote: null;
} {
  const {
    draft, setField, styles, leftCard, vary, coverage, targets, offTarget, artAccent,
    flowIndex, setFlowIndex, saving, doSave, quizRef, activeCardRef, splitPct, onSplitDown,
    artUrl, piece, originalDraft, setNative, setNativeStub, mediaSprites, setSpritesOpen,
    initOriginalKeys, platformLabel, ctx, text,
  } = opts;

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

  const { controlFor, proseBody } = makeControlFor({
    draft, setField, styles, gradientBody, paletteBody, leftCard,
    inheritField: vary.inheritField, hasOverride: vary.hasOverride, variantActive: vary.activeId !== null,
  });

  const walkable = FIELD_MODULES.filter((m) => m.kind !== "portrait");
  const coverageLoaded = coverage.length > 0;
  const lensActive = targets.length > 0 && coverageLoaded;
  const moduleVerdict = (m: FieldModule): LensVerdict => {
    if (LENS_ALWAYS_ON.has(m.id)) return { off: false, missing: [] };
    if (!lensActive) return { off: false, missing: [] };
    return lensVerdict([m.path], targets, coverage);
  };
  const lensHides = (m: FieldModule): boolean => lensActive && moduleVerdict(m).off;
  const lensDims = (m: FieldModule): boolean =>
    lensActive && offTarget === "dim" && moduleVerdict(m).off;
  const lensWalk = walkable.filter((m) => !lensHides(m));
  const lensVisibleCount = FIELD_MODULES.filter((m) => m.kind !== "portrait" && !lensHides(m)).length;
  const lensTotalCount = FIELD_MODULES.filter((m) => m.kind !== "portrait").length;
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

  const moduleById = moduleByIdMap();
  const nativeKeys = targets.filter((k) => k !== "vaud-studio" && k !== "vaud-json");
  const bcard = buildBcard(moduleById, lensHides, lensDims, controlFor, styles);
  const macroCard = buildMacroCard(draft, styles);
  const sealedCard = buildSealedCard(initOriginalKeys, platformLabel, styles);

  const portraitSrc = (() => {
    const media = rec((draft as Record<string, unknown>).media);
    const portrait = rec(media.portrait);
    const ref = str(portrait.ref);
    return ref.length > 0 ? ref : undefined;
  })();
  const nativeItems = nativeItemsFor(
    nativeKeys,
    (p) => readPath(originalDraft, p),
    setNative,
    setNativeStub,
    {
      portraitSrc,
      onOpenSprites: mediaSprites ? () => setSpritesOpen(true) : undefined,
    },
  );
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

  const actModules = (ids: readonly string[]): FieldModule[] => actModulesOf(moduleById, ids);

  const playbillView = (
    <PlaybillView
      leftCard={leftCard}
      sealedCard={sealedCard}
      acts={ACTS}
      actModules={actModules}
      lensHides={lensHides}
      lensDims={lensDims}
      wideKinds={WIDE_KINDS}
      panelKinds={PANEL_KINDS}
      controlFor={controlFor}
      nativeItems={nativeItems}
      nativeSection={nativePlaybillSection}
      nativeNav={nativePlaybillNav}
      styles={styles}
    />
  );

  const hasBehavior = targets.includes("risu") || Object.keys(rec(readPath(draft, "behavior"))).length > 0;
  const workshopView = (
    <WorkshopView
      draft={draft}
      setField={setField}
      original={originalDraft}
      setOriginal={setNative}
      targets={targets}
      ctx={ctx}
    />
  );

  return {
    controlFor,
    proseBody,
    lensActive,
    lensVisibleCount,
    lensTotalCount,
    flowView,
    bentoView,
    playbillView,
    workshopView,
    hasBehavior,
    entityAccent,
    rootStyle: {},
    editorScaleNote: null,
  };
}
