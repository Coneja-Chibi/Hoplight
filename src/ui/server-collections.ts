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
import {
  applyCollectionEdit,
  type CollectionEdit,
  type PieceRef,
} from "../studio/collections-shape";
import { contentTypeIs, err, json, readJsonCapped } from "./server-security";

/** A grouping is a list of short ids; nothing here is user prose of any size. */
const BODY_MAX = 64 * 1024;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

const asRef = (v: unknown): PieceRef | null => {
  if (!isRecord(v)) return null;
  const kind = str(v["kind"]);
  const id = str(v["id"]);
  return kind && id ? { kind, id } : null;
};

/**
 * Parse a request body into an edit, or say why not.
 *
 * NAMES ARE BOUNDED. A collection name is a label in a picker, and an unbounded one is a way to
 * push megabytes into a file the studio reads on every listing.
 */
export function parseEdit(
  raw: unknown,
): { ok: true; edit: CollectionEdit } | { ok: false; why: string } {
  if (!isRecord(raw)) return { ok: false, why: "expected an object" };
  const action = str(raw["action"]);
  const name = str(raw["name"]);
  const id = str(raw["id"]);
  if (name !== null && name.length > 120) return { ok: false, why: "name is too long" };
  const note = str(raw["note"]);
  if (note !== null && note.length > 500) return { ok: false, why: "note is too long" };

  switch (action) {
    case "create":
      if (!name) return { ok: false, why: "create needs a name" };
      return { ok: true, edit: { action, name, ...(note ? { note } : {}) } };
    case "rename":
      if (!id) return { ok: false, why: "rename needs an id" };
      if (!name) return { ok: false, why: "rename needs a name" };
      return { ok: true, edit: { action, id, name } };
    case "delete":
      if (!id) return { ok: false, why: "delete needs an id" };
      return { ok: true, edit: { action, id } };
    case "add":
    case "remove": {
      if (!id) return { ok: false, why: `${action} needs an id` };
      const ref = asRef(raw["ref"]);
      if (!ref) return { ok: false, why: `${action} needs a ref with a kind and an id` };
      return { ok: true, edit: { action, id, ref } };
    }
    default:
      return { ok: false, why: "unknown action" };
  }
}

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
  const parsed = parseEdit(body.value);
  if (!parsed.ok) return json({ error: parsed.why }, 400);

  return json(await store.edit((current) => applyCollectionEdit(current, parsed.edit)));
}
