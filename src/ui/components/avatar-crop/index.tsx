/**
 * AvatarCrop - visual square crop for character face images.
 *
 * Practices (common cropper pattern + Marinara wire shape):
 * - Crop lives in *display* pixels over a fitted <img>; emit *normalized* 0-1 rect
 *   relative to that display (uniform scale => same as natural).
 * - setPointerCapture on drag; pan body + 4 corner handles; square-locked resize
 *   (opposite corner anchors).
 * - Dim outside via box-shadow on the selection (no second mask layer).
 * - Do NOT onChange on image load (opening the editor must not dirty the form).
 * - key={imageSrc} so cached images re-init; also poll img.complete after mount.
 * - Preview: absolute img sized so crop maps to a circular clip (Marinara-style).
 * - Wire: { srcX, srcY, srcWidth, srcHeight }. Legacy zoom/offset is clear-only.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RE } from "react";
import type { JSX } from "react";
import styles from "./styles.module.css";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const numOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export interface AvatarCropValue {
  srcX: number;
  srcY: number;
  srcWidth: number;
  srcHeight: number;
}

export interface AvatarCropProps {
  value: unknown;
  onChange(next: AvatarCropValue | null): void;
  /** Face image data URI or URL. Without it, show guidance only. */
  imageSrc?: string;
}

interface CropPx {
  x: number;
  y: number;
  size: number;
}

type Handle = "pan" | "tl" | "tr" | "bl" | "br";

const MIN_PX = 28;
const MAX_W = 320;
const MAX_H = 320;

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function cropPxToValue(px: CropPx, w: number, h: number): AvatarCropValue {
  return {
    srcX: px.x / w,
    srcY: px.y / h,
    srcWidth: px.size / w,
    srcHeight: px.size / h,
  };
}

export function valueToCropPx(crop: AvatarCropValue, w: number, h: number): CropPx {
  const size = clamp(crop.srcWidth * w, MIN_PX, Math.min(w, h));
  return {
    x: clamp(crop.srcX * w, 0, Math.max(0, w - size)),
    y: clamp(crop.srcY * h, 0, Math.max(0, h - size)),
    size,
  };
}

/** Square-locked corner resize; opposite corner stays fixed. */
export function resizeCorner(
  handle: Exclude<Handle, "pan">,
  start: CropPx,
  dx: number,
  dy: number,
  W: number,
  H: number,
): CropPx {
  const right = start.x + start.size;
  const bottom = start.y + start.size;
  if (handle === "br") {
    const size = clamp(Math.min(start.size + dx, start.size + dy), MIN_PX, Math.min(W - start.x, H - start.y));
    return { x: start.x, y: start.y, size };
  }
  if (handle === "tl") {
    const size = clamp(Math.min(start.size - dx, start.size - dy), MIN_PX, Math.min(right, bottom));
    return { x: right - size, y: bottom - size, size };
  }
  if (handle === "tr") {
    const size = clamp(Math.min(start.size + dx, start.size - dy), MIN_PX, Math.min(W - start.x, bottom));
    return { x: start.x, y: bottom - size, size };
  }
  // bl
  const size = clamp(Math.min(start.size - dx, start.size + dy), MIN_PX, Math.min(right, H - start.y));
  return { x: right - size, y: start.y, size };
}

function isModern(v: Rec): boolean {
  return (
    typeof v.srcX === "number" ||
    typeof v.srcY === "number" ||
    typeof v.srcWidth === "number" ||
    typeof v.srcHeight === "number"
  );
}

function isLegacy(v: Rec): boolean {
  return typeof v.zoom === "number" || typeof v.offsetX === "number" || typeof v.offsetY === "number";
}

function modernFromUnknown(v: Rec): AvatarCropValue {
  return {
    srcX: numOr(v.srcX, 0),
    srcY: numOr(v.srcY, 0),
    srcWidth: numOr(v.srcWidth, 1),
    srcHeight: numOr(v.srcHeight, 1),
  };
}

/** CSS for circular preview: map normalized crop into overflow:hidden box. */
export function cropPreviewStyle(crop: AvatarCropValue): CSSProperties {
  const { srcX, srcY, srcWidth, srcHeight } = crop;
  if (srcWidth <= 0 || srcHeight <= 0) return {};
  return {
    position: "absolute",
    width: `${100 / srcWidth}%`,
    height: `${100 / srcHeight}%`,
    left: `${(-srcX / srcWidth) * 100}%`,
    top: `${(-srcY / srcHeight) * 100}%`,
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "fill",
  };
}

function defaultCropPx(w: number, h: number): CropPx {
  const size = Math.min(w, h);
  return { x: (w - size) / 2, y: (h - size) / 2, size };
}

