/**
 * PromptEditPanel - the right EDIT PROMPT sidebar (a 1-1 port of RC's PromptEditPanelV4). Edits the
 * SELECTED block's METADATA - name, role, injection order, placement (per-lens stops - the
 * position-picker law), injection depth (when at-depth), and the advanced flags. Content is edited
 * INLINE in the list (RC's split model), so this panel says so. Empty state when nothing is selected.
 * Edits apply live via onPatch; the ehead Save persists.
 */
import type { JSX } from "react";
import type { PresetPrompt, PromptRole } from "../../../../entities/preset";
import { blockTokens, PRESET_PLACEMENT_LABELS } from "../../../../core/preset";
import es from "../editor-styles";
import s from "./preset.module.css";

const ROLES: readonly PromptRole[] = ["system", "user", "assistant"];
const DEPTH_PLACEMENTS = new Set(["in_chat", "append"]);

export interface PromptEditPanelProps {
  block: PresetPrompt | null;
  /** placement stops the active Write-for lens carries (placementsForProfile) */
  stops: readonly string[];
  onClose: () => void;
  onPatch: (patch: Partial<PresetPrompt>) => void;
}

export function PromptEditPanel({ block, stops, onClose, onPatch }: PromptEditPanelProps): JSX.Element {
  return (
    <aside className={s.sidebar} aria-label="Edit prompt">
      <div className={s.sideHead}>
        <span className={s.sideHeadTitle}>{block ? block.name || "Untitled block" : "Edit Prompt"}</span>
        {block && (
          <button type="button" className={s.sideClose} aria-label="Close editor" onClick={onClose}>
            &#215;
          </button>
        )}
      </div>
      {block === null ? (
        <div className={s.sideEmpty}>
          <p className={s.sideEmptyTitle}>No prompt selected</p>
          <p className={s.sideEmptyHint}>Select a block from the list to view and edit its settings.</p>
        </div>
      ) : (
        <div className={s.sideBody}>
          <label className={es.bfield}>
            <span className={es.blabel}>Name</span>
            <input
              className={es.in}
              value={block.name}
              placeholder="Block name"
              aria-label="Block name"
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </label>

          <div className={s.sideRow}>
            <label className={es.bfield}>
              <span className={es.blabel}>Role</span>
              <select
                className={es.in}
                value={block.role}
                aria-label="Block role"
                onChange={(e) => onPatch({ role: e.target.value as PromptRole })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className={es.bfield}>
              <span className={es.blabel}>Token count</span>
              <input className={es.in} value={block.marker ? "slot" : `~${blockTokens(block)}`} readOnly aria-label="Token count" />
            </label>
          </div>

          <label className={es.bfield}>
            <span className={es.blabel}>Injection order</span>
            <input
              className={es.in}
              type="number"
              value={block.injectionOrder}
              aria-label="Injection order"
              onChange={(e) => onPatch({ injectionOrder: Number(e.target.value) })}
            />
            <span className={s.sideHintLine}>Lower values appear first.</span>
          </label>

          <label className={es.bfield}>
            <span className={es.blabel}>Placement</span>
            <select
              className={es.in}
              value={block.placement}
              aria-label="Placement"
              onChange={(e) => onPatch({ placement: e.target.value })}
            >
              {stops.map((stop) => (
                <option key={stop} value={stop}>
                  {PRESET_PLACEMENT_LABELS[stop]?.label ?? stop}
                  {PRESET_PLACEMENT_LABELS[stop]?.hint ? ` — ${PRESET_PLACEMENT_LABELS[stop]!.hint}` : ""}
                </option>
              ))}
              {!stops.includes(block.placement) && (
                <option value={block.placement}>
                  {PRESET_PLACEMENT_LABELS[block.placement]?.label ?? block.placement} (held from another lens)
                </option>
              )}
            </select>
          </label>

          {DEPTH_PLACEMENTS.has(block.placement) && (
            <label className={es.bfield}>
              <span className={es.blabel}>Injection depth</span>
              <input
                className={es.in}
                type="number"
                min={0}
                value={block.injectionDepth}
                aria-label="Injection depth"
                onChange={(e) => onPatch({ injectionDepth: Number(e.target.value) })}
              />
            </label>
          )}

          <div className={s.sideAdvanced}>
            <span className={s.sideAdvancedLabel}>Advanced</span>
            <label className={s.sideCheck}>
              <input
                type="checkbox"
                checked={block.systemPrompt}
                onChange={(e) => onPatch({ systemPrompt: e.target.checked })}
              />
              System prompt
            </label>
            <label className={s.sideCheck}>
              <input
                type="checkbox"
                checked={block.forbidOverrides}
                onChange={(e) => onPatch({ forbidOverrides: e.target.checked })}
              />
              Forbid overrides
            </label>
            {block.marker && (
              <p className={s.sideMarker}>
                Marker slot: <b>{block.markerSlot ?? "unset"}</b> · its content splices in at build.
              </p>
            )}
          </div>

          <p className={s.sideContentNote}>Edit this block's content inline — click its expand arrow in the list.</p>
        </div>
      )}
    </aside>
  );
}
