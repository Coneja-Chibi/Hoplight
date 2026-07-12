/**
 * PortraitCard - the editor's left column: portrait (art or initial), the variant strip, name + token/
 * edited meta, and media stamps. Click/drop the art to change face (media hub). Sprites stamp later.
 */
import { useRef, useState, type DragEvent, type JSX, type ReactNode } from "react";
import type { MediaAsset } from "../../../../entities/character/schema";
import { portraitFromRef } from "../../../../core/media";
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

const IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";

const readFileAsDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("portrait: expected data URL"));
    };
    reader.onerror = () => reject(new Error("portrait: read failed"));
    reader.readAsDataURL(file);
  });

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const canEdit = typeof onPortraitChange === "function";
  const canSprites = typeof onOpenSprites === "function";
  const canNamed = showCardAssets && typeof onOpenCardAssets === "function";

  const applyFile = async (file: File | undefined): Promise<void> => {
    if (!canEdit || !file || !file.type.startsWith("image/")) return;
    try {
      const dataUri = await readFileAsDataUri(file);
      const asset = portraitFromRef(dataUri);
      if (asset) onPortraitChange(asset);
    } catch {
      // fail closed: leave prior face
    }
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    void applyFile(e.dataTransfer.files?.[0]);
  };

  return (
    <section className={styles.lcard} data-tour="portrait">
      <div
        className={`${styles.portrait}${canEdit ? ` ${styles.portraitEdit}` : ""}${dragOver ? ` ${styles.portraitDrag}` : ""}`}
        role={canEdit ? "button" : undefined}
        tabIndex={canEdit ? 0 : undefined}
        title={canEdit ? "Click or drop to change art" : undefined}
        onClick={() => {
          if (canEdit) fileRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (!canEdit) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={canEdit ? onDrop : undefined}
      >
        {artUrl ? <img src={artUrl} alt="" /> : <b>{name.charAt(0).toUpperCase()}</b>}
        {stripPreviewLabel ? (
          <button
            type="button"
            className={styles.stripChip}
            title="Clear expression preview"
            onClick={(e) => {
              e.stopPropagation();
              onClearStripPreview?.();
            }}
          >
            {`Preview · ${stripPreviewLabel} ×`}
          </button>
        ) : null}
        {canEdit && !stripPreviewLabel ? <span className={styles.portraitCue}>Change art</span> : null}
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className={styles.hiddenFile}
          onChange={(e) => {
            void applyFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
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
