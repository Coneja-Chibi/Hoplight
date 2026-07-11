/**
 * Lore workshop dialog: split/merge dual-list (vs-lore-workshop). Hosts TransferBench;
 * Apply is the only write. Create new book first, then update source (recovery-safe).
 */
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import {
  estimateEntryTokens,
  mergeBooks,
  splitBook,
} from "../../../core/lore";
import type {
  CanonicalLorebook,
  LorebookBody,
} from "../../../entities/lorebook/schema";
import { InkDialog } from "../../components/ink-dialog";
import { TransferBench, type TransferItem } from "../../components/transfer-bench";

export type WorkshopMode = "split" | "merge";

export interface LoreWorkshopState {
  mode: WorkshopMode;
  /** Source book (split remainder, or merge left). */
  source: StudioEntitySummary;
  /** Merge right book; absent in pure split. */
  other?: StudioEntitySummary;
  /** When bulk-move from binder, seed right list with these entry ids. */
  seedMovedIds?: readonly string[];
}

export interface LoreWorkshopDialogProps {
  ctx: AppContext;
  state: LoreWorkshopState;
  onDone: () => void;
  onDismiss: () => void;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

async function loadBody(ctx: AppContext, s: StudioEntitySummary): Promise<LorebookBody> {
  const raw = await ctx.api.getEntity(
    `kind=${encodeURIComponent(s.kind)}&id=${encodeURIComponent(s.id)}`,
  );
  const e = isRec(raw) ? raw : {};
  const b = isRec(e.body) ? (e.body as unknown as LorebookBody) : null;
  if (!b || !Array.isArray(b.entries)) {
    throw new Error("workshop: could not load lorebook body");
  }
  return structuredClone(b);
}

function itemsFrom(body: LorebookBody, ids: readonly string[]): TransferItem[] {
  const want = new Set(ids);
  return body.entries
    .filter((e) => want.has(e.id))
    .map((e) => ({
      id: e.id,
      label: e.title || "(untitled)",
      meta: `~${estimateEntryTokens(e)}t`,
    }));
}

function allItems(body: LorebookBody): TransferItem[] {
  return body.entries.map((e) => ({
    id: e.id,
    label: e.title || "(untitled)",
    meta: `~${estimateEntryTokens(e)}t`,
  }));
}

export function LoreWorkshopDialog({
  ctx,
  state,
  onDone,
  onDismiss,
}: LoreWorkshopDialogProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceBody, setSourceBody] = useState<LorebookBody | null>(null);
  const [otherBody, setOtherBody] = useState<LorebookBody | null>(null);
  const [leftIds, setLeftIds] = useState<string[]>([]);
  const [rightIds, setRightIds] = useState<string[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const src = await loadBody(ctx, state.source);
        if (cancelled) return;
        setSourceBody(src);
        if (state.mode === "split") {
          const seed = new Set(state.seedMovedIds ?? []);
          const moved = src.entries.filter((e) => seed.has(e.id)).map((e) => e.id);
          const kept = src.entries.filter((e) => !seed.has(e.id)).map((e) => e.id);
          // If no seed, start with everything on the left (user moves into the new book).
          setLeftIds(moved.length > 0 ? kept : src.entries.map((e) => e.id));
          setRightIds(moved);
          setName(
            moved.length > 0
              ? `${src.name.trim() || "Book"} (split)`
              : `${src.name.trim() || "Book"} (split)`,
          );
        } else {
          const other = state.other
            ? await loadBody(ctx, state.other)
            : null;
          if (cancelled) return;
          setOtherBody(other);
          setLeftIds(src.entries.map((e) => e.id));
          setRightIds(other ? other.entries.map((e) => e.id) : []);
          setName(
            [src.name, other?.name]
              .map((n) => (n ?? "").trim())
              .filter(Boolean)
              .join(" + ") || "Merged lorebook",
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "failed to load books");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, state]);

  const leftItems = useMemo(() => {
    if (!sourceBody) return [];
    if (state.mode === "merge" && otherBody) {
      // Left = source entries only (merge uses both full books on Apply)
      return allItems(sourceBody);
    }
    return itemsFrom(sourceBody, leftIds);
  }, [sourceBody, otherBody, leftIds, state.mode]);

  const rightItems = useMemo(() => {
    if (state.mode === "merge" && otherBody) return allItems(otherBody);
    if (!sourceBody) return [];
    return itemsFrom(sourceBody, rightIds);
  }, [sourceBody, otherBody, rightIds, state.mode]);

