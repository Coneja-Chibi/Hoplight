/**
 * The collections routes: somebody's own groupings of pieces.
 *
 * A separate module for the same two reasons the agent routes are: server.ts has a line cap, and a
 * surface that WRITES to the studio folder is easier to audit adjacent to itself.
 *
 * ONE BOUNDARY, ONE PARSE. Every request body is turned into a known edit here and nowhere else;
 * past that point the pure core in collections-shape.ts decides what the edit means. The route knows
 * about HTTP and nothing about what a collection may be.
 *
 * Returns null for anything that is not ours, so the caller's table keeps its shape.
 */
import { CollectionsStore } from "../studio/collections";
import { applyCollectionEdit } from "../studio/collections-shape";
import { parseCollectionEdit } from "./collection-edit";
import { contentTypeIs, err, json, readJsonCapped } from "./server-security";

/** A grouping is a list of short ids; nothing here is user prose of any size. */
const BODY_MAX = 64 * 1024;

export { parseCollectionEdit as parseEdit } from "./collection-edit";

export async function handleCollectionsRoutes(
  path: string,
  req: Request,
  studioDir: () => string,
): Promise<Response | null> {
  if (path !== "/api/collections") return null;

  const store = new CollectionsStore(studioDir());

  if (req.method === "GET" || req.method === "HEAD") return json(await store.read());
  if (req.method !== "POST") return err("method not allowed", 405);
  if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);

  const body = await readJsonCapped(req, BODY_MAX);
  if (!body.ok) return body.response;
  const parsed = parseCollectionEdit(body.value);
  if (!parsed.ok) return json({ error: parsed.why }, 400);

  return json(await store.edit((current) => applyCollectionEdit(current, parsed.edit)));
}
