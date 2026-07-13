/**
 * BlockList - the prompt list (RC PromptListV4 port). Ordered blocks; each row selects into the
 * right sidebar (metadata) and expands its CONTENT inline via the caret. Categories / filter tabs /
 * bulk bar are later RC-port slices.
 */
import { Fragment, type JSX } from "react";
import type { PresetPrompt } from "../../../../entities/preset";
import { BlockRow } from "./block-row";
import { BlockContent } from "./block-content";
import s from "./preset.module.css";

export interface BlockListProps {
  blocks: PresetPrompt[];
  selectedId: string | null;
  expandedIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onExpand: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, toIndex: number) => void;
  onPatch: (id: string, patch: Partial<PresetPrompt>) => void;
  onAdd: () => void;
}

export function BlockList({
  blocks,
  selectedId,
  expandedIds,
  onSelect,
  onExpand,
  onToggle,
  onDelete,
  onMove,
  onPatch,
  onAdd,
}: BlockListProps): JSX.Element {
  return (
    <div className={s.list}>
      {blocks.length === 0 ? (
        <div className={s.empty}>No prompt blocks yet. Add one to start building the preset.</div>
      ) : (
        blocks.map((b, i) => (
          <Fragment key={b.id}>
            <BlockRow
              block={b}
              index={i}
              first={i === 0}
              last={i === blocks.length - 1}
              selected={selectedId === b.id}
              expanded={expandedIds.has(b.id)}
              onSelect={() => onSelect(b.id)}
              onExpand={() => onExpand(b.id)}
              onToggle={() => onToggle(b.id)}
              onDelete={() => onDelete(b.id)}
              onMove={(dir) => onMove(b.id, i + dir)}
            />
            {expandedIds.has(b.id) && (
              <BlockContent block={b} onPatch={(patch) => onPatch(b.id, patch)} />
            )}
          </Fragment>
        ))
      )}
      <button type="button" className={s.addBlock} onClick={onAdd}>
        + Add block
      </button>
    </div>
  );
}
