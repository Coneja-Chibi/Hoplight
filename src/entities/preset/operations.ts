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

export function addPresetBlock(body: PresetBody, block: PresetPrompt): PresetBody {
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
  return { ...body, prompts: [...body.prompts, structuredClone(block)] };
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
