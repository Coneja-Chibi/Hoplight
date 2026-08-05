/**
 * The persona slice (spec Behavior step 5, persona row; step 4 for the avatar; step 6 for the
 * attached-lorebook link; step 7 for isolation). A Lumiverse `personas` row is already close to the
 * account-object wire the Lumiverse persona codec parses (src/formats/lumiverse/persona.ts): it is
 * the same producer on both ends, so almost every column carries the same name onto the wire. This
 * module's job is the handful of real gaps (SQLite 0/1 ints where the API returns booleans, a
 * doubly-encoded metadata string where the API returns an object) plus the two references dispatch
 * alone cannot resolve: the attached lorebook and the avatar file.
 *
 * Both references get resolved AFTER dispatch, on `body` only, never on the escrow twins. The wire
 * (and therefore the codec's own `original["lumiverse-persona"]`) keeps the RAW Lumiverse id and the
 * RAW avatar path exactly as the row had them - that is what escrow is for. Only the canonical,
 * user-facing fields (`knowledgeRefs`, `presentation.imageUrl`) get rewritten to the resolved,
 * Hoplight-side values, or removed when resolution misses.
 */
import type { CanonicalPersona } from "../../entities/persona/schema";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import personaCodec from "../lumiverse/persona";
import type { Binaries } from "./binaries";
import { addArchiveEscrow } from "./escrow";
import type { IdMint, LinkMap } from "./links";
import { codecRowFailure, recordFailure, recordImported, type LvbakImportReport } from "./report";
import { isContainerAbort, type LvbakEntrySource } from "./source";
import { readTable, type ReadTableOptions, type TableRow } from "./table-walk";
import { asBool, rowId } from "./tables";

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
/** Same string-or-number tolerance as rowId, for a foreign key column rather than a row's own id. */
const asId = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/**
 * Build the Lumiverse account-object wire `lumiverse-persona` already parses. `metadata` is
 * substituted from `inner.values` (the second-parsed object), not `row` (still the doubly encoded
 * string): a real Lumiverse API object returns metadata as an object, and JSON_STRING_COLUMNS.
 * personas being ["metadata"] is exactly why the raw row cannot be handed to the codec directly.
 * `metadata` is never consumed by the codec's own field mapping though (only name, title,
 * description, the pronoun triplet, attached_world_book_id, and avatar_path are), so an absent or
 * unparseable metadata never affects what the wire needs to produce a valid persona; it only affects
 * how faithfully the codec's OWN escrow twin can round-trip metadata later.
 *
 * `is_narrator` / `is_default` are read by no field in the codec's toCanonical either (verified
 * against the codec source, not assumed): they ride the wire purely so the codec's own twin can
 * round-trip them through a future `fromCanonical`, coerced to booleans because that is what a real
 * Lumiverse API object returns, not the SQLite 0/1 the row carries.
 */
