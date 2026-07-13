/**
 * BlockRow - one prompt block in the manuscript (PRESET-JEWEL-PLAN.md P4, transcribed from
 * design/vs-preset-hybrid.html). Number (or @depth for in-chat), name, role/marker chip, prose
 * preview, tokens (or "slot" for a marker), the reused ToggleSwitch for enable, reorder + delete.
 * Reorder is up/down here (the KnowledgeRail idiom); drag-and-drop is a later P4 polish slice.
 */
import type { JSX } from "react";
import type { PresetPrompt } from "../../../../entities/preset";
import { blockTokens, markerLabel } from "../../../../core/preset";
import { ToggleSwitch } from "../../../components/toggle-switch";
import s from "./preset.module.css";

const previewOf = (b: PresetPrompt): string =>
  b.marker ? markerLabel(b.markerSlot) : b.content.trim().split("\n")[0] || "empty block";

const roleClass = (role: string): string =>
  (role === "user" ? s.rUsr : role === "assistant" ? s.rAst : s.rSys) ?? "";

export interface BlockRowProps {
  block: PresetPrompt;
  index: number;
  first: boolean;
  last: boolean;
  expanded: boolean;
  onExpand: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}

export function BlockRow({
  block,
  index,
  first,
  last,
  expanded,
  onExpand,
  onToggle,
  onDelete,
  onMove,
}: BlockRowProps): JSX.Element {
  const inChat = block.placement === "in_chat" || block.placement === "append";
  return (
    <div className={block.enabled ? s.prow : `${s.prow} ${s.prowOff}`}>
      <span className={s.moveCol}>
        <button type="button" className={s.moveBtn} disabled={first} aria-label="Move up" onClick={() => onMove(-1)}>
          &#9650;
        </button>
        <button type="button" className={s.moveBtn} disabled={last} aria-label="Move down" onClick={() => onMove(1)}>
          &#9660;
        </button>
      </span>
      <span className={inChat ? `${s.ord} ${s.ordAt}` : s.ord}>
        {inChat ? `@${block.injectionDepth}` : String(index + 1).padStart(2, "0")}
      </span>
      <button
        type="button"
        className={s.ptitle}
        title="Edit this block"
        aria-expanded={expanded}
        onClick={onExpand}
      >
        <span className={s.caret}>{expanded ? "▾" : "▸"}</span>
        {block.name || "Untitled block"}
      </button>
      {block.marker ? (
        <span className={s.mk}>marker</span>
      ) : (
        <span className={`${s.role} ${roleClass(block.role)}`}>{block.role}</span>
      )}
      <span className={s.prev}>{previewOf(block)}</span>
      <span className={s.tok}>{block.marker ? "slot" : `~${blockTokens(block)}`}</span>
      <ToggleSwitch on={block.enabled} onChange={onToggle} label={block.enabled ? "on" : "off"} />
      <button type="button" className={s.del} title="Delete block" aria-label="Delete block" onClick={onDelete}>
        &#215;
      </button>
    </div>
  );
}
