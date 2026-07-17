/**
 * Pure preset editor session ops (PRESET-JEWEL-PLAN.md P4). A preset is name + settings + an ordered
 * list of prompt BLOCKS; the session is body + baseline, patches are pure spreads. Block ids: an
 * authored block gets a fresh vaud id; an IMPORTED block keeps its verbatim source identifier (the
 * schema's UUID-regen exemption), so newBlock() only mints for authored ones.
 */
import { newUiId } from "../../../_shared/new-id";
import type { PresetBody, PresetPrompt } from "../../../../entities/preset";

export const presetDirty = (body: PresetBody, baseline: PresetBody): boolean =>
  JSON.stringify(body) !== JSON.stringify(baseline);

export const patchBody = (body: PresetBody, patch: Partial<PresetBody>): PresetBody => ({
  ...body,
  ...patch,
});

/** A blank authored block (fresh vaud id, relative system placement - the ST default shape). */
export const newBlock = (over: Partial<PresetPrompt> = {}): PresetPrompt => ({
  id: newUiId("block"),
  name: "New block",
  content: "",
  role: "system",
  enabled: true,
  systemPrompt: false,
  marker: false,
  placement: "relative",
  injectionDepth: 4,
  injectionOrder: 100,
  forbidOverrides: false,
  ...over,
});

export const addBlock = (body: PresetBody, block: PresetPrompt = newBlock()): PresetBody => ({
  ...body,
  prompts: [...body.prompts, block],
});

/* ---------- bulk ops over a checked selection (RC's PromptListV4 bulk actions) ---------- */

/** Enable or disable every selected block in one pass. */
export const bulkSetEnabled = (body: PresetBody, ids: ReadonlySet<string>, enabled: boolean): PresetBody => ({
  ...body,
  prompts: body.prompts.map((p) => (ids.has(p.id) ? { ...p, enabled } : p)),
});

export const bulkDelete = (body: PresetBody, ids: ReadonlySet<string>): PresetBody => ({
  ...body,
  prompts: body.prompts.filter((p) => !ids.has(p.id)),
});

/**
 * Copy each selected block in place, right after its original, preserving list order. A duplicate is
 * an AUTHORED block: it mints a fresh id and never inherits the source identifier, or a round-trip
 * would emit the same identifier twice.
 */
export const bulkDuplicate = (body: PresetBody, ids: ReadonlySet<string>): PresetBody => ({
  ...body,
  prompts: body.prompts.flatMap((p) =>
    ids.has(p.id) ? [p, { ...structuredClone(p), id: newUiId("block"), name: `${p.name} (copy)` }] : [p],
  ),
});

export const toggleBlock = (body: PresetBody, id: string): PresetBody => ({
  ...body,
  prompts: body.prompts.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
});

export const deleteBlock = (body: PresetBody, id: string): PresetBody => ({
  ...body,
  prompts: body.prompts.filter((p) => p.id !== id),
});

export const patchBlock = (
  body: PresetBody,
  id: string,
  patch: Partial<PresetPrompt>,
): PresetBody => ({
  ...body,
  prompts: body.prompts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
});

/** Move a block to a new index in the manuscript order (clamped; a missing id is a no-op). */
export const moveBlock = (body: PresetBody, id: string, toIndex: number): PresetBody => {
  const from = body.prompts.findIndex((p) => p.id === id);
  if (from < 0) return body;
  const next = [...body.prompts];
  const [moved] = next.splice(from, 1);
  const clamped = Math.max(0, Math.min(toIndex, next.length));
  next.splice(clamped, 0, moved!);
  return { ...body, prompts: next };
};
