/**
 * PromptEditPanel - the right EDIT PROMPT sidebar (a faithful transcription of RC's
 * PromptEditPanelV4). Edits the SELECTED block's METADATA: name, role, a token-count card, injection
 * order (+ hint), placement (per-lens select with descriptions - the position-picker law), injection
 * depth (when at-depth), a content-preview notice, and the Advanced flags (system prompt / forbid
 * overrides) + marker card. Content is edited INLINE in the list (RC's split), so this says so.
 * Edits apply live via onPatch; the ehead Save persists. Empty state when nothing is selected.
 */
import { useMemo, type JSX } from "react";
import type { PresetPrompt, PromptRole } from "../../../../entities/preset";
import {
  blockTokens,
  macroGroupsForProfile,
  PRESET_PLACEMENT_LABELS,
  type PresetWriteForProfile,
} from "../../../../core/preset";
import { MacroReference } from "./macro-reference";
import s from "./sidebar.module.css";
import f from "./preset.module.css";

const ROLES: readonly PromptRole[] = ["system", "user", "assistant"];
const DEPTH_PLACEMENTS = new Set(["in_chat", "append"]);

export interface PromptEditPanelProps {
  block: PresetPrompt | null;
  /** placement stops the active Write-for lens carries (placementsForProfile) */
  stops: readonly string[];
  /** the selected Write-for lens - drives which macro groups the reference shows */
  writeFor: PresetWriteForProfile;
  onClose: () => void;
  onPatch: (patch: Partial<PresetPrompt>) => void;
}

export function PromptEditPanel({ block, stops, writeFor, onClose, onPatch }: PromptEditPanelProps): JSX.Element {
  const macroGroups = useMemo(() => macroGroupsForProfile(writeFor), [writeFor]);
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
          <div className={s.sideRow}>
            <label className={f.sfield}>
              <span className={f.flabel}>Name</span>
              <input
                className={f.field}
                value={block.name}
                placeholder="Block name"
                aria-label="Block name"
                onChange={(e) => onPatch({ name: e.target.value })}
              />
            </label>
            <label className={f.sfield}>
              <span className={f.flabel}>Role</span>
              <select
                className={f.field}
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
          </div>

          <div className={s.tokenCard}>
            <span className={s.tokenCardLabel}>Token count</span>
            <span className={s.tokenCardVal}>{block.marker ? "slot" : blockTokens(block)}</span>
          </div>

          <label className={f.sfield}>
            <span className={f.flabel}>Injection order</span>
            <input
              className={f.field}
              type="number"
              value={block.injectionOrder}
              aria-label="Injection order"
              onChange={(e) => onPatch({ injectionOrder: Number(e.target.value) })}
            />
            <span className={s.sideHintLine}>Lower values appear first in context.</span>
          </label>

          <label className={f.sfield}>
            <span className={f.flabel}>Placement</span>
            <select
              className={f.field}
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
            <label className={f.sfield}>
              <span className={f.flabel}>Injection depth</span>
              <input
                className={f.field}
                type="number"
                min={0}
                value={block.injectionDepth}
                aria-label="Injection depth"
                onChange={(e) => onPatch({ injectionDepth: Number(e.target.value) })}
              />
            </label>
          )}

          <p className={s.sideContentNote}>
            Edit this block's content inline — click its expand arrow in the list.
          </p>

          <div className={s.sideAdvanced}>
            <span className={s.sideAdvancedLabel}>Advanced</span>
            <label className={s.sideCheck}>
              System prompt
              <input
                type="checkbox"
                checked={block.systemPrompt}
                onChange={(e) => onPatch({ systemPrompt: e.target.checked })}
              />
            </label>
            <label className={s.sideCheck}>
              Forbid overrides
              <input
                type="checkbox"
                checked={block.forbidOverrides}
                onChange={(e) => onPatch({ forbidOverrides: e.target.checked })}
              />
            </label>
            {block.marker && (
              <p className={s.sideMarker}>
                Marker slot: {block.markerSlot ?? "unset"} · its content splices in at build.
              </p>
            )}
          </div>

          <MacroReference groups={macroGroups} />
        </div>
      )}
    </aside>
  );
}
