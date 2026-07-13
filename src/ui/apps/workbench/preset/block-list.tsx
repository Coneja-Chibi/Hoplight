/**
 * BlockList - the manuscript (PRESET-JEWEL-PLAN.md P4). The ordered prompt blocks + a "+ Add block"
 * at the foot. Filter segments / bulk bar / drag reorder / the AddBlockMenu marker slots are later
 * P4 slices; this is the spine.
 */
import type { JSX } from "react";
import type { PresetPrompt } from "../../../../entities/preset";
import { BlockRow } from "./block-row";
import s from "./preset.module.css";

export interface BlockListProps {
  blocks: PresetPrompt[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, toIndex: number) => void;
  onAdd: () => void;
}

export function BlockList({ blocks, onToggle, onDelete, onMove, onAdd }: BlockListProps): JSX.Element {
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
            first={i === 0}
            last={i === blocks.length - 1}
            onToggle={() => onToggle(b.id)}
            onDelete={() => onDelete(b.id)}
            onMove={(dir) => onMove(b.id, i + dir)}
          />
        ))
      )}
      <button type="button" className={s.addBlock} onClick={onAdd}>
        + Add block
      </button>
    </div>
  );
}
