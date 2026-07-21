/** Center reader pane: safe Markdown segments, trusted docs assets, and gated GitHub links. */
import { useEffect, useMemo, type JSX } from "react";
import type { DocFigure, DocRecord } from "../../docs-types";
import { requestExternal } from "../../_shared/link-gate";
import { RenderBox } from "../../components/render-box";
import { displayDocTitle, prepareDocSegments, targetFromAppHref } from "./docs-core";
import styles from "./styles.module.css";

interface DocContentProps {
  doc: DocRecord;
  docs: DocRecord[];
  figures: DocFigure[];
  body: string;
  anchor: string;
  loading: boolean;
  onPick(id: string, anchor?: string): void;
}

export function DocContent({ doc, docs, figures, body, anchor, loading, onPick }: DocContentProps): JSX.Element {
  const segments = useMemo(() => prepareDocSegments(body, doc, docs, figures), [body, doc, docs, figures]);

  useEffect(() => {
    if (!anchor || loading) return;
    requestAnimationFrame(() => document.getElementById(`doc-${anchor}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [anchor, loading, body]);

  const onLinkClick = (href: string): boolean => {
    const target = targetFromAppHref(href);
    if (!target || !docs.some((candidate) => candidate.id === target.id)) return false;
    onPick(target.id, target.anchor);
    return true;
  };

  const openGitHub = (): void => {
    requestExternal(`https://github.com/Coneja-Chibi/Hoplight/blob/Mainstage/${doc.path}`, `View ${doc.title} on GitHub`);
  };

  return (
    <main className={styles.main} data-tour="content">
      <div className={styles.inner}>
        <div className={styles.crumb}>
          <span>{doc.audience === "user" ? "User Docs" : "Developer Docs"} / {displayDocTitle(doc)}</span>
          <button type="button" className={styles.github} onClick={openGitHub}>view on GitHub</button>
        </div>
        <span className={styles.audience}>{doc.audience}</span>
        {loading ? <p className={styles.empty}>Opening the page…</p> : (
          <article className={styles.prose}>
            {segments.map((segment, index) => segment.kind === "markdown" ? (
              <RenderBox
                key={`copy-${index}`}
                value={segment.body}
                format="markdown"
                displayOnly
                onLinkClick={onLinkClick}
              />
            ) : (
              <figure className={styles.figure} key={`${segment.path}-${index}`}>
                <img
                  src={`/api/docs/asset?path=${encodeURIComponent(segment.path)}`}
                  alt={segment.alt}
                  width={segment.width}
                  height={segment.height}
                  loading="lazy"
                />
                {segment.caption && <figcaption>{segment.caption}</figcaption>}
              </figure>
            ))}
          </article>
        )}
      </div>
    </main>
  );
}
