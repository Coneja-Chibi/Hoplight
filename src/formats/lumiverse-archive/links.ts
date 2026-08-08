/**
 * Cross-references (spec Behavior step 6). Lumiverse links rows by its own primary keys
 * (`world_book_id`, `character_id`, `preset_id`, `attached_world_book_id`, ...); Hoplight assigns
 * fresh ids on import, so every dispatched row has to be remembered under the Lumiverse id it
 * arrived with before the rows that reference it are read. A link map is exactly that memory: one
 * entry per (table, Lumiverse id) recorded as each row imports, resolved once the referencing row
 * is reached.
 *
 * A link whose target was never recorded (the target table was skipped, the target row failed, or
 * the id is simply wrong) resolves to nothing rather than failing the referencing row, per spec
 * edge case 8 and Behavior step 6: it is reported by name on both sides so the user can see exactly
 * which link went missing.
 */
import { recordUnresolvedLink, type LvbakImportReport } from "./report";

export interface RecordedLink {
  id: string;
  name: string;
}

export interface LinkMap {
  /** Remember one imported entity under the Lumiverse id of the row it came from. */
  record(table: string, lumiverseId: string, entity: RecordedLink): void;
  /**
   * Resolve one cross-reference. `from` names the referencing row (the caller's own
   * `table/rowId(name)`, since only the caller knows which row is doing the referencing);
   * `toTable`/`toId` name the Lumiverse row being pointed at. A miss is recorded on `report` and
   * returns null rather than throwing.
   */
  resolve(from: string, toTable: string, toId: string, report: LvbakImportReport): RecordedLink | null;
}

export function createLinkMap(): LinkMap {
  const byTable = new Map<string, Map<string, RecordedLink>>();

  return {
    record(table, lumiverseId, entity) {
      let forTable = byTable.get(table);
      if (!forTable) {
        forTable = new Map();
        byTable.set(table, forTable);
      }
      forTable.set(lumiverseId, entity);
    },
    resolve(from, toTable, toId, report) {
      const found = byTable.get(toTable)?.get(toId);
      if (found) return found;
      recordUnresolvedLink(report, {
        from,
        to: `${toTable}/${toId}`,
        reason: "the referenced row was skipped, failed, or never existed",
      });
      return null;
    },
  };
}

export interface IdMint {
  /**
   * `canonicalId(name)` is deterministic and every kind module dispatches through it independently,
   * so two same-kind entities that happen to share a name (two characters both named "Aria", an
   * embedded character_book and a standalone lorebook both named the same thing) would otherwise
   * mint the SAME id, and the link map would resolve every future reference to whichever one
   * recorded last. Call this once per entity right after dispatch, before escrow/link.record/
   * recordImported, so the id every downstream step sees is already unique.
   *
   * Uniqueness is scoped per kind (a character and a persona sharing an id is harmless: the studio's
   * own storage path is keyed by kind, src/studio/store.ts's resolveStudioPath), never globally.
   */
  claim(kind: string, candidate: string): string;
}

/**
 * Same suffixing convention as the studio's own keep-both path (src/studio/store.ts ~line 288):
 * `-2`, `-3`, ... skipping any suffix already claimed, so a THIRD collision does not overwrite a
 * second one that mutated the id first.
 */
export function createIdMint(): IdMint {
  const usedByKind = new Map<string, Set<string>>();
  return {
    claim(kind, candidate) {
      let used = usedByKind.get(kind);
      if (!used) {
        used = new Set();
        usedByKind.set(kind, used);
      }
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
      let n = 2;
      let next = `${candidate}-${n}`;
      while (used.has(next)) {
        n += 1;
        next = `${candidate}-${n}`;
      }
      used.add(next);
      return next;
    },
  };
}
