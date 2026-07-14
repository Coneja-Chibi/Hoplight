/**
 * BlockRow - one prompt block (a faithful transcription of RC's PromptItemV4, in vaud's language).
 * Layout + behavior match RC: a rotating expand chevron, a hover-reveal multi-select checkbox, a
 * drag grip (native HTML5 drag - vaud's lore-reorder idiom, since vaud has no dnd-kit), an order
 * badge that reads END / TOP / &@depth / @depth / number, the name with a tiny role badge + marker
 * badge + in-chat "Depth N · Order N" badge, a truncated preview (hidden when expanded), "N tok",
 * the toggle, and - when expanded - the content textarea with Edit Settings / To Category / Delete
 * actions. Clicking the row body BOTH selects it into the sidebar AND expands its content (RC).
 */
import type { DragEvent, JSX } from "react";
import type { PresetPrompt } from "../../../../entities/preset";
import { blockTokens } from "../../../../core/preset";
import { ToggleSwitch } from "../../../components/toggle-switch";
import { BlockContent } from "./block-content";
import s from "./preset.module.css";

/** RC's order badge: END/TOP for the preset pins, &@depth for append-glue, @depth for in-chat. */
function orderBadge(block: PresetPrompt, index: number): string {
  if (block.placement === "append_preset") return "END";
  if (block.placement === "prepend_preset") return "TOP";
  if (block.placement === "append") return `&@${block.injectionDepth}`;
  if (block.placement === "in_chat") return `@${block.injectionDepth}`;
  return String(index + 1).padStart(2, "0");
}

const roleClass = (role: string): string =>
  (role === "user" ? s.rUsr : role === "assistant" ? s.rAst : s.rSys) ?? "";

const previewOf = (b: PresetPrompt): string => b.content.slice(0, 100).replace(/\n/g, " ");

export interface BlockRowProps {
  block: PresetPrompt;
  index: number;
  active: boolean;
  selected: boolean;
  expanded: boolean;
  onSelectRow: () => void;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onPatch: (patch: Partial<PresetPrompt>) => void;
  onDragStart: () => void;
  onDropOn: () => void;
}

export function BlockRow({
  block,
  index,
  active,
  selected,
  expanded,
  onSelectRow,
  onToggleCheck,
  onToggleExpand,
  onToggle,
  onDelete,
  onPatch,
  onDragStart,
  onDropOn,
}: BlockRowProps): JSX.Element {
  const inChat = block.placement === "in_chat" || block.placement === "append";
  const tokens = block.marker ? 0 : blockTokens(block);
  const tokenDisplay = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens);

  const wrapCls = [s.rowWrap, expanded ? s.rowWrapOpen : ""].filter(Boolean).join(" ");
  const rowCls = [
    s.prow,
    block.enabled ? "" : s.prowOff,
    !expanded && active ? s.prowActive : "",
    selected ? s.prowSel : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stop = (e: { stopPropagation: () => void }): void => e.stopPropagation();

  return (
    <div className={wrapCls}>
      <div
        className={rowCls}
        onClick={() => {
          onSelectRow();
          onToggleExpand();
        }}
        onDragOver={(e: DragEvent) => e.preventDefault()}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          onDropOn();
        }}
      >
        <button
          type="button"
          className={expanded ? `${s.chev} ${s.chevOpen}` : s.chev}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse content" : "Expand content"}
          onClick={(e) => {
            stop(e);
            onToggleExpand();
          }}
        >
          &#8250;
        </button>

        <button
          type="button"
          className={selected ? `${s.check} ${s.checkOn}` : s.check}
          aria-label={selected ? "Deselect" : "Select"}
          aria-pressed={selected}
          onClick={(e) => {
            stop(e);
            onToggleCheck();
          }}
        >
          {selected ? "✓" : ""}
        </button>

        <span
          className={s.grip}
          draggable
          aria-label="Drag to reorder"
          onClick={stop}
          onDragStart={onDragStart}
        >
          &#10303;
        </span>

        <span className={inChat ? `${s.ord} ${s.ordAt}` : s.ord}>{orderBadge(block, index)}</span>

        <div className={s.main}>
          <div className={s.titleRow}>
            <span className={s.ptitle}>{block.name || "Untitled block"}</span>
            <span className={`${s.role} ${roleClass(block.role)}`}>{block.role}</span>
            {block.marker && <span className={s.mk}>marker</span>}
            {inChat && (
              <span className={s.depthBadge}>
                Depth {block.injectionDepth} · Order {block.injectionOrder}
              </span>
            )}
          </div>
          {!expanded && (
            <p className={s.prev}>
              {previewOf(block) || "empty block"}
              {block.content.length > 100 ? "…" : ""}
            </p>
          )}
        </div>

        <span className={s.tok}>{block.marker ? "slot" : `${tokenDisplay} tok`}</span>

        <span onClick={stop} className={s.toggleWrap}>
          <ToggleSwitch on={block.enabled} onChange={onToggle} label={block.enabled ? "on" : "off"} />
        </span>
      </div>

      {expanded && (
        <div className={s.expandArea}>
          <BlockContent block={block} onPatch={onPatch} />
          <div className={s.expandActions}>
            <button type="button" className={s.actBtn} onClick={onSelectRow}>
              Edit settings
            </button>
            <button type="button" className={`${s.actBtn} ${s.actDanger}`} onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
