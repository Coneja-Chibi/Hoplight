/**
 * Regex workshop dialog: split one set / merge two, via the shared TransferBench in an InkDialog.
 * Transcribed from lore-workshop-dialog.tsx (same dual-list interaction, same recovery-safe write
 * order: create the new set first, then update the source, so a failed second write deletes
 * nothing). Rules stand in for entries; the pure transforms live in regex-shelf-ops.ts.
 */
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import type { CanonicalRegexSet, RegexRule, RegexSetBody } from "../../../entities/regex/schema";
import { InkDialog } from "../../components/ink-dialog";
import { TransferBench, type TransferItem } from "../../components/transfer-bench";
import { mergeSets, splitSet, type RegexWorkshopState } from "./regex-shelf-ops";

export interface RegexWorkshopDialogProps {
  ctx: AppContext;
  state: RegexWorkshopState;
  onDone: () => void;
  onDismiss: () => void;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

async function loadBody(ctx: AppContext, s: StudioEntitySummary): Promise<RegexSetBody> {
  const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(s.id)}`);
  const e = isRec(raw) ? raw : {};
  const b = isRec(e.body) ? (e.body as unknown as RegexSetBody) : null;
  if (!b || !Array.isArray(b.rules)) {
    throw new Error("workshop: could not load regex set");
  }
  return structuredClone(b);
}

const itemOf = (r: RegexRule): TransferItem => ({
  id: r.id,
  label: r.label?.trim() || "(unnamed rule)",
  meta: r.enabled !== false ? "on" : "off",
});

function itemsFrom(body: RegexSetBody, ids: readonly string[]): TransferItem[] {
  const want = new Set(ids);
  return body.rules.filter((r) => want.has(r.id)).map(itemOf);
}

const allItems = (body: RegexSetBody): TransferItem[] => body.rules.map(itemOf);

export function RegexWorkshopDialog({
  ctx,
  state,
  onDone,
  onDismiss,
}: RegexWorkshopDialogProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceBody, setSourceBody] = useState<RegexSetBody | null>(null);
  const [otherBody, setOtherBody] = useState<RegexSetBody | null>(null);
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
          // Everything starts on the left; the user moves rules into the new set.
          setLeftIds(src.rules.map((r) => r.id));
          setRightIds([]);
          setName(`${src.name.trim() || "Set"} (split)`);
        } else {
          const other = state.other ? await loadBody(ctx, state.other) : null;
          if (cancelled) return;
          setOtherBody(other);
          setLeftIds(src.rules.map((r) => r.id));
          setRightIds(other ? other.rules.map((r) => r.id) : []);
          setName(
            [src.name, other?.name]
              .map((n) => (n ?? "").trim())
              .filter(Boolean)
              .join(" + ") || "Merged regex set",
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "failed to load sets");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, state]);

  const leftItems = useMemo(() => {
    if (!sourceBody) return [];
    if (state.mode === "merge") return allItems(sourceBody);
    return itemsFrom(sourceBody, leftIds);
  }, [sourceBody, leftIds, state.mode]);

  const rightItems = useMemo(() => {
    if (state.mode === "merge" && otherBody) return allItems(otherBody);
    if (!sourceBody) return [];
    return itemsFrom(sourceBody, rightIds);
  }, [sourceBody, otherBody, rightIds, state.mode]);

  const moveToRight = useCallback(
    (ids: readonly string[]) => {
      if (state.mode === "merge") return; // merge is whole-set, not rule transfer
      setLeftIds((L) => L.filter((id) => !ids.includes(id)));
      setRightIds((R) => [...R, ...ids.filter((id) => !R.includes(id))]);
    },
    [state.mode],
  );

  const moveToLeft = useCallback(
    (ids: readonly string[]) => {
      if (state.mode === "merge") return;
      setRightIds((R) => R.filter((id) => !ids.includes(id)));
      setLeftIds((L) => [...L, ...ids.filter((id) => !L.includes(id))]);
    },
    [state.mode],
  );

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
          setError("Move at least one rule into the new set.");
          setBusy(false);
          return;
        }
        const { remainder, split } = splitSet(sourceBody, rightIds, nm);
        // 1) create the new set first
        await ctx.api.saveEntity({
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "regex",
          id: "regex",
          body: split,
        } satisfies CanonicalRegexSet);
        // 2) update the source
        try {
          const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(state.source.id)}`);
          const original =
            isRec(raw) && isRec(raw.original) ? (raw.original as CanonicalRegexSet["original"]) : {};
          await ctx.api.saveEntity(
            {
              schemaVersion: CANONICAL_SCHEMA_VERSION,
              kind: "regex",
              id: state.source.id,
              body: remainder,
              original,
            } satisfies CanonicalRegexSet,
            { overwrite: true },
          );
        } catch (e) {
          setError(
            `New set was created, but updating the original failed: ${
              e instanceof Error ? e.message : String(e)
            }. Nothing was deleted.`,
          );
          setBusy(false);
          return;
        }
        ctx.setStatus(`split into "${nm}"`);
      } else {
        if (!otherBody || !state.other) {
          setError("Pick a second set to merge.");
          setBusy(false);
          return;
        }
        const merged = mergeSets(sourceBody, otherBody, nm);
        await ctx.api.saveEntity({
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "regex",
          id: "regex",
          body: merged,
        } satisfies CanonicalRegexSet);
        ctx.setStatus(`merged into "${nm}" (originals kept)`);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "apply failed");
    } finally {
      setBusy(false);
    }
  }, [sourceBody, otherBody, busy, name, state, rightIds, ctx, onDone]);

  const note =
    state.mode === "split"
      ? "Create the new set first, then update this one. If the second save fails, the new set stays and nothing is deleted."
      : "Creates a third set with both rule lists. The two originals stay on the shelf.";

  return (
    <InkDialog
      onDismiss={onDismiss}
      ariaLabel={state.mode === "split" ? "Split regex set" : "Merge regex sets"}
    >
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
          rightTitle={state.mode === "split" ? "New set" : state.other?.name ?? "Other set"}
          left={leftItems}
          right={rightItems}
          name={name}
          namePlaceholder={
            state.mode === "split" ? "Name for the new set" : "Name for the merged set"
          }
          applyLabel={
            state.mode === "split" ? `Apply split (${rightIds.length})` : "Create merged set"
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
