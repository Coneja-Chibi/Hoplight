/**
 * Risu lore long tail: folder id. Codec: formats/risu/lorebook.ts.
 */
import type { JSX } from "react";
import type { LorePlatformCard, LorePlatformCardProps } from "./card-contract";

function Component({ entry, show, styles, onPatch }: LorePlatformCardProps): JSX.Element | null {
  if (!show("categoryId")) return null;
  return (
    <div className={styles.pcZone}>
      <div className={styles.pcZh}>
        <b>Folder</b>
        <span>Risu folder this entry belongs to</span>
      </div>
      <div className={styles.pcChrome}>
        <span className={styles.pcK}>Folder id</span>
        <input
          className={styles.pcText}
          style={{ width: "100%", maxWidth: "none" }}
          value={entry.categoryId ?? ""}
          aria-label="Folder id"
          title="Risu folder this entry belongs to"
          onChange={(ev) => onPatch({ categoryId: ev.target.value || null })}
        />
      </div>
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
