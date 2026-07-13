/**
 * BlockList - the manuscript (PRESET-JEWEL-PLAN.md P4). The ordered prompt blocks, each expandable
 * into the inline BlockExpansion (the ONE editing place). Filter segments / bulk bar / drag reorder
 * / the AddBlockMenu marker slots are later P4 slices.
 */
import { Fragment, type JSX } from "react";
import type { PresetPrompt } from "../../../../entities/preset";
import { BlockRow } from "./block-row";
import { BlockExpansion } from "./block-expansion";
import s from "./preset.module.css";

export interface BlockListProps {
  blocks: PresetPrompt[];
  expandedIds: ReadonlySet<string>;
  /** placement stops the active Write-for lens carries */
  stops: readonly string[];
  onExpand: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, toIndex: number) => void;
  onPatch: (id: string, patch: Partial<PresetPrompt>) => void;
  onAdd: () => void;
}

export function BlockList({
  blocks,
  expandedIds,
  stops,
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
              expanded={expandedIds.has(b.id)}
              onExpand={() => onExpand(b.id)}
              onToggle={() => onToggle(b.id)}
              onDelete={() => onDelete(b.id)}
              onMove={(dir) => onMove(b.id, i + dir)}
            />
            {expandedIds.has(b.id) && (
              <BlockExpansion
                block={b}
                stops={stops}
                onPatch={(patch) => onPatch(b.id, patch)}
                onDelete={() => onDelete(b.id)}
              />
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
