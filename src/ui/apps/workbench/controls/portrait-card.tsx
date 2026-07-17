/**
 * PortraitCard - the editor's left column: the TicketWindow booth (the locked vs-image-picker wire),
 * then the labeled shelves under it - variants (a variant is alt art or alt fields, one concept),
 * expressions (the pack strip) - then name + token/edited meta and the media stamps.
 */
import type { JSX, ReactNode } from "react";
import type { MediaAsset } from "../../../../entities/character/schema";
import { ShelfKicker, TicketWindow } from "../../../components/ticket-window";
import { VariantStrip } from "../../../components/variant-strip";
import type { VariantsApi } from "../use-variants";

export interface PortraitCardProps {
  artUrl: string | null;
  /** display name (identity.name, falling back to the piece name) */
  name: string;
  tokens: number;
  updatedAt: string | null;
  sourceVariant?: string;
  /** Character variants; absent on sheets without the variant concept (persona) - the strip is skipped. */
  vary?: VariantsApi;
  styles: Readonly<Record<string, string>>;
  /** When set, click/drop on the face writes media.portrait (data URI embed). */
  onPortraitChange?: (portrait: MediaAsset | null) => void;
  /** Sprites are a character concept; false removes the stamp entirely (persona). Default keeps the
   *  character behavior: the stamp renders, disabled until onOpenSprites arrives. */
  showSprites?: boolean;
  /** Open Manage Sprites dialog. When omitted, stamp stays disabled. */
  onOpenSprites?: () => void;
  /** Face count for the sprites stamp chip. */
  spriteCount?: number;
  /** Show Card assets stamp (Risu named bag). */
  showCardAssets?: boolean;
  cardAssetCount?: number;
  onOpenCardAssets?: () => void;
  /** Expression pack strip under variants */
  packStrip?: ReactNode;
  /** When strip previews an expression face, show a small chip */
  stripPreviewLabel?: string | null;
  onClearStripPreview?: () => void;
  /** Per-variant own portrait thumbs (id -> previewable ref) */
  variantArt?: Readonly<Record<string, string | null>>;
}

export function PortraitCard({
  artUrl,
  name,
  tokens,
  updatedAt,
  sourceVariant,
  vary,
  styles,
  onPortraitChange,
  showSprites = true,
  onOpenSprites,
  spriteCount = 0,
  showCardAssets = false,
  cardAssetCount = 0,
  onOpenCardAssets,
  packStrip,
  stripPreviewLabel,
  onClearStripPreview,
  variantArt,
}: PortraitCardProps): JSX.Element {
  const canEdit = typeof onPortraitChange === "function";
  const canSprites = typeof onOpenSprites === "function";
  const canNamed = showCardAssets && typeof onOpenCardAssets === "function";

  return (
    <section className={styles.lcard} data-tour="portrait">
      {/* The booth alone: alt art IS a variant, so the strip under it is the variant strip below,
          never a parallel "alternates" list. */}
      <TicketWindow
        label="portrait"
        title={name}
        artUrl={artUrl}
        monogram={name.charAt(0).toUpperCase()}
        onPick={canEdit ? (asset) => onPortraitChange(asset) : undefined}
        onRemove={canEdit && artUrl ? () => onPortraitChange(null) : undefined}
      />
      {stripPreviewLabel ? (
        <button
          type="button"
          className={styles.stripChip}
          title="Clear expression preview"
          onClick={() => onClearStripPreview?.()}
        >
          {`Preview · ${stripPreviewLabel} ×`}
        </button>
      ) : null}
      {vary && (
        <>
          <ShelfKicker>variants · alt art or alt fields</ShelfKicker>
          <VariantStrip
            variants={vary.variants}
            activeId={vary.activeId}
            artUrl={artUrl}
            variantArt={variantArt}
            onSelect={vary.select}
            onAdd={vary.add}
            onRemove={vary.remove}
            onRename={vary.rename}
            onMode={vary.setMode}
          />
        </>
      )}
      {packStrip ? (
        <>
          <ShelfKicker>expressions</ShelfKicker>
          {packStrip}
        </>
      ) : null}
      <div className={styles.lmeta}>
        <b>{name.toUpperCase()}</b>
        <div className={styles.lsub}>
          {sourceVariant !== undefined && `${sourceVariant} · `}
          {`~${tokens} tokens`}
          {updatedAt !== null && ` · last edited ${updatedAt}`}
        </div>
      </div>
      <div className={styles.btnrow}>
        {showSprites ? (
          <button
            type="button"
            className={styles.stampBtn}
            disabled={!canSprites}
            title={canSprites ? "Edit expression / sprite pack" : "Sprites unavailable for this lens"}
            onClick={() => onOpenSprites?.()}
          >
            {spriteCount > 0 ? `Manage Sprites · ${spriteCount}` : "Manage Sprites"}
          </button>
        ) : null}
        {canNamed ? (
          <button
            type="button"
            className={styles.stampBtn}
            title="Named card assets (audio, video, fonts)"
            onClick={() => onOpenCardAssets?.()}
          >
            {cardAssetCount > 0 ? `Card assets · ${cardAssetCount}` : "Card assets"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
