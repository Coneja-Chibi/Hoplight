/** Generated docs navigation and catalog search for the reader's left rail. */
import { useEffect, useState, type JSX } from "react";
import type { DocRecord } from "../../docs-types";
import { displayDocTitle, groupDocs, searchDocs } from "./docs-core";
import styles from "./styles.module.css";

interface DocNavProps {
  docs: DocRecord[];
  activeId: string;
  query: string;
  onQuery(value: string): void;
  onPick(id: string): void;
}

export function DocNav({ docs, activeId, query, onQuery, onPick }: DocNavProps): JSX.Element {
  const groups = groupDocs(searchDocs(docs, query));
  const activeGroup = groupDocs(docs).find((group) =>
    group.sections.some((section) => section.docs.some((doc) => doc.id === activeId)))?.id ?? "user";
  const [shelf, setShelf] = useState<"user" | "developer">(activeGroup);
  useEffect(() => setShelf(activeGroup), [activeGroup]);
  const visibleGroups = query.trim() ? groups : groups.filter((group) => group.id === shelf);

  return (
    <nav className={styles.nav} aria-label="Documentation">
      <input
        className={styles.search}
        placeholder="search the docs"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        aria-label="Search the docs"
        data-tour="search"
      />
      {!query.trim() && (
        <div className={styles.shelves} aria-label="Documentation audience">
          {groupDocs(docs).map((group) => (
            <button
              key={group.id}
              type="button"
              className={`${styles.shelf}${shelf === group.id ? ` ${styles.on}` : ""}`}
              aria-pressed={shelf === group.id}
              onClick={() => setShelf(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}
      {visibleGroups.map((group) => (
        <section className={styles.group} key={group.id} aria-label={group.label}>
          {query.trim() && <h2 className={styles.groupTitle}>{group.label}</h2>}
          {group.sections.map((section, index) => (
            <details
              className={styles.section}
              key={`${group.id}-${section.id}-${shelf}`}
              open={Boolean(query.trim()) || index === 0 || section.docs.some((doc) => doc.id === activeId)}
            >
              <summary className={styles.grp}>{section.label} <span>{section.docs.length}</span></summary>
              {section.docs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className={`${styles.item}${doc.id === activeId ? ` ${styles.on}` : ""}`}
                  aria-current={doc.id === activeId ? "page" : undefined}
                  onClick={() => onPick(doc.id)}
                >
                  {displayDocTitle(doc)}
                </button>
              ))}
            </details>
          ))}
        </section>
      ))}
      {groups.length === 0 && <p className={styles.noResults}>No docs match that search.</p>}
    </nav>
  );
}
