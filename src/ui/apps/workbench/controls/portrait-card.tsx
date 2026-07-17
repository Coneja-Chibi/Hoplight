/**
 * PortraitCard - the editor's left column: the TicketWindow art surface (booth + alternates strip,
 * the locked vs-image-picker wire), the variant strip, name + token/edited meta, and media stamps.
 */
import type { JSX, ReactNode } from "react";
import type { MediaAsset } from "../../../../entities/character/schema";
import { TicketWindow, type TicketAlternate } from "../../../components/ticket-window";
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
  /** The strip's alternates (characters: media.assets); single-slot surfaces omit and get hung + add. */
  alternates?: readonly TicketAlternate[];
  onHang?: (id: string) => void;
  onAddAlternates?: (assets: MediaAsset[]) => void;
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
  alternates,
  onHang,
  onAddAlternates,
}: PortraitCardProps): JSX.Element {
  const canEdit = typeof onPortraitChange === "function";
  const canSprites = typeof onOpenSprites === "function";
  const canNamed = showCardAssets && typeof onOpenCardAssets === "function";

  return (
    <section className={styles.lcard} data-tour="portrait">
      <TicketWindow
        label="portrait"
        title={name}
        artUrl={artUrl}
        monogram={name.charAt(0).toUpperCase()}
        onPick={canEdit ? (asset) => onPortraitChange(asset) : undefined}
        onRemove={canEdit && artUrl ? () => onPortraitChange(null) : undefined}
        alternates={alternates}
        onHang={onHang}
        onAdd={onAddAlternates}
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
      )}
      {packStrip}
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