export function personaRowToWire(read: TableRow): Record<string, unknown> {
  const row = read.row;
  return {
    id: row.id,
    name: asString(row.name),
    title: row.title,
    description: asString(row.description),
    subjective_pronoun: asString(row.subjective_pronoun),
    objective_pronoun: asString(row.objective_pronoun),
    possessive_pronoun: row.possessive_pronoun,
    is_narrator: asBool(row.is_narrator),
    is_default: asBool(row.is_default),
    avatar_path: row.avatar_path,
    attached_world_book_id: row.attached_world_book_id,
    folder: row.folder,
    metadata: read.inner.values.metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * The codec sets `body.knowledgeRefs = [rawLumiverseId]` whenever the row named a book (step 6 has
 * not happened yet at dispatch time, so it cannot do better). This resolves that raw id through the
 * link map and overwrites the reference with the actually-imported book's id, or drops it entirely
 * when the target was never imported: a dangling reference to an id that exists nowhere in Hoplight
 * would be strictly worse than no reference at all, and resolve() already recorded why.
 */
function resolveKnowledgeRef(
  entity: CanonicalPersona,
  row: Record<string, unknown>,
  links: LinkMap,
  report: LvbakImportReport,
): void {
  const lumiverseBookId = asId(row.attached_world_book_id);
  if (!lumiverseBookId) return; // nothing was attached; the codec never set knowledgeRefs either
  const from = `personas/${rowId(row)}(${entity.body.name})`;
  const resolved = links.resolve(from, "world_books", lumiverseBookId, report);
  if (resolved) entity.body.knowledgeRefs = [resolved.id];
  else delete entity.body.knowledgeRefs;
}

/**
 * The codec sets `presentation.imageUrl` to the RAW `avatar_path` string, which is meaningless
 * outside the archive (Hoplight has no `files/avatars/` tree to resolve it against later). This
 * overwrites it with the resolved data: URI, or clears it when the file is absent; `binaries`
 * already recorded the miss, so this only tidies the body.
 */
async function resolveAvatar(
  entity: CanonicalPersona,
  row: Record<string, unknown>,
  binaries: Binaries,
): Promise<void> {
  const avatarPath = typeof row.avatar_path === "string" ? row.avatar_path : "";
  if (!avatarPath) return; // nothing was referenced; the codec never set presentation either
  const dataUri = await binaries.avatarDataUri(avatarPath);
  if (dataUri) {
    entity.body.presentation = { ...entity.body.presentation, imageUrl: dataUri };
    return;
  }
  if (!entity.body.presentation) return;
  delete entity.body.presentation.imageUrl;
  if (Object.keys(entity.body.presentation).length === 0) delete entity.body.presentation;
}

export interface ImportPersonasOptions {
  lineCeiling: number;
  report: LvbakImportReport;
  links: LinkMap;
  binaries: Binaries;
  /** Shared across every kind module in the run; see links.ts's IdMint doc comment. */
  idMint: IdMint;
}

/**
 * Import every persona: dispatch the synthesized wire to the existing Lumiverse persona codec,
 * resolve its attached lorebook and avatar against what has actually landed in Hoplight, escrow the
 * raw twin, and record the persona under its Lumiverse id (spec step 6: a regex row can scope to a
 * persona's world in a later slice the same way).
 *
 * personas.metadata (JSON_STRING_COLUMNS) is never gated on: nothing in the codec's field mapping
 * reads it, so a row whose metadata will not parse still imports cleanly, same policy as
 * world_books.metadata in the lorebook slice. A codec-level (or any other unexpected) throw during
 * synthesis/dispatch/resolution fails only that row: recorded via recordFailure, the stream continues.
 */
export async function importPersonas(
  source: LvbakEntrySource,
  options: ImportPersonasOptions,
): Promise<ParsedCanonicalEntity[]> {
  const { lineCeiling, report, links, binaries, idMint } = options;
  const opts: ReadTableOptions = {
    lineCeiling,
    onFailure: (failure) => recordFailure(report, failure),
  };

  const out: ParsedCanonicalEntity[] = [];
  for await (const read of readTable(source, "personas", opts)) {
    try {
      const wire = personaRowToWire(read);
      const entity: CanonicalPersona = personaCodec.toCanonical({ text: JSON.stringify(wire) });
      entity.id = idMint.claim("persona", entity.id);

      resolveKnowledgeRef(entity, read.row, links, report);
      await resolveAvatar(entity, read.row, binaries);

      const escrowed = addArchiveEscrow(entity, "personas", read.row);
      links.record("personas", rowId(read.row), { id: escrowed.id, name: escrowed.body.name });
      recordImported(report, "persona", { id: escrowed.id, name: escrowed.body.name });
      out.push(escrowed);
    } catch (error) {
      if (isContainerAbort(error)) throw error;
      recordFailure(report, codecRowFailure("personas", read.row, error));
    }
  }
  return out;
}
