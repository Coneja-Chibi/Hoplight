/**
 * Editor left column: portrait card with pack strip / manage sprites / named assets.
 * Extracted from Editor.tsx (presentational assembly only).
 */
import type { JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { PackStrip } from "../../../components/pack-strip";
import {
  mediaCapabilities,
  resolvePackFace,
  type NamedAssetsValue,
  type SpritePackValue,
} from "../../../../core/media";
import { PortraitCard } from "../controls/portrait-card";
import { readPath } from "../editor-core";
import { rec, str, tokenEstimate } from "../editor-derive";
import {
  namedFromOriginal,
  packFromBodyDraft,
} from "../media/session";
import { KnowledgeRail } from "../lore/KnowledgeRail";
import { variantArtUrls } from "../variants-art";
import type { useVariants } from "../use-variants";

type VaryApi = ReturnType<typeof useVariants>;

export function resolveArtUrl(opts: {
  stripLabel: string | null;
  spritePack: SpritePackValue;
  draft: unknown;
  varyActiveId: string | null;
  piece: StudioEntitySummary;
}): string | null {
  if (opts.stripLabel) {
    const face = resolvePackFace(opts.spritePack, opts.stripLabel);
    if (face?.ref) return face.ref;
  }
  const portrait = rec(readPath(opts.draft, "media.portrait"));
  const ref = str(portrait.ref);
  if (ref.startsWith("data:image/") || ref.startsWith("https://") || ref.startsWith("http://")) {
    return ref;
  }
  if (!opts.varyActiveId && opts.piece.hasPortrait) {
    return `/api/studio/portrait?kind=${encodeURIComponent(opts.piece.kind)}&id=${encodeURIComponent(opts.piece.id)}`;
  }
  return null;
}

export function mediaBundle(
  baseDraft: Record<string, unknown>,
  originalDraft: Record<string, unknown>,
  targets: string[],
): {
  mediaCaps: ReturnType<typeof mediaCapabilities>;
  spritePack: SpritePackValue;
  spriteCount: number;
  namedBag: NamedAssetsValue;
  namedCount: number;
} {
  const mediaCaps = mediaCapabilities({ original: originalDraft, targets });
  const spritePack = packFromBodyDraft(baseDraft, originalDraft);
  const namedBag = namedFromOriginal(originalDraft);
  return {
    mediaCaps,
    spritePack,
    spriteCount: spritePack.items.length,
    namedBag,
    namedCount: namedBag.items.length,
  };
}

export function EditorLeftCard({
  artUrl,
  draft,
  piece,
  vary,
  styles,
  setField,
  mediaCaps,
  spriteCount,
  namedCount,
  spritePack,
  stripLabel,
  setStripLabel,
  setSpritesOpen,
  setSpritesFocusLabel,
  setNamedOpen,
  ctx,
  knowledgeRefs,
  onKnowledgeRefsChange,
}: {
  artUrl: string | null;
  draft: unknown;
  piece: StudioEntitySummary;
  vary: VaryApi;
  styles: Readonly<Record<string, string>>;
  setField(path: string, value: unknown): void;
  mediaCaps: ReturnType<typeof mediaCapabilities>;
  spriteCount: number;
  namedCount: number;
  spritePack: SpritePackValue;
  stripLabel: string | null;
  setStripLabel(v: string | null): void;
  setSpritesOpen(v: boolean): void;
  setSpritesFocusLabel(v: string | null): void;
  setNamedOpen(v: boolean): void;
  ctx?: AppContext;
  knowledgeRefs?: readonly string[];
  onKnowledgeRefsChange?: (next: string[]) => void;
}): JSX.Element {
  const updatedAt = ((): string | null => {
    const t = readPath(draft, "attribution.updatedAt");
    return typeof t === "number" && Number.isFinite(t) ? new Date(t * 1000).toLocaleDateString() : null;
  })();
  const variantArt = variantArtUrls(vary.variants);

  // The strip's alternates are the gallery (media.assets): every previewable asset is a thumb the
  // booth can hang; the hung one is whichever matches the current portrait ref.
  const rawAssets = readPath(draft, "media.assets");
  const assetList: Record<string, unknown>[] = Array.isArray(rawAssets) ? rawAssets.map(rec) : [];
  const portraitRef = str(rec(readPath(draft, "media.portrait")).ref);
  const alternates = assetList
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => {
      const ref = str(a.ref);
      return ref.startsWith("data:image/") || ref.startsWith("https://") || ref.startsWith("http://");
    })
    .map(({ a, i }) => ({
      id: String(i),
      url: str(a.ref),
      label: str(a.label) || undefined,
      active: str(a.ref) === portraitRef,
    }));

  return (
    <>
      <PortraitCard
        artUrl={artUrl}
        name={str(readPath(draft, "identity.name")) || piece.name}
        tokens={tokenEstimate(draft)}
        updatedAt={updatedAt}
        sourceVariant={piece.sourceVariant}
        vary={vary}
        styles={styles}
        onPortraitChange={(portrait) => {
          if (portrait === null) setField("media.portrait", "");
          else setField("media.portrait", portrait);
        }}
        alternates={alternates}
        onHang={(id) => {
          const asset = assetList[Number(id)];
          if (!asset) return;
          setField("media.portrait", { ...asset, role: "portrait", primary: true });
        }}
        onAddAlternates={(added) => {
          setField("media.assets", [
            ...assetList,
            ...added.map((a) => ({ ...a, role: "other", primary: false })),
          ]);
        }}
        onOpenSprites={
          mediaCaps.sprites
            ? () => {
                setSpritesFocusLabel(null);
                setSpritesOpen(true);
              }
            : undefined
        }
        spriteCount={spriteCount}
        showCardAssets={mediaCaps.namedAssets}
        cardAssetCount={namedCount}
        onOpenCardAssets={mediaCaps.namedAssets ? () => setNamedOpen(true) : undefined}
        packStrip={
          mediaCaps.sprites ? (
            <PackStrip
              pack={spritePack}
              activeLabel={stripLabel}
              onSelect={setStripLabel}
              onOpenPack={(focus) => {
                setSpritesFocusLabel(focus ?? null);
                setSpritesOpen(true);
              }}
            />
          ) : null
        }
        stripPreviewLabel={stripLabel}
        onClearStripPreview={() => setStripLabel(null)}
        variantArt={variantArt}
      />
      {ctx && onKnowledgeRefsChange && (
        <div style={{ marginTop: "0.75rem" }}>
          <KnowledgeRail
            ctx={ctx}
            refs={knowledgeRefs ?? []}
            onChange={onKnowledgeRefsChange}
          />
        </div>
      )}
    </>
  );
}
