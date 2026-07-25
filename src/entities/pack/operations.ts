/** Pure pack, group, and sprite-item operations shared by Kit and editor surfaces. */
import { normalizeLabel, type SpritePackItem, type SpritePackValue } from "../../core/media";
import type { PackBody } from "./schema";

function ensureUnique(items: readonly SpritePackItem[]): void {
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`pack item "${item.id}" already exists`);
    const label = normalizeLabel(item.label);
    if (!label || labels.has(label)) throw new Error(`pack label "${item.label}" is duplicate or empty`);
    if (!item.ref.trim()) throw new Error(`pack item "${item.id}" has no media reference`);
    ids.add(item.id);
    labels.add(label);
  }
}

export function packAt(body: PackBody, groupId?: string): SpritePackValue {
  if (!groupId) return body.pack;
  const pack = body.groups?.[groupId];
  if (!pack) throw new Error(`pack group "${groupId}" does not exist`);
  return pack;
}

export function writePackAt(body: PackBody, pack: SpritePackValue, groupId?: string): PackBody {
  ensureUnique(pack.items);
  if (!groupId) return { ...body, pack };
  if (!body.groups?.[groupId]) throw new Error(`pack group "${groupId}" does not exist`);
  return { ...body, groups: { ...body.groups, [groupId]: pack } };
}

export function addPackItem(
  body: PackBody,
  item: SpritePackItem,
  groupId?: string,
): PackBody {
  const pack = packAt(body, groupId);
  return writePackAt(body, { ...pack, items: [...pack.items, structuredClone(item)] }, groupId);
}

export function patchPackItem(
  body: PackBody,
  id: string,
  patch: Partial<SpritePackItem>,
  groupId?: string,
): PackBody {
  const pack = packAt(body, groupId);
  if (!pack.items.some((item) => item.id === id)) throw new Error(`pack item "${id}" does not exist`);
  return writePackAt(body, {
    ...pack,
    items: pack.items.map((item) =>
      item.id === id ? { ...item, ...structuredClone(patch), id: item.id } : item),
  }, groupId);
}

export function removePackItem(body: PackBody, id: string, groupId?: string): PackBody {
  const pack = packAt(body, groupId);
  if (!pack.items.some((item) => item.id === id)) throw new Error(`pack item "${id}" does not exist`);
  const items = pack.items.filter((item) => item.id !== id);
  const defaultLabel = pack.defaultLabel && items.some(
    (item) => normalizeLabel(item.label) === normalizeLabel(pack.defaultLabel!),
  ) ? pack.defaultLabel : undefined;
  return writePackAt(body, { ...pack, items, defaultLabel }, groupId);
}

export function reorderPack(
  body: PackBody,
  orderedIds: readonly string[],
  groupId?: string,
): PackBody {
  const pack = packAt(body, groupId);
  const byId = new Map(pack.items.map((item) => [item.id, item]));
  if (orderedIds.length !== byId.size || orderedIds.some((id) => !byId.has(id))) {
    throw new Error("pack reorder must name every item exactly once");
  }
  const items = orderedIds.map((id) => byId.get(id)!);
  ensureUnique(items);
  return writePackAt(body, { ...pack, items }, groupId);
}

export function addPackGroup(body: PackBody, id: string, pack: SpritePackValue): PackBody {
  if (body.groups?.[id]) throw new Error(`pack group "${id}" already exists`);
  ensureUnique(pack.items);
  return { ...body, groups: { ...(body.groups ?? {}), [id]: structuredClone(pack) } };
}

export function renamePackGroup(body: PackBody, id: string, newId: string): PackBody {
  const current = body.groups?.[id];
  if (!current) throw new Error(`pack group "${id}" does not exist`);
  if (body.groups?.[newId]) throw new Error(`pack group "${newId}" already exists`);
  const groups = { ...body.groups };
  delete groups[id];
  groups[newId] = current;
  return { ...body, groups };
}

export function removePackGroup(body: PackBody, id: string): PackBody {
  if (!body.groups?.[id]) throw new Error(`pack group "${id}" does not exist`);
  const groups = { ...body.groups };
  delete groups[id];
  return { ...body, groups: Object.keys(groups).length ? groups : undefined };
}
