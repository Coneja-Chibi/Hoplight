/**
 * Lore shelf side-effects: meta load (enabled, counts, search keys) + enable/duplicate.
 * Pure-ish loaders; save stays at the imperative edge.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import { duplicateBook } from "../../../core/lore";
import type { CanonicalLorebook, LorebookBody } from "../../../entities/lorebook/schema";
import type { DeckViewContext } from "./view-contract";
import type { LoreWorkshopState } from "./lore-workshop-dialog";

export type LoreMeta = {
  enabled: boolean;
  entryCount: number;
  searchKeys: string[];
};

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export async function loadLoreMeta(
  ctx: AppContext,
  list: readonly StudioEntitySummary[],
): Promise<Record<string, LoreMeta>> {
  const books = list.filter((e) => e.kind === "lorebook");
  const next: Record<string, LoreMeta> = {};
  for (const b of books) {
    try {
      const raw = await ctx.api.getEntity(
        `kind=lorebook&id=${encodeURIComponent(b.id)}`,
      );
      const body =
        isRec(raw) && isRec(raw.body) ? (raw.body as unknown as LorebookBody) : null;
      if (!body) continue;
      const searchKeys = (body.entries ?? []).flatMap((e) =>
        e.triggers.map((t) => t.keyword).filter(Boolean),
      );
      next[b.id] = {
        enabled: body.enabled !== false,
        entryCount: Array.isArray(body.entries) ? body.entries.length : 0,
        searchKeys,
      };
    } catch {
      /* skip unreadable */
    }
  }
  return next;
}

/**
 * Hang each lorebook's trigger keywords on its summary.
 *
 * THE RETURN TYPE USED TO ERASE THE FIELD IT EXISTS TO ADD: it widened back to
 * StudioEntitySummary[], so `searchKeys` was invisible to every caller and the shelf had to cast it
 * back in. Declaring it means the search core can read what a book is ABOUT (rarely what it is
 * named) without a cast, and a caller that forgets the field gets a compile error instead of
 * silently searching nothing.
 *
 * The kind guard stays: ids are unique per deck, not across the studio, so a character sharing an
 * id with a lorebook would otherwise inherit that book's keywords.
 */
export function attachSearchKeys(
  entities: readonly StudioEntitySummary[],
  loreMeta: Record<string, LoreMeta>,
): (StudioEntitySummary & { searchKeys?: string[] })[] {
  return entities.map((e) => {
    if (e.kind !== "lorebook") return e;
    const keys = loreMeta[e.id]?.searchKeys;
    return keys ? { ...e, searchKeys: keys } : e;
  });
}

export function makeLoreShelf(args: {
  ctx: AppContext;
  loreMeta: Record<string, LoreMeta>;
  setLoreMeta: (
    fn: (m: Record<string, LoreMeta>) => Record<string, LoreMeta>,
  ) => void;
  setWorkshop: (s: LoreWorkshopState) => void;
  reload: () => void;
}): NonNullable<DeckViewContext["loreShelf"]> {
  const { ctx, loreMeta, setLoreMeta, setWorkshop, reload } = args;
  return {
    enabledOf: (e) => loreMeta[e.id]?.enabled !== false,
    entryCountOf: (e) => loreMeta[e.id]?.entryCount,
    onToggleEnabled: (e, on) => {
      void (async () => {
        try {
          const raw = await ctx.api.getEntity(
            `kind=lorebook&id=${encodeURIComponent(e.id)}`,
          );
          if (!isRec(raw) || !isRec(raw.body)) return;
          const body = {
            ...(raw.body as unknown as LorebookBody),
            enabled: on,
          };
          await ctx.api.saveEntity(
            {
              schemaVersion: CANONICAL_SCHEMA_VERSION,
              kind: "lorebook",
              id: e.id,
              body,
              original: isRec(raw.original)
                ? (raw.original as CanonicalLorebook["original"])
                : {},
            } satisfies CanonicalLorebook,
            { overwrite: true },
          );
          setLoreMeta((m) => ({
            ...m,
            [e.id]: {
              enabled: on,
              entryCount: m[e.id]?.entryCount ?? body.entries?.length ?? 0,
              searchKeys: m[e.id]?.searchKeys ?? [],
            },
          }));
          ctx.setStatus(on ? `${e.name} is on` : `${e.name} is off (skipped on export)`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "toggle failed");
        }
      })();
    },
    onSplit: (e) => setWorkshop({ mode: "split", source: e }),
    onMerge: (into, from) => setWorkshop({ mode: "merge", source: into, other: from }),
    onDuplicate: (e) => {
      void (async () => {
        try {
          const raw = await ctx.api.getEntity(
            `kind=lorebook&id=${encodeURIComponent(e.id)}`,
          );
          if (!isRec(raw) || !isRec(raw.body)) return;
          const body = duplicateBook(
            raw.body as unknown as LorebookBody,
            `${e.name} (copy)`,
          );
          const saved = await ctx.api.saveEntity({
            schemaVersion: CANONICAL_SCHEMA_VERSION,
            kind: "lorebook",
            id: "lorebook",
            body,
          } satisfies CanonicalLorebook);
          reload();
          ctx.setStatus(`duplicated · ${saved.name || body.name}`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "duplicate failed");
        }
      })();
    },
  };
}
