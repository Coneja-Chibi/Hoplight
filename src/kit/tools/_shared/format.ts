/**
 * Formatting helpers shared by the read tools: turn engine objects into the text a model observes.
 * Output is always bounded, a tool must never hand the model an unbounded blob.
 */
import type { EntitySummary, KitEntity } from "../../bridge";

const BODY_CAP = 4000;

/** Best-effort display name for a full entity (identity.name, then body.name, then id). */
export const entityName = (entity: KitEntity): string => {
  const body = entity.body as Record<string, unknown> | undefined;
  const identity = body?.["identity"] as { name?: unknown } | undefined;
  if (typeof identity?.name === "string" && identity.name) return identity.name;
  if (typeof body?.["name"] === "string" && body["name"]) return body["name"] as string;
  return entity.id;
};

/** One list row: "kind/id  name  (source)". */
export const summaryLine = (summary: EntitySummary): string => {
  const source = summary.sourceFormat ? `  (${summary.sourceFormat})` : "";
  return `${summary.kind}/${summary.id}  ${summary.name}${source}`;
};

/** A bounded rendering of one entity for the model: heading plus a capped JSON body. */
export function renderEntity(entity: KitEntity): string {
  const heading = `${entityName(entity)}  (${entity.kind}/${entity.id})`;
  const bodyJson = JSON.stringify(entity.body ?? {}, null, 2);
  const body = bodyJson.length > BODY_CAP
    ? `${bodyJson.slice(0, BODY_CAP)}\n... (truncated at ${BODY_CAP} chars)`
    : bodyJson;
  return `${heading}\n\n${body}`;
}
