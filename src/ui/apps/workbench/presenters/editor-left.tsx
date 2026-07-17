/**
 * Editor left column: portrait card with manage sprites / named assets.
 * Extracted from Editor.tsx (presentational assembly only).
 */
import type { JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import {
  mediaCapabilities,
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
  draft: unknown;
  varyActiveId: string | null;
  piece: StudioEntitySummary;
}): string | null {
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
