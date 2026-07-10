/**
 * Character knowledge rail: list/attach/detach/reorder library lorebooks via knowledgeRefs.
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import {
  attachKnowledgeRef,
  detachKnowledgeRef,
  missingKnowledgeRefs,
  reorderKnowledgeRef,
} from "./knowledge-refs";

export interface KnowledgeRailProps {
  ctx: AppContext;
  refs: readonly string[];
  onChange: (next: string[]) => void;
}

export function KnowledgeRail({ ctx, refs, onChange }: KnowledgeRailProps): JSX.Element {
  const [books, setBooks] = useState<StudioEntitySummary[]>([]);
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    void ctx.api.listEntities("lorebook").then(setBooks).catch(() => setBooks([]));
  }, [ctx]);

  const known = new Set(books.map((b) => b.id));
  const missing = missingKnowledgeRefs(refs, known);
  const nameOf = (id: string): string => books.find((b) => b.id === id)?.name ?? id;

  return (
    <section aria-label="Linked lorebooks" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)" }}>
        Knowledge
      </div>
      {refs.length === 0 && (
        <div style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>No library books linked.</div>
      )}
      {refs.map((id, i) => (
        <div key={id} style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              const hit = books.find((b) => b.id === id);
              if (hit) ctx.workbench.send(hit);
              else ctx.setStatus(`missing lorebook · ${id}`);
            }}
            style={{
              flex: 1,
              textAlign: "left",
              font: "inherit",
              border: "3px solid var(--edge)",
              background: "var(--face)",
              padding: "0.35rem 0.45rem",
              cursor: "pointer",
              color: missing.includes(id) ? "var(--rose)" : "var(--text)",
            }}
            title={missing.includes(id) ? "Missing from library" : "Open in Workbench"}
          >
            {nameOf(id)}
            {missing.includes(id) ? " (missing)" : ""}
          </button>
          <button
            type="button"
            disabled={i === 0}
            onClick={() => onChange(reorderKnowledgeRef(refs, id, i - 1))}
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={i >= refs.length - 1}
            onClick={() => onChange(reorderKnowledgeRef(refs, id, i + 1))}
            aria-label="Move down"
          >
            ↓
          </button>
          <button type="button" onClick={() => onChange(detachKnowledgeRef(refs, id))} aria-label="Detach">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setPickOpen((v) => !v)}>
        {pickOpen ? "Close attach" : "Attach lorebook…"}
      </button>
      {pickOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "10rem", overflow: "auto" }}>
          {books.length === 0 && <div style={{ color: "var(--text-soft)" }}>No lorebooks in the library.</div>}
          {books.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={refs.includes(b.id)}
              onClick={() => {
                onChange(attachKnowledgeRef(refs, b.id));
                setPickOpen(false);
              }}
              style={{ textAlign: "left", font: "inherit", padding: "0.3rem", cursor: "pointer" }}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
