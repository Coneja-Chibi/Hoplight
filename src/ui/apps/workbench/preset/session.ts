/**
 * Pure preset editor session ops (PRESET-JEWEL-PLAN.md P4). A preset is name + settings + an ordered
 * list of prompt BLOCKS; the session is body + baseline, patches are pure spreads. Block ids: an
 * authored block gets a fresh vaud id; an IMPORTED block keeps its verbatim source identifier (the
 * schema's UUID-regen exemption), so newBlock() only mints for authored ones.
 */
import { newUiId } from "../../../_shared/new-id";
import { MARKER_LABELS } from "../../../../core/preset";
import type { PresetBody, PresetPrompt, PresetSamplers } from "../../../../entities/preset";

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

/* ---------- settings ---------- */

/**
 * Set one sampler, or REMOVE it when value is undefined. Removing matters: the Round-Trip Law
 * forbids emitting a value the source never had, so clearing a field must delete the key rather
 * than write 0 - and an empty input must reach here as undefined, never Number("") === 0. The
 * `samplers` object itself drops away once its last key goes, so a preset that never carried
 * samplers does not gain an empty `{}` just from being opened.
 */
export const setSampler = (
  body: PresetBody,
  key: keyof PresetSamplers,
  value: number | string | undefined,
): PresetBody => {
  const samplers: PresetSamplers = { ...(body.samplers ?? {}) };
  if (value === undefined || value === "") delete samplers[key];
  else (samplers as Record<string, unknown>)[key] = value;

  if (Object.keys(samplers).length === 0) {
    const { samplers: _drop, ...rest } = body;
    return rest;
  }
  return { ...body, samplers };
};

/* ---------- marker slots ---------- */

/**
 * Append a marker block for an ST-compatible slot. A marker carries NO authored content - the engine
 * splices the real thing in at build - so it gets the slot's plain-language name and an empty body,
 * and the row renders it as a slot rather than handing anyone a textarea.
 *
 * Refuses a slot that is already placed: two chat-history markers is not a duplicate row, it is a
 * broken preset. The menu greys placed slots out, but the guard lives HERE too - the UI is not the
 * place to enforce an invariant.
 */
export const addMarker = (body: PresetBody, slot: string): PresetBody => {
  if (placedMarkerSlots(body).has(slot)) return body;
  return addBlock(
    body,
    newBlock({
      name: markerSlotName(slot),
      marker: true,
      markerSlot: slot,
      content: "",
    }),
  );
};

/** The slots already placed, so the menu can go quiet on them (and addMarker can refuse). */
export const placedMarkerSlots = (body: PresetBody): ReadonlySet<string> => {
  const placed = new Set<string>();
  for (const p of body.prompts) if (p.marker && p.markerSlot) placed.add(p.markerSlot);
  return placed;
};

/** Sentence-cased from core's own MARKER_LABELS ("the chat history" -> "Chat history"), never new copy. */
export const markerSlotName = (slot: string): string => {
  const label = MARKER_LABELS[slot];
  if (!label) return slot;
  const bare = label.replace(/^the /i, "");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
};

/* ---------- categories ---------- */

/**
 * Append a category. `order` is assigned past the current tail so a new folder lands last instead of
 * silently jumping the queue. ST has no real groups (it encodes them as divider PROMPTS), so the ST
 * codec derives a divider identifier from this id - which is why the id is minted here and stable.
 */
export const addGroup = (body: PresetBody, name = "New category"): PresetBody => {
  const groups = body.groups ?? [];
  const order = groups.reduce((n, g) => Math.max(n, g.order ?? 0), 0) + 1;
  return { ...body, groups: [...groups, { id: newUiId("group"), name, order }] };
};

/** Move a block into a category, or out of one when groupId is null. */
export const setBlockGroup = (body: PresetBody, id: string, groupId: string | null): PresetBody => ({
  ...body,
  prompts: body.prompts.map((p) => {
    if (p.id !== id) return p;
    if (groupId === null) {
      const { groupId: _drop, ...rest } = p;
      return rest;
    }
    return { ...p, groupId };
  }),
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
