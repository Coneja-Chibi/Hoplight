/**
 * Risu's lore long tail: the folder id (Risu's native folder grouping rides categoryId until
 * folders become a first-class studio feature). Codec: formats/risu/lorebook.ts.
 */
import type { JSX } from "react";
import type { LorePlatformCard, LorePlatformCardProps } from "./card-contract";

function Component({ entry, show, styles, onPatch }: LorePlatformCardProps): JSX.Element | null {
  if (!show("categoryId")) return null;
  return (
    <div className={styles.timeRow2}>
      <label className={styles.headFld} title="Risu folder this entry belongs to">
        <span>Folder id</span>
        <input
          className={styles.groupIn}
          value={entry.categoryId ?? ""}
          aria-label="Folder id"
          onChange={(ev) => onPatch({ categoryId: ev.target.value || null })}
        />
      </label>
    </div>
  );
}

const card: LorePlatformCard = {
  id: "risu",
  label: "Risu",
  lenses: ["risu"],
  Component,
};

export default card;
