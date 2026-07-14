/**
 * BlockList - the prompt list (RC PromptListV4 port). Ordered blocks; native HTML5 drag reorder
 * (vaud's lore-reorder idiom). Each row renders its own expanded content + actions (BlockRow).
 * The toolbar / filter tabs / bulk bar / categories are later RC-port slices.
 */
import { useState, type JSX } from "react";
import type { PresetPrompt } from "../../../../entities/preset";
import { BlockRow } from "./block-row";
import s from "./preset.module.css";

export interface BlockListProps {
  blocks: PresetPrompt[];
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

export function BlockList({
  blocks,
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
        <div className={s.empty}>No prompt blocks yet. Add one to start building the preset.</div>
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
