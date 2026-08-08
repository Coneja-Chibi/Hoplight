/**
 * Pure preset body, sampler, block, and group operations shared by Kit and the Workbench.
 */
import type {
  PresetBody,
  PresetGroup,
  PresetPrompt,
  PresetSamplers,
} from "./schema";

export const patchPresetBody = (
  body: PresetBody,
  patch: Partial<PresetBody>,
): PresetBody => ({ ...body, ...structuredClone(patch) });

export function setPresetSampler(
  body: PresetBody,
  key: keyof PresetSamplers,
  value: number | string | undefined,
): PresetBody {
  const samplers: PresetSamplers = { ...(body.samplers ?? {}) };
  if (value === undefined || value === "") delete samplers[key];
  else (samplers as Record<string, unknown>)[key] = value;
  if (Object.keys(samplers).length === 0) {
    const { samplers: _removed, ...rest } = body;
    return rest;
  }
  return { ...body, samplers };
}

/**
 * Where a new block goes.
 *
 * ORDER IS THE PAYLOAD in a preset: a block evaluates in position, and one that lands at the bottom
 * says something different from the same text at the top. This used to have no answer - every add
 * appended - so writing an opening README meant adding it last and then remembering to move it, and
 * the time that was forgotten the model handed back a preset with its introduction at the end and a
 * note asking somebody to drag it.
 */
export type BlockPlacement =
  | "first"
  | "last"
  | { readonly before: string }
  | { readonly after: string };

/** The index a placement names, or null when it names a block that is not there. */
export function placementIndex(
  prompts: readonly PresetPrompt[],
  place: BlockPlacement | undefined,
): number | null {
  if (place === undefined || place === "last") return prompts.length;
  if (place === "first") return 0;
  const anchor = "before" in place ? place.before : place.after;
  const at = prompts.findIndex((item) => item.id === anchor);
  // NAMED AND ABSENT IS AN ERROR, not an append. Silently putting it last is how a block ends up
  // somewhere nobody asked for, which is the whole failure this argument exists to prevent.
  if (at < 0) return null;
  return "before" in place ? at : at + 1;
}

export function addPresetBlock(
  body: PresetBody,
  block: PresetPrompt,
  place?: BlockPlacement,
): PresetBody {
  if (body.prompts.some((item) => item.id === block.id)) {
    throw new Error(`preset block "${block.id}" already exists`);
  }
  if (
    block.marker
    && block.markerSlot
    && body.prompts.some((item) => item.marker && item.markerSlot === block.markerSlot)
  ) {
    throw new Error(`preset marker slot "${block.markerSlot}" is already placed`);
  }
  const at = placementIndex(body.prompts, place);
  if (at === null) {
    const anchor = place && typeof place === "object" && "before" in place ? place.before : (place as { after: string }).after;
    throw new Error(`preset block "${anchor}" does not exist, so there is nowhere to put this one`);
  }
  const prompts = [...body.prompts];
  prompts.splice(at, 0, structuredClone(block));
  return { ...body, prompts };
}

export const placedPresetMarkerSlots = (body: PresetBody): ReadonlySet<string> =>
  new Set(body.prompts.flatMap((item) =>
    item.marker && item.markerSlot ? [item.markerSlot] : []));

function requiredBlock(body: PresetBody, id: string): PresetPrompt {
  const block = body.prompts.find((item) => item.id === id);
  if (!block) throw new Error(`preset block "${id}" does not exist`);
  return block;
}

export function patchPresetBlock(
  body: PresetBody,
  id: string,
  patch: Partial<PresetPrompt>,
): PresetBody {
  requiredBlock(body, id);
  return {
    ...body,
    prompts: body.prompts.map((item) =>
      item.id === id ? { ...item, ...structuredClone(patch), id: item.id } : item),
  };
}

export function removePresetBlocks(body: PresetBody, ids: ReadonlySet<string>): PresetBody {
  for (const id of ids) requiredBlock(body, id);
  return { ...body, prompts: body.prompts.filter((item) => !ids.has(item.id)) };
}

export function setPresetBlocksEnabled(
  body: PresetBody,
  ids: ReadonlySet<string>,
  enabled: boolean,
): PresetBody {
  for (const id of ids) requiredBlock(body, id);
  return {
    ...body,
    prompts: body.prompts.map((item) => ids.has(item.id) ? { ...item, enabled } : item),
  };
}

export function movePresetBlock(body: PresetBody, id: string, toIndex: number): PresetBody {
  const from = body.prompts.findIndex((item) => item.id === id);
  if (from < 0) throw new Error(`preset block "${id}" does not exist`);
  const next = [...body.prompts];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved!);
  return { ...body, prompts: next };
}

export function setPresetBlockGroup(
  body: PresetBody,
  id: string,
  groupId: string | null,
): PresetBody {
  requiredBlock(body, id);
  if (groupId !== null && !(body.groups ?? []).some((group) => group.id === groupId)) {
    throw new Error(`preset group "${groupId}" does not exist`);
  }
  return {
    ...body,
    prompts: body.prompts.map((item) => {
      if (item.id !== id) return item;
      if (groupId === null) {
        const { groupId: _removed, ...rest } = item;
        return rest;
      }
      return { ...item, groupId };
    }),
  };
}

export function addPresetGroup(body: PresetBody, group: PresetGroup): PresetBody {
  const groups = body.groups ?? [];
  if (groups.some((item) => item.id === group.id)) {
    throw new Error(`preset group "${group.id}" already exists`);
  }
  if (group.parentGroupId && !groups.some((item) => item.id === group.parentGroupId)) {
    throw new Error(`preset parent group "${group.parentGroupId}" does not exist`);
  }
  return { ...body, groups: [...groups, structuredClone(group)] };
}

export function patchPresetGroup(
  body: PresetBody,
  id: string,
  patch: Partial<PresetGroup>,
): PresetBody {
  const groups = body.groups ?? [];
  if (!groups.some((item) => item.id === id)) {
    throw new Error(`preset group "${id}" does not exist`);
  }
  if (patch.parentGroupId === id) throw new Error("a preset group cannot contain itself");
  if (
    patch.parentGroupId
    && !groups.some((item) => item.id === patch.parentGroupId)
  ) {
    throw new Error(`preset parent group "${patch.parentGroupId}" does not exist`);
  }
  return {
    ...body,
    groups: groups.map((item) =>
      item.id === id ? { ...item, ...structuredClone(patch), id: item.id } : item),
  };
}

export function removePresetGroup(body: PresetBody, id: string): PresetBody {
  const groups = body.groups ?? [];
  if (!groups.some((item) => item.id === id)) {
    throw new Error(`preset group "${id}" does not exist`);
  }
  const remaining = groups
    .filter((item) => item.id !== id)
    .map((item) => {
      if (item.parentGroupId !== id) return item;
      const { parentGroupId: _removed, ...rest } = item;
      return rest;
    });
  const prompts = body.prompts.map((item) => {
    if (item.groupId !== id) return item;
    const { groupId: _removed, ...rest } = item;
    return rest;
  });
  return {
    ...body,
    prompts,
    ...(remaining.length ? { groups: remaining } : { groups: undefined }),
  };
}
