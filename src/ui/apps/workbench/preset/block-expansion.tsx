/**
 * BlockExpansion - the ONE editing place (PRESET-JEWEL-PLAN.md P4, transcribed from
 * design/vs-preset-hybrid.html). Expanding a row opens the WHOLE block inline: name, role, the
 * placement rail (per-lens stops - the position-picker law), order, and the content editor, plus a
 * footer with live tokens/chars and delete. No slide-over, no duplicate metadata panel.
 *
 * The placement rail is transcribed as PILLS from the locked wire (not lore's slider PositionPicker -
 * the wire's approved UI is a pill strip; the "generalize PositionPicker" call was for a slider rail
 * that does not match what Chi approved here). Content is a plain textarea for now; the CodeEditor +
 * macro autocomplete is a later polish slice.
 */
import type { JSX } from "react";
import type { PresetPrompt, PromptRole } from "../../../../entities/preset";
import { blockTokens, PRESET_PLACEMENT_LABELS } from "../../../../core/preset";
import es from "../editor-styles";
import s from "./preset.module.css";

const ROLES: readonly PromptRole[] = ["system", "user", "assistant"];
const DEPTH_PLACEMENTS = new Set(["in_chat", "append"]);

export interface BlockExpansionProps {
  block: PresetPrompt;
  /** placement stops this Write-for lens carries (placementsForProfile) */
  stops: readonly string[];
  onPatch: (patch: Partial<PresetPrompt>) => void;
  onDelete: () => void;
}

export function BlockExpansion({ block, stops, onPatch, onDelete }: BlockExpansionProps): JSX.Element {
  const atDepth = DEPTH_PLACEMENTS.has(block.placement);
  const foreign = !stops.includes(block.placement);

  return (
    <div className={s.exp}>
      <div className={s.expMeta}>
        <label className={`${es.bfield} ${s.expName}`}>
          <span className={es.blabel}>Name</span>
          <input
            className={es.in}
            value={block.name}
            placeholder="Block name"
            aria-label="Block name"
            onChange={(e) => onPatch({ name: e.target.value })}
          />
        </label>
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
        <div className={es.bfield}>
          <span className={es.blabel}>Placement</span>
          <div className={s.placeRail} role="group" aria-label="Placement">
            {stops.map((stop) => (
              <button
                key={stop}
                type="button"
                className={block.placement === stop ? `${s.placePill} ${s.placeOn}` : s.placePill}
                aria-pressed={block.placement === stop}
                title={PRESET_PLACEMENT_LABELS[stop]?.hint ?? stop}
                onClick={() => onPatch({ placement: stop })}
              >
                {PRESET_PLACEMENT_LABELS[stop]?.label ?? stop}
              </button>
            ))}
            {foreign && (
              <button type="button" className={`${s.placePill} ${s.placeOn} ${s.placeForeign}`} disabled aria-pressed>
                {PRESET_PLACEMENT_LABELS[block.placement]?.label ?? block.placement}
              </button>
            )}
          </div>
        </div>
        {atDepth && (
          <label className={`${es.bfield} ${s.expDepth}`}>
            <span className={es.blabel}>Depth</span>
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
        <label className={`${es.bfield} ${s.expOrder}`}>
          <span className={es.blabel}>Order</span>
          <input
            className={es.in}
            type="number"
            value={block.injectionOrder}
            aria-label="Injection order"
            onChange={(e) => onPatch({ injectionOrder: Number(e.target.value) })}
          />
        </label>
      </div>

      <textarea
        className={`${es.in} ${es.ta} ${s.expContent}`}
        value={block.content}
        placeholder="Block content. Macros like {{getvar::X}} stay literal - a runtime resolves them."
        aria-label="Block content"
        onChange={(e) => onPatch({ content: e.target.value })}
      />

      <div className={s.expFoot}>
        <span>
          ~{blockTokens(block)} tokens · {block.content.length} chars
        </span>
        <button type="button" className={s.expDelete} onClick={onDelete}>
          Delete block
        </button>
      </div>
    </div>
  );
}
