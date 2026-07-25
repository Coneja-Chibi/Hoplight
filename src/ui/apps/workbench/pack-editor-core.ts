/**
 * Pack editor document projection. Retains named groups and source escrow even though the current
 * visible editor only mutates the default pack.
 */
import { normalizePack } from "../../../core/media";
import type { PackBody } from "../../../entities/pack/schema";

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export interface PackEditorDocument {
  body: PackBody;
  original: Record<string, unknown>;
}

export function packEditorDocument(entity: unknown): PackEditorDocument {
  const source = record(entity);
  const rawBody = record(source.body);
  const name = typeof rawBody.name === "string" && rawBody.name.trim()
    ? rawBody.name.trim()
    : "Untitled pack";
  const brief = typeof rawBody.brief === "string" ? rawBody.brief : "";
  const rawGroups = record(rawBody.groups);
  const groups = Object.fromEntries(
    Object.entries(rawGroups).map(([id, pack]) => [id, normalizePack(pack)]),
  );
  return {
    body: {
      name,
      ...(brief ? { brief } : {}),
      pack: normalizePack(rawBody.pack),
      ...(Object.keys(groups).length ? { groups } : {}),
    },
    original: structuredClone(record(source.original)),
  };
}
