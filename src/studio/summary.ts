/**
 * What a shelf row says about a piece.
 *
 * A summary is not the piece: it is the handful of facts a list needs to draw a row and a person
 * needs to recognise their own work. Kept apart from the store so the rules for picking a display
 * name or an accent are read in one place rather than inline in a filesystem walk.
 */
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";

type AnyEntity = ParsedCanonicalEntity;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const HEX6 = /^#[0-9a-f]{6}$/i;

export function authoredSignature(entity: AnyEntity): string | undefined {
  const pres = (entity as {
    body?: { presentation?: { signatureColor?: unknown; gradientColors?: unknown } };
  }).body?.presentation;
  const solid = typeof pres?.signatureColor === "string" ? pres.signatureColor : undefined;
  const stops = pres?.gradientColors;
  const first = Array.isArray(stops) && typeof stops[0] === "string" ? stops[0] : undefined;
  const hex = solid || first;
  return hex && HEX6.test(hex) ? hex : undefined;
}

export function sourceOf(entity: AnyEntity): { format?: string; variant?: string } {
  for (const [formatId, entry] of Object.entries(entity.original ?? {})) {
    if (formatId === "vaud-studio") continue;
    const variant = entry?.unmapped?.["variant"];
    return { format: formatId, variant: typeof variant === "string" ? variant : undefined };
  }
  return {};
}

/** The display name for a piece: identity.name, then body.name, then its id. One rule, so a piece is
 *  called the same thing on the shelf and everywhere that names one before it is stored. */
export function entityName(entity: AnyEntity): string {
  const body = isRecord(entity.body) ? entity.body : undefined;
  if (!body) return entity.id;
  const identity = body.identity as { name?: string } | undefined;
  if (typeof identity?.name === "string" && identity.name) return identity.name;
  if (typeof body.name === "string" && body.name) return body.name;
  return entity.id;
}
