/**
 * SillyTavern completion-preset wire layer, emit side (specs/formats/st-preset.md
 * "Serialization"). The raw twin (entity.original.sillytavern.raw) is the escrow: emit clones it,
 * overwrites every mapped field from canonical, rebuilds prompts[] with divider rows replayed from
 * canonical groups (group.id IS the original divider identifier - never re-minted), and rebuilds
 * the GLOBAL prompt_order entry from the walk + canonical enabled. Unknown top-level keys survive
 * on the clone untouched. Spec laws honored here: enabled never rides on a prompt row; marker only
 * emitted when true; the five true markers emit the sparse 4-key shape ONLY at all-default state.
 */
import type { PresetBody, PresetGroup, PresetPrompt } from "../../entities/preset/schema";
import {
  API_OPTION_FIELDS,
  BEHAVIOR_FIELDS,
  DEFAULT_MARKER_IDENTIFIERS,
  GENERATION_FIELDS,
  isRec,
  MEDIA_FIELDS,
  POSITION_BY_PLACEMENT,
  SAMPLER_FIELDS,
  SYSTEM_PROMPT_FIELDS,
  TEMPLATE_FIELDS,
  type DividerDialect,
  type Rec,
} from "./st-preset-wire";

/** A true marker at parse-time defaults emits ST's preferred sparse 4-key shape (lossless: the
 * next parse recovers the same defaults). Any customized field forces the full shape instead -
 * always-sparse is provably lossy (spec "Serialization"). */
function markerIsAllDefault(p: PresetPrompt): boolean {
  return (
    p.content === "" &&
    p.role === "system" &&
    p.placement === "relative" &&
    p.injectionDepth === 4 &&
    p.injectionOrder === 100 &&
    p.forbidOverrides === false &&
    (p.injectionTrigger === undefined || p.injectionTrigger.length === 0)
  );
}

function emitPromptRow(p: PresetPrompt): Rec {
  if (p.marker && DEFAULT_MARKER_IDENTIFIERS.has(p.id) && markerIsAllDefault(p)) {
    return { identifier: p.id, name: p.name, system_prompt: p.systemPrompt, marker: true };
  }
  const row: Rec = {
    identifier: p.id,
    name: p.name,
    content: p.content,
    role: p.role,
    system_prompt: p.systemPrompt,
    injection_position:
      POSITION_BY_PLACEMENT[p.placement] ??
      (typeof p.extras?.injectionPositionRaw === "number" ? p.extras.injectionPositionRaw : 0),
    injection_depth: p.injectionDepth,
    injection_order: p.injectionOrder,
    forbid_overrides: p.forbidOverrides,
  };
  if (p.marker) row.marker = true; // false omits the key entirely (spec law)
  if (p.injectionTrigger && p.injectionTrigger.length > 0) row.injection_trigger = p.injectionTrigger;
  return row;
}

/** A divider row replayed from a canonical group: stored identifier, original decorated name when
 * escrowed in extras, dialect-appropriate name otherwise (a vaud-authored group has no escrow). */
function emitDividerRow(g: PresetGroup, dialect: DividerDialect): Rec {
  const escrowName = typeof g.extras?.stDividerName === "string" ? g.extras.stDividerName : undefined;
  const name =
    escrowName ??
    (dialect === "nemo-wiki"
      ? g.parentGroupId
        ? `<${g.name}>`
        : `===${g.name}===`
      : `━━━ ${g.name} ━━━`);
  const row: Rec = { identifier: g.id, name, content: g.content ?? "", role: "system", system_prompt: false, marker: false };
  return row;
}

/**
 * Rebuild prompts[] and the global prompt_order from canonical state. Walk order = canonical
 * prompts[] order (the parse-time working sequence), interleaving each group's divider row at the
 * FIRST appearance of one of its member prompts (parents before subcategories). Groups with no
 * remaining members emit their divider at the tail so an emptied category survives round-trip.
 */
export function rebuildRows(body: PresetBody, dialect: DividerDialect): { rows: Rec[]; order: Rec[] } {
  const groups = body.groups ?? [];
  const byId = new Map(groups.map((g) => [g.id, g]));
  const emitted = new Set<string>();
  const rows: Rec[] = [];
  const order: Rec[] = [];
  const useDialect: DividerDialect = dialect === "none" && groups.length > 0 ? "legacy" : dialect;

  const openGroup = (id: string | undefined): void => {
    if (id === undefined || emitted.has(id)) return;
    const g = byId.get(id);
    if (!g) return;
    openGroup(g.parentGroupId); // parent category divider first
    emitted.add(g.id);
    rows.push(emitDividerRow(g, useDialect));
    order.push({ identifier: g.id, enabled: g.enabled !== false });
  };

  for (const p of body.prompts) {
    openGroup(p.groupId);
    rows.push(emitPromptRow(p));
    order.push({ identifier: p.id, enabled: p.enabled });
  }
  for (const g of groups) openGroup(g.id); // emptied categories still round-trip

  return { rows, order };
}

/** Overwrite one settings group's mapped wire keys from canonical; absent canonical fields leave
 * the twin's value standing (nothing dropped), and a fresh emit writes only what canonical has. */
function writeGroup(out: Rec, group: Rec | undefined, fields: ReadonlyArray<readonly [string, string]>): void {
  if (!group) return;
  for (const [wire, canon] of fields) {
    if (group[canon] !== undefined) out[wire] = group[canon];
  }
}

/** Emit a canonical preset body over its raw twin (or from scratch when no twin exists). */
export function buildStPreset(body: PresetBody, rawTwin: Rec | undefined, dialect: DividerDialect): Rec {
  const out: Rec = rawTwin ? { ...rawTwin } : {};
  writeGroup(out, body.samplers as Rec | undefined, SAMPLER_FIELDS);
  writeGroup(out, body.systemPrompts as Rec | undefined, SYSTEM_PROMPT_FIELDS);
  writeGroup(out, body.templates as Rec | undefined, TEMPLATE_FIELDS);
  writeGroup(out, body.behavior as Rec | undefined, BEHAVIOR_FIELDS);
  writeGroup(out, body.apiOptions as Rec | undefined, API_OPTION_FIELDS);
  writeGroup(out, body.media as Rec | undefined, MEDIA_FIELDS);
  writeGroup(out, body.generation as Rec | undefined, GENERATION_FIELDS);

  const { rows, order } = rebuildRows(body, dialect);
  out.prompts = rows;
  // per-character orders carry through verbatim; the rebuilt GLOBAL entry (numeric 100001 form)
  // is appended after them (spec "Serialization" + edge case 9)
  const priorOrders = Array.isArray(out.prompt_order) ? out.prompt_order.filter(isRec) : [];
  const nonGlobal = priorOrders.filter((o) => o.character_id !== 100001 && o.character_id !== "100001");
  out.prompt_order = [...nonGlobal, { character_id: 100001, order }];
  return out;
}
