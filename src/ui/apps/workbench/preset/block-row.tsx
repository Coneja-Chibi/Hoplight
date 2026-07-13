/**
 * BlockRow - one prompt block in the list (RC PromptItemV4 port). Caret expands the CONTENT inline;
 * clicking the row body SELECTS the block so its metadata edits in the right EDIT PROMPT sidebar
 * (RC's split model). Number (or @depth for in-chat), name, role/marker chip, prose preview, tokens
 * (or "slot"), the reused ToggleSwitch, up/down reorder, delete. Drag-and-drop is a later polish.
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
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
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
  selected,
  expanded,
  onSelect,
  onExpand,
  onToggle,
  onDelete,
  onMove,
}: BlockRowProps): JSX.Element {
  const inChat = block.placement === "in_chat" || block.placement === "append";
  const cls = [s.prow, block.enabled ? "" : s.prowOff, selected ? s.prowSel : ""].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <button type="button" className={s.caretBtn} aria-expanded={expanded} aria-label="Expand content" onClick={onExpand}>
        {expanded ? "▾" : "▸"}
      </button>
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
      <button type="button" className={s.rowBody} aria-pressed={selected} title="Edit this block" onClick={onSelect}>
        <span className={s.ptitle}>{block.name || "Untitled block"}</span>
        {block.marker ? (
          <span className={s.mk}>marker</span>
        ) : (
          <span className={`${s.role} ${roleClass(block.role)}`}>{block.role}</span>
        )}
        <span className={s.prev}>{previewOf(block)}</span>
      </button>
      <span className={s.tok}>{block.marker ? "slot" : `~${blockTokens(block)}`}</span>
      <ToggleSwitch on={block.enabled} onChange={onToggle} label={block.enabled ? "on" : "off"} />
      <button type="button" className={s.del} title="Delete block" aria-label="Delete block" onClick={onDelete}>
        &#215;
      </button>
    </div>
  );
}