  const moveToRight = useCallback((ids: readonly string[]) => {
    if (state.mode === "merge") return; // merge is whole-book, not entry transfer
    setLeftIds((L) => L.filter((id) => !ids.includes(id)));
    setRightIds((R) => [...R, ...ids.filter((id) => !R.includes(id))]);
  }, [state.mode]);

  const moveToLeft = useCallback((ids: readonly string[]) => {
    if (state.mode === "merge") return;
    setRightIds((R) => R.filter((id) => !ids.includes(id)));
    setLeftIds((L) => [...L, ...ids.filter((id) => !L.includes(id))]);
  }, [state.mode]);

  const reorderRight = useCallback((id: string, dir: -1 | 1) => {
    setRightIds((R) => {
      const at = R.indexOf(id);
      if (at < 0) return R;
      const to = at + dir;
      if (to < 0 || to >= R.length) return R;
      const next = [...R];
      const [row] = next.splice(at, 1);
      next.splice(to, 0, row!);
      return next;
    });
  }, []);

  const apply = useCallback(async () => {
    if (!sourceBody || busy) return;
    const nm = name.trim();
    if (!nm) return;
    setBusy(true);
    setError(null);
    try {
      if (state.mode === "split") {
        if (rightIds.length === 0) {
          setError("Move at least one entry into the new book.");
          setBusy(false);
          return;
        }
        const { remainder, split } = splitBook(sourceBody, rightIds, nm);
        // 1) create new book first
        await ctx.api.saveEntity({
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "lorebook",
          id: "lorebook",
          body: split,
        } satisfies CanonicalLorebook);
        // 2) update source
        try {
          const raw = await ctx.api.getEntity(
            `kind=lorebook&id=${encodeURIComponent(state.source.id)}`,
          );
          const original =
            isRec(raw) && isRec(raw.original)
              ? (raw.original as CanonicalLorebook["original"])
              : {};
          await ctx.api.saveEntity(
            {
              schemaVersion: CANONICAL_SCHEMA_VERSION,
              kind: "lorebook",
              id: state.source.id,
              body: remainder,
              original,
            } satisfies CanonicalLorebook,
            { overwrite: true },
          );
        } catch (e) {
          setError(
            `New book was created, but updating the original failed: ${
              e instanceof Error ? e.message : String(e)
            }. Nothing was deleted.`,
          );
          setBusy(false);
          return;
        }
        ctx.setStatus(`split into "${nm}"`);
      } else {
        if (!otherBody || !state.other) {
          setError("Pick a second book to merge.");
          setBusy(false);
          return;
        }
        const merged = mergeBooks(sourceBody, otherBody, nm);
        await ctx.api.saveEntity({
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "lorebook",
          id: "lorebook",
          body: merged,
        } satisfies CanonicalLorebook);
        ctx.setStatus(`merged into "${nm}" (originals kept)`);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "apply failed");
    } finally {
      setBusy(false);
    }
  }, [
    sourceBody,
    otherBody,
    busy,
    name,
    state,
    rightIds,
    ctx,
    onDone,
  ]);

  const note =
    state.mode === "split"
      ? "Create the new book first, then update this one. If the second save fails, the new book stays and nothing is deleted."
      : "Creates a third book with both entry sets. The two originals stay on the shelf.";

  return (
    <InkDialog onDismiss={onDismiss} ariaLabel={state.mode === "split" ? "Split lorebook" : "Merge lorebooks"}>
      {error && !sourceBody ? (
        <div style={{ padding: "1rem" }}>
          <p>{error}</p>
          <button type="button" onClick={onDismiss}>
            Close
          </button>
        </div>
      ) : (
        <TransferBench
          leftTitle={state.mode === "split" ? "Stays here" : state.source.name}
          rightTitle={
            state.mode === "split"
              ? "New book"
              : state.other?.name ?? "Other book"
          }
          left={leftItems}
          right={rightItems}
          name={name}
          namePlaceholder={
            state.mode === "split" ? "Name for the new book" : "Name for the merged book"
          }
          applyLabel={
            state.mode === "split"
              ? `Apply split (${rightIds.length})`
              : "Create merged book"
          }
          requireMoved={state.mode === "split"}
          onName={setName}
          onMoveToRight={moveToRight}
          onMoveToLeft={moveToLeft}
          onReorderRight={state.mode === "split" ? reorderRight : undefined}
          onApply={() => void apply()}
          onCancel={onDismiss}
          busy={busy}
          note={error ? `${note} ${error}` : note}
        />
      )}
    </InkDialog>
  );
}
