/** Current-page heading rail, derived entirely from generated docs anchors. */
import type { JSX } from "react";
import type { DocAnchor } from "../../docs-types";
import styles from "./styles.module.css";

interface DocTocProps {
  anchors: DocAnchor[];
  activeSlug: string;
  onJump(slug: string): void;
}

/** Depth-first flatten so nested catalogue anchors keep existing level styling. */
const flattenAnchors = (anchors: readonly DocAnchor[]): DocAnchor[] => {
  const out: DocAnchor[] = [];
  for (const anchor of anchors) {
    out.push(anchor);
    if (anchor.children?.length) out.push(...flattenAnchors(anchor.children));
  }
  return out;
};

export function DocToc({ anchors, activeSlug, onJump }: DocTocProps): JSX.Element {
  const flat = flattenAnchors(anchors);
  return (
    <aside className={styles.toc} aria-label="On this page" data-tour="toc">
      {flat.length > 0 && <div className={styles.tocHead}>On this page</div>}
      {flat.map((anchor) => (
        <button
          key={`${anchor.slug}-${anchor.level}`}
          type="button"
          className={`${styles.tocLink}${anchor.level >= 3 ? ` ${styles.sub}` : ""}${activeSlug === anchor.slug ? ` ${styles.on}` : ""}`}
          onClick={() => onJump(anchor.slug)}
        >
          {anchor.text}
        </button>
      ))}
    </aside>
  );
}
