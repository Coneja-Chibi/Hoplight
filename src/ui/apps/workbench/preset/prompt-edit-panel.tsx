/**
 * PromptEditPanel - the right EDIT PROMPT sidebar (a faithful transcription of RC's
 * PromptEditPanelV4). Edits the SELECTED block's METADATA: name, role, a token-count card, injection
 * order (+ hint), placement (per-lens select + the conditional hint for the non-relative stops),
 * injection depth (in an accent card when at-depth), a content-preview notice with char/token
 * counts, the Advanced flags (system prompt / forbid overrides) + marker card, and the capability-
 * driven macro reference. Field labels carry a "?" help dot (RC's PROMPT_TOOLTIPS text). Content is
 * edited INLINE in the list (RC's split). Edits apply live via onPatch; the ehead Save persists.
 * NOT ported (deliberate): RC's per-block Cancel/Save footer (vaud saves the whole preset from the
 * ehead) and its non-marker "Use + Add marker slot" card (vaud has no marker-slot picker yet).
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
import { HelpDot } from "./help-dot";
import { PROMPT_HELP } from "./help";
import s from "./sidebar.module.css";
import f from "./preset.module.css";

const ROLES: readonly PromptRole[] = ["system", "user", "assistant"];
const DEPTH_PLACEMENTS = new Set(["in_chat", "append"]);

/** Faithful RC hint copy shown under the placement select for the non-relative stops. */
const PLACEMENT_HINTS: Record<string, string> = {
  append:
    "Glued onto the end of the depth-th-from-last message of this prompt's role (system uses the user's message). Keeps message alternation intact.",
  append_preset:
    "Pinned to the very end of the assembled prompt, after chat history, post-history prompts, and the author's note. Holds regardless of list order.",
  prepend_preset:
    "Pinned to the very top of the assembled prompt, before relative prompts and everything else. Holds regardless of list order.",
};

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
              <span className={f.flabel}>
                Role
                <HelpDot help={PROMPT_HELP.role} />
              </span>
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
            <span className={f.flabel}>
              Injection order
              <HelpDot help={PROMPT_HELP.injectionOrder} />
            </span>
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
            <span className={f.flabel}>
              Placement
              <HelpDot help={PROMPT_HELP.placement} />
            </span>
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
            {PLACEMENT_HINTS[block.placement] && (
              <span className={s.sideHint}>{PLACEMENT_HINTS[block.placement]}</span>
            )}
          </label>

          {DEPTH_PLACEMENTS.has(block.placement) && (
            <div className={s.sideDepthCard}>
              <label className={f.sfield}>
                <span className={f.flabel}>
                  Injection depth
                  <HelpDot help={PROMPT_HELP.injectionDepth} />
                </span>
                <input
                  className={f.field}
                  type="number"
                  min={0}
                  value={block.injectionDepth}
                  aria-label="Injection depth"
                  onChange={(e) => onPatch({ injectionDepth: Number(e.target.value) })}
                />
              </label>
            </div>
          )}

          <p className={s.sideContentNote}>
            Edit this block's content inline. Click its expand arrow in the list.
            <span className={s.sideContentCount}>
              {block.content.length} characters · ~{blockTokens(block)} tokens
            </span>
          </p>

          <div className={s.sideAdvanced}>
            <span className={s.sideAdvancedLabel}>Advanced</span>
            <label className={s.sideCheck}>
              <span>
                System prompt
                <HelpDot help={PROMPT_HELP.systemPrompt} />
              </span>
              <input
                type="checkbox"
                checked={block.systemPrompt}
                onChange={(e) => onPatch({ systemPrompt: e.target.checked })}
              />
            </label>
            <label className={s.sideCheck}>
              <span>Forbid overrides</span>
              <input
                type="checkbox"
                checked={block.forbidOverrides}
                onChange={(e) => onPatch({ forbidOverrides: e.target.checked })}
              />
            </label>
            {block.marker && (
              <p className={s.sideMarker}>
                <span>
                  Marker slot
                  <HelpDot help={PROMPT_HELP.marker} />
                </span>
                : {block.markerSlot ?? "unset"} · its content splices in at build.
              </p>
            )}
          </div>

          <MacroReference groups={macroGroups} />
        </div>
      )}
    </aside>
  );
}
