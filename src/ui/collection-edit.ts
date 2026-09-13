/** Parse the bounded HTTP-shaped collection edit shared by desktop and browser runtimes. */
import type { CollectionEdit, PieceRef } from "../studio/collections-shape";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

const asRef = (value: unknown): PieceRef | null => {
  if (!isRecord(value)) return null;
  const kind = stringValue(value.kind);
  const id = stringValue(value.id);
  return kind && id ? { kind, id } : null;
};

export function parseCollectionEdit(
  raw: unknown,
): { ok: true; edit: CollectionEdit } | { ok: false; why: string } {
  if (!isRecord(raw)) return { ok: false, why: "expected an object" };
  const action = stringValue(raw.action);
  const name = stringValue(raw.name);
  const id = stringValue(raw.id);
  if (name !== null && name.length > 120) return { ok: false, why: "name is too long" };
  const note = stringValue(raw.note);
  if (note !== null && note.length > 500) return { ok: false, why: "note is too long" };

  switch (action) {
    case "create":
      return name
        ? { ok: true, edit: { action, name, ...(note ? { note } : {}) } }
        : { ok: false, why: "create needs a name" };
    case "rename":
      if (!id) return { ok: false, why: "rename needs an id" };
      return name ? { ok: true, edit: { action, id, name } } : { ok: false, why: "rename needs a name" };
    case "delete":
      return id ? { ok: true, edit: { action, id } } : { ok: false, why: "delete needs an id" };
    case "add":
    case "remove": {
      if (!id) return { ok: false, why: `${action} needs an id` };
      const ref = asRef(raw.ref);
      return ref
        ? { ok: true, edit: { action, id, ref } }
        : { ok: false, why: `${action} needs a ref with a kind and an id` };
    }
    default:
      return { ok: false, why: "unknown action" };
  }
}
