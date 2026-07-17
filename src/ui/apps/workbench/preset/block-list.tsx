/**
 * BlockList - the prompt list (RC PromptListV4 port). Ordered blocks; native HTML5 drag reorder
 * (vaud's lore-reorder idiom). Each row renders its own expanded content + actions (BlockRow).
 *
 * `blocks` is the FILTERED view, so the empty state has to say which nothing it means (RC ships
 * three: searched-to-nothing, an empty In-Chat tab, and a genuinely empty preset). Telling someone
 * "no blocks yet" while four sit behind a filter is a lie, and it hides the way out.
 */
import { useState, type JSX } from "react";
import type { PresetPrompt } from "../../../../entities/preset";
import type { PromptFilterTab } from "../../../../core/preset";
import { BlockRow } from "./block-row";
import s from "./preset.module.css";

export interface BlockListProps {
  /** the filtered view - see totalBlocks for whether the preset itself is empty */
  blocks: PresetPrompt[];
  /** how many blocks exist BEFORE the tab/search filter */
  totalBlocks: number;
  tab: PromptFilterTab;
  query: string;
  onClearQuery: () => void;
  onShowAll: () => void;
  selectedId: string | null;
  selectedChecks: ReadonlySet<string>;
  expandedIds: ReadonlySet<string>;
  onSelectRow: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Partial<PresetPrompt>) => void;
  onReorder: (fromId: string, toIndex: number) => void;
  onAdd: () => void;
}

function ListEmpty({
  totalBlocks,
  tab,
  query,
  onClearQuery,
  onShowAll,
}: Pick<BlockListProps, "totalBlocks" | "tab" | "query" | "onClearQuery" | "onShowAll">): JSX.Element {
  if (query.trim()) {
    return (
      <div className={s.empty}>
        <p className={s.emptyTitle}>No prompts match &ldquo;{query.trim()}&rdquo;</p>
        <button type="button" className={s.emptyAction} onClick={onClearQuery}>
          Clear search
        </button>
      </div>
    );
  }
  if (totalBlocks > 0) {
    const what = tab === "inchat" ? "in-chat injections" : "relative prompts";
    const how =
      tab === "inchat"
        ? "Move a prompt to In-Chat from its Placement, or add one and set its depth."
        : "Every prompt here is injected at a depth. Set one to Relative from its Placement.";
    return (
      <div className={s.empty}>
        <p className={s.emptyTitle}>No {what}</p>
        <p className={s.emptyHint}>{how}</p>
        <button type="button" className={s.emptyAction} onClick={onShowAll}>
          Show all
        </button>
      </div>
    );
  }
  return <div className={s.empty}>No prompt blocks yet. Add one to start building the preset.</div>;
}

export function BlockList({
  blocks,
  totalBlocks,
  tab,
  query,
  onClearQuery,
  onShowAll,
  selectedId,
  selectedChecks,
  expandedIds,
  onSelectRow,
  onToggleCheck,
  onToggleExpand,
  onToggle,
  onDelete,
  onPatch,
  onReorder,
  onAdd,
}: BlockListProps): JSX.Element {
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className={s.list}>
      {blocks.length === 0 ? (
        <ListEmpty
          totalBlocks={totalBlocks}
          tab={tab}
          query={query}
          onClearQuery={onClearQuery}
          onShowAll={onShowAll}
        />
      ) : (
        blocks.map((b, i) => (
          <BlockRow
            key={b.id}
            block={b}
            index={i}
            active={selectedId === b.id}
            selected={selectedChecks.has(b.id)}
            expanded={expandedIds.has(b.id)}
            onSelectRow={() => onSelectRow(b.id)}
            onToggleCheck={() => onToggleCheck(b.id)}
            onToggleExpand={() => onToggleExpand(b.id)}
            onToggle={() => onToggle(b.id)}
            onDelete={() => onDelete(b.id)}
            onPatch={(patch) => onPatch(b.id, patch)}
            onDragStart={() => setDragId(b.id)}
            onDropOn={() => {
              if (dragId && dragId !== b.id) onReorder(dragId, i);
              setDragId(null);
            }}
          />
        ))
      )}
      <button type="button" className={s.addBlock} onClick={onAdd}>
        + Add block
      </button>
    </div>
  );
}
