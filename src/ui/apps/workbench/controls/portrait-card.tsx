/**
 * PortraitCard - the editor's left column: portrait (art or initial), the variant strip, name + token/
 * edited meta, and the media-milestone stamps. Referenced by all three presenters and the controlFor
 * `portrait` case, so it is one shared piece. Lifted from Editor.tsx; the shell computes its props and
 * passes its own style module (no CSS duplication).
 */
import type { JSX } from "react";
import { VariantStrip } from "../../../components/variant-strip";
import type { VariantsApi } from "../use-variants";

export interface PortraitCardProps {
  artUrl: string | null;
  /** display name (identity.name, falling back to the piece name) */
  name: string;
  tokens: number;
  updatedAt: string | null;
  sourceVariant?: string;
  vary: VariantsApi;
  styles: Readonly<Record<string, string>>;
}

export function PortraitCard({ artUrl, name, tokens, updatedAt, sourceVariant, vary, styles }: PortraitCardProps): JSX.Element {
  return (
    <section className={styles.lcard} data-tour="portrait">
      <div className={styles.portrait}>
        {artUrl ? <img src={artUrl} alt="" /> : <b>{name.charAt(0).toUpperCase()}</b>}
      </div>
      <VariantStrip
        variants={vary.variants}
        activeId={vary.activeId}
        artUrl={artUrl}
        onSelect={vary.select}
        onAdd={vary.add}
        onRemove={vary.remove}
        onRename={vary.rename}
        onMode={vary.setMode}
      />
      <div className={styles.lmeta}>
        <b>{name.toUpperCase()}</b>
        <div className={styles.lsub}>
          {sourceVariant !== undefined && `${sourceVariant} · `}
          {`~${tokens} tokens`}
          {updatedAt !== null && ` · last edited ${updatedAt}`}
        </div>
      </div>
      <div className={styles.btnrow}>
        <button type="button" className={styles.stampBtn} disabled title="Image management lands with the media milestone">
          Change Image
        </button>
        <button type="button" className={styles.stampBtn} disabled title="Sprites land with the media milestone">
          Manage Sprites
        </button>
      </div>
    </section>
  );
}
