/**
 * Reading one stored file into a canonical entity.
 *
 * The whole read-from-disk boundary lives here: the migrations a real studio's files need, the
 * decode, and the language a failure is reported in. Kept apart from the store because it is the
 * one place that is allowed to be tolerant, and it should be obvious where that permission ends.
 */
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../entities/runtime-schema";
import { StudioReadError } from "./errors";

type AnyEntity = ParsedCanonicalEntity;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/**
 * Bring a stored entity up to the current shape before it is decoded.
 *
 * TOLERATE ON READ, STAY STRICT ON WRITE. This runs only here, at the read-from-disk boundary, and
 * deliberately NOT inside parseCanonicalEntity: that function is also called on the WRITE path by
 * the converters and the capability preview, where a codec emitting the wrong shape is a bug in
 * Hoplight and must still fail. Loosening it there would hide our own defects to be kind to a file.
 *
 * Every rule here answers real data found on disk. A file that only ever loaded on an older build
 * is still the user's work, and refusing it outright is what turned four perfectly readable regex
 * sets into "corrupt entity file" with nothing else to go on.
 */
export function migrateStoredEntity(raw: Record<string, unknown>): Record<string, unknown> {
  const { escrow: legacy, ...rest } = raw;
  const out: Record<string, unknown> =
    legacy !== undefined && raw["original"] === undefined ? { ...rest, original: legacy } : rest;

  // schemaVersion has been the STRING "1" since the first commit, but files exist carrying the
  // number 1. Nothing about the entity differs; only the JSON type of one field does.
  if (typeof out["schemaVersion"] === "number") out["schemaVersion"] = String(out["schemaVersion"]);
  return out;
}

/** Name the field that actually failed. "corrupt entity file" alone leaves a user nothing to act on. */
function describeSchemaMismatch(error: unknown): string {
  const issues = (error as { issues?: { path?: unknown[]; message?: string }[] }).issues;
  const first = issues?.[0];
  if (!first) return "corrupt entity file";
  const where = Array.isArray(first.path) && first.path.length > 0 ? first.path.join(".") : "the entity";
  const more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : "";
  return `corrupt entity file: ${where} ${first.message ?? "did not match the expected shape"}${more}`;
}

/**
 * Is this file one of ours, apart from what it is called?
 *
 * Asked only about a file whose NAME cannot be a studio id, to decide whether "rename it" is real
 * advice or a wild goose chase. A canonical character called `ludovic-&-levi.json` is 2.4MB of
 * somebody's work that loads the moment it is renamed; a SillyTavern fragment called
 * `Loggo's Preset.json` does not, and sending its owner to rename it wastes their time and returns
 * them to the same list. Both used to report identically.
 *
 * The stored id is deliberately NOT compared: it cannot match a filename that was already rejected,
 * and the question here is about the contents rather than the label.
 *
 * TOTAL, and it has to be - this runs while building an inventory that must survive every file in a
 * folder somebody dragged things into.
 */
export function looksCanonical(text: string, kind: string): boolean {
  try {
    const raw = JSON.parse(text) as unknown;
    if (!isRecord(raw)) return false;
    return parseCanonicalEntity(migrateStoredEntity(raw)).kind === kind;
  } catch {
    return false;
  }
}

export function parseStoredEntity(
  text: string,
  kind: string,
  id: string,
): AnyEntity {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new StudioReadError("corrupt entity file", "unreadable-json");
  }
  if (!isRecord(raw)) throw new StudioReadError("corrupt entity file", "schema-mismatch");
  let parsed: AnyEntity;
  try {
    parsed = parseCanonicalEntity(migrateStoredEntity(raw));
  } catch (error) {
    throw new StudioReadError(describeSchemaMismatch(error), "schema-mismatch");
  }
  if (parsed.kind !== kind) throw new StudioReadError("corrupt entity file", "kind-mismatch");
  if (parsed.id !== id) throw new StudioReadError("corrupt entity file", "id-mismatch");
  return parsed;
}
