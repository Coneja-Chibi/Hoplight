/**
 * TicketWindow - THE image surface, transcribed 1:1 from the LOCKED vs-image-picker wire: the art
 * hangs behind glass in a booth (black marquee names the slot, actions are ticket stubs) with the
 * alternates strip riding under it in every deployment. Click or drop anywhere on the glass to hang
 * art; clicking a thumb hangs that alternate; the + tile adds (multi-add where the surface has an
 * alternates store, add-and-hang on single-slot surfaces). The naked file input never renders.
 */
import { useRef, useState, type DragEvent, type JSX } from "react";
import type { MediaAsset } from "../../../entities/character/schema";
import { portraitFromRef } from "../../../core/media";
import styles from "./styles.module.css";

export interface TicketAlternate {
  id: string;
  url: string;
  label?: string;
  active?: boolean;
}

export interface TicketWindowProps {
  /** marquee slot name ("portrait", "background") */
  label: string;
  /** marquee right side, usually the piece name */
  title?: string;
  /** the hung art (previewable url or data URI), or null for the empty booth */
  artUrl: string | null;
  /** empty-state letter (the piece's monogram) */
  monogram: string;
  /** hang new art from a picked/dropped file; absent makes the surface read-only */
  onPick?: (asset: MediaAsset) => void;
  /** remove the hung art (stub only renders when art exists) */
  onRemove?: () => void;
  /** the strip's thumbs; the active one is the hung art */
  alternates?: readonly TicketAlternate[];
  /** hang an alternate by id */
  onHang?: (id: string) => void;
  /** multi-add for gallery-capable surfaces; absent, the + tile behaves as onPick (add-and-hang) */
  onAdd?: (assets: MediaAsset[]) => void;
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";

const readImageFile = (file: File): Promise<MediaAsset> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const asset = typeof reader.result === "string" ? portraitFromRef(reader.result) : null;
      if (asset) resolve({ ...asset, label: asset.label ?? file.name });
      else reject(new Error(`ticket-window: could not read ${file.name}`));
    };
    reader.onerror = () => reject(new Error(`ticket-window: could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

/** Every readable image from a picked/dropped file list; unreadable files skip (never hang the add). */
const readImageFiles = async (files: FileList): Promise<MediaAsset[]> => {
  const settled = await Promise.allSettled(
    [...files].filter((f) => f.type.startsWith("image/")).map(readImageFile),
  );
  return settled
    .filter((s): s is PromiseFulfilledResult<MediaAsset> => s.status === "fulfilled")
    .map((s) => s.value);
};

export function TicketWindow({
  label,
  title,
  artUrl,
  monogram,
  onPick,
  onRemove,
  alternates,
  onHang,
  onAdd,
}: TicketWindowProps): JSX.Element {
  const pickRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const canEdit = typeof onPick === "function";

  const hangFirst = async (files: FileList | null): Promise<void> => {
    if (!canEdit || !files || files.length === 0) return;
    const [first] = await readImageFiles(files);
    if (first) onPick(first);
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    void hangFirst(e.dataTransfer.files);
  };

  return (
    <div className={styles.sheet}>
      <div className={styles.booth}>
        <div className={styles.marquee}>
          <span>{label}</span>
          {title ? <span className={styles.marqueeTitle}>{title}</span> : <span>·</span>}
        </div>
        <button
          type="button"
          className={`${styles.glass}${dragOver ? ` ${styles.glassDrag}` : ""}`}
          title={canEdit ? "Click or drop to hang art" : undefined}
          disabled={!canEdit}
          onClick={() => pickRef.current?.click()}
          onDragOver={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={canEdit ? onDrop : undefined}
        >
          {artUrl ? (
            <img src={artUrl} alt="" />
          ) : (
            <>
              <span className={styles.monogram}>{monogram}</span>
              {canEdit && (
                <span className={styles.emptyLine}>
                  no art hung yet
                  <br />
                  drop it here · or click
                </span>
              )}
            </>
          )}
        </button>
        {canEdit && (
          <div className={styles.stubs}>
            {dragOver ? (
              <span className={`${styles.stub} ${styles.stubPrimary}`}>release to replace</span>
            ) : (
              <>
                <button type="button" className={`${styles.stub} ${styles.stubPrimary}`} onClick={() => pickRef.current?.click()}>
                  {artUrl ? "change" : "choose art"}
                </button>
                {artUrl && onRemove && (
                  <button type="button" className={styles.stub} onClick={onRemove}>
                    remove
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {canEdit && (
        <div className={styles.strip}>
          {(alternates ?? []).map((alt) => (
            <button
              key={alt.id}
              type="button"
              className={`${styles.thumb}${alt.active ? ` ${styles.thumbOn}` : ""}`}
              title={alt.label ?? "hang this art"}
              onClick={() => onHang?.(alt.id)}
            >
              <img src={alt.url} alt="" />
              {alt.label ? <span className={styles.thumbTag}>{alt.label}</span> : null}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.thumb} ${styles.thumbAdd}`}
            title={onAdd ? "Add alternates" : "Hang new art"}
            onClick={() => (onAdd ? addRef.current : pickRef.current)?.click()}
          >
            +
          </button>
        </div>
      )}
      <input
        ref={pickRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className={styles.hiddenFile}
        onChange={(e) => {
          void hangFirst(e.target.files);
          e.target.value = "";
        }}
      />
      {onAdd && (
        <input
          ref={addRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className={styles.hiddenFile}
          onChange={(e) => {
            const files = e.target.files;
            if (files) void readImageFiles(files).then((assets) => assets.length > 0 && onAdd(assets));
            e.target.value = "";
          }}
        />
      )}
    </div>
  );
}
