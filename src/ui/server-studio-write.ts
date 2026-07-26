/**
 * Studio WRITE routes (save + delete), split from server.ts for the one-concept-per-file cap.
 * Both parse untrusted JSON once behind the shared caps and fold storage failures via studioErr.
 */
import type { CanonicalEntity } from "../core/canonical";
import type { StudioStoreLike } from "../studio/contracts";
import { contentTypeIs, err, json, readJsonCapped, studioErr } from "./server-security";

type AnyEntity = CanonicalEntity<string, unknown>;

export async function handleStudioSave(req: Request, store: StudioStoreLike): Promise<Response> {
  try {
    if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
    const parsed = await readJsonCapped(req);
    if (!parsed.ok) return parsed.response;
    const raw = parsed.value as
      | AnyEntity
      | { entity?: AnyEntity; overwrite?: boolean; expectedRevision?: unknown }
      | null;
    if (!raw || typeof raw !== "object") return err("expected a canonical entity");
    // Editor re-saves wrap { entity, overwrite: true }; import posts the entity bare (keep-both).
    const wrapped = "entity" in raw && raw.entity && typeof raw.entity === "object";
    const entity = (wrapped ? raw.entity : raw) as AnyEntity;
    const overwrite = wrapped ? raw.overwrite === true : false;
    if (typeof entity.kind !== "string") return err("expected a canonical entity");
    if (wrapped && "expectedRevision" in raw) {
      if (typeof raw.expectedRevision !== "string" || !/^[a-f0-9]{64}$/.test(raw.expectedRevision)) {
        return err("expected a valid revision");
      }
      const result = await store.compareAndSave(entity, raw.expectedRevision);
      if (result.status !== "saved") {
        return result.status === "stale"
          ? err("piece changed since it was opened", 409)
          : err("piece no longer exists", 404);
      }
      return json({ summary: result.summary, revision: result.revision });
    }
    return json(await store.save(entity, { overwrite }));
  } catch (e) {
    return studioErr(e);
  }
}

export async function handleStudioDelete(req: Request, store: StudioStoreLike): Promise<Response> {
  try {
    if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
    const parsed = await readJsonCapped(req);
    if (!parsed.ok) return parsed.response;
    const raw = parsed.value as { kind?: unknown; id?: unknown } | null;
    if (!raw || typeof raw.kind !== "string" || typeof raw.id !== "string") {
      return err("expected { kind, id }");
    }
    return json({ deleted: await store.delete(raw.kind, raw.id) });
  } catch (e) {
    return studioErr(e);
  }
}