export function AvatarCrop({ value, onChange, imageSrc }: AvatarCropProps): JSX.Element {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgRect, setImgRect] = useState<{ w: number; h: number } | null>(null);
  const [cropPx, setCropPx] = useState<CropPx | null>(null);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; start: CropPx } | null>(null);
  // Track last emitted value so parent prop re-sync does not fight mid-drag
  const valueRef = useRef(value);
  valueRef.current = value;

  const v = value === null || value === undefined ? null : rec(value);
  const legacyOnly = v !== null && isLegacy(v) && !isModern(v);

  const layoutImage = useCallback(() => {
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    // Fit inside MAX, never upscale (display coords then track image content 1:1 at scale)
    const scale = Math.min(MAX_W / natW, MAX_H / natH, 1);
    const w = natW * scale;
    const h = natH * scale;
    setImgRect({ w, h });

    const cur = valueRef.current;
    const curRec = cur === null || cur === undefined ? null : rec(cur);
    if (curRec && isModern(curRec)) {
      setCropPx(valueToCropPx(modernFromUnknown(curRec), w, h));
    } else {
      setCropPx(defaultCropPx(w, h));
    }
    // Intentionally no onChange here - open must not dirty.
  }, []);

  useEffect(() => {
    setImgRect(null);
    setCropPx(null);
  }, [imageSrc]);

  // Cached images often skip React onLoad; recover if complete after paint.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0 && imgRect === null) layoutImage();
  });

  // Parent crop changed while idle (reload / undo)
  useEffect(() => {
    if (!imgRect || dragRef.current) return;
    if (v && isModern(v)) setCropPx(valueToCropPx(modernFromUnknown(v), imgRect.w, imgRect.h));
  }, [v, imgRect]);

  const applyPx = (px: CropPx, emit: boolean): void => {
    if (!imgRect) return;
    const next = {
      x: clamp(px.x, 0, imgRect.w - px.size),
      y: clamp(px.y, 0, imgRect.h - px.size),
      size: clamp(px.size, MIN_PX, Math.min(imgRect.w, imgRect.h)),
    };
    setCropPx(next);
    if (emit) onChange(cropPxToValue(next, imgRect.w, imgRect.h));
  };

  const onPointerDown = (e: RE, handle: Handle): void => {
    if (!cropPx || !imgRect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, start: { ...cropPx } };
  };

  const onPointerMove = (e: RE): void => {
    const d = dragRef.current;
    if (!d || !imgRect) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    let next: CropPx;
    if (d.handle === "pan") {
      next = {
        size: d.start.size,
        x: d.start.x + dx,
        y: d.start.y + dy,
      };
    } else {
      next = resizeCorner(d.handle, d.start, dx, dy, imgRect.w, imgRect.h);
    }
    applyPx(next, true);
  };

  const onPointerUp = (): void => {
    dragRef.current = null;
  };

  const reset = (): void => {
    if (!imgRect) return;
    applyPx(defaultCropPx(imgRect.w, imgRect.h), true);
  };

  if (!imageSrc) {
    return (
      <div className={styles.wrap}>
        <div className={styles.help}>
          Set a portrait on the face card first. Then drag a square over it here.
        </div>
        {v && isModern(v) ? (
          <div className={styles.meta}>
            Saved crop (no image to preview): x={numOr(v.srcX, 0).toFixed(3)} y=
            {numOr(v.srcY, 0).toFixed(3)} size={numOr(v.srcWidth, 0).toFixed(3)}
          </div>
        ) : null}
      </div>
    );
  }

  if (legacyOnly) {
    return (
      <div className={styles.wrap}>
        <div className={styles.help}>
          Legacy zoom/offset crop. Kept on export until you clear it, then drag a new square.
        </div>
        <div className={styles.meta}>
          zoom={String(v!.zoom ?? "?")} offsetX={String(v!.offsetX ?? "?")} offsetY=
          {String(v!.offsetY ?? "?")}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={() => onChange(null)}>
            Clear legacy crop
          </button>
        </div>
      </div>
    );
  }

  const liveValue =
    imgRect && cropPx ? cropPxToValue(cropPx, imgRect.w, imgRect.h) : v && isModern(v) ? modernFromUnknown(v) : null;

  const ptr = {
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.help}>Drag the square to pan. Corners resize (stays square). Outside is dimmed.</div>
      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={reset} disabled={!imgRect}>
          Reset center
        </button>
        <button type="button" className={styles.btn} onClick={() => onChange(null)}>
          Clear crop
        </button>
      </div>
      <div className={styles.row}>
        <div
          className={styles.canvas}
          style={{ width: imgRect?.w ?? MAX_W, height: imgRect?.h ?? MAX_H }}
        >
          <img
            key={imageSrc}
            ref={imgRef}
            src={imageSrc}
            alt=""
            draggable={false}
            className={styles.img}
            onLoad={layoutImage}
          />
          {cropPx && imgRect ? (
            <div
              className={styles.sel}
              style={{ left: cropPx.x, top: cropPx.y, width: cropPx.size, height: cropPx.size }}
              onPointerDown={(e) => onPointerDown(e, "pan")}
              {...ptr}
            >
              {(["tl", "tr", "bl", "br"] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  className={`${styles.handle} ${styles[pos]}`}
                  aria-label={`Resize ${pos}`}
                  onPointerDown={(e) => onPointerDown(e, pos)}
                  {...ptr}
                />
              ))}
            </div>
          ) : null}
        </div>
        {liveValue && imageSrc ? (
          <div className={styles.previewCol}>
            <div className={styles.k}>Preview</div>
            <div className={styles.preview}>
              <img src={imageSrc} alt="" style={cropPreviewStyle(liveValue)} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
