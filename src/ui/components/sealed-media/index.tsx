/**
 * SealedMedia - safe preview for named assets (image/audio/video). Fail closed.
 * Never executes CSS/fonts as document styles; no free network fetch.
 */
import type { JSX } from "react";
import type { NamedAssetKind } from "../../../core/media";
import styles from "./styles.module.css";

export interface SealedMediaProps {
  kind: NamedAssetKind;
  /** Already-resolved preview URL (data: or https already on card). */
  src: string | null;
  name: string;
}

export function SealedMedia({ kind, src, name }: SealedMediaProps): JSX.Element {
  if (!src) {
    return <div className={styles.none}>Cannot preview</div>;
  }
  if (kind === "image") {
    return (
      <div className={styles.box}>
        <img className={styles.img} src={src} alt={name} />
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className={styles.box}>
        <audio className={styles.audio} controls preload="metadata" src={src}>
          Audio preview
        </audio>
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div className={styles.box}>
        <video className={styles.video} controls preload="metadata" src={src} playsInline>
          Video preview
        </video>
      </div>
    );
  }
  return (
    <div className={styles.none}>
      {kind} · export only
    </div>
  );
}
