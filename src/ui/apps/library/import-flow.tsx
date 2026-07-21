/**
 * Library import flow: staged pick (check/uncheck, select all) + plain-words receipts.
 * Lorebooks get a heal summary when the payload is soft-healed before commit.
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext, InspectResult } from "../../app-contract";
import { bundlePayloadFromInspect } from "./deck-core";

export interface ReadFile {
  filename: string;
  result: InspectResult;
  /** Heal notes for lorebook payloads (empty when not a book or already clean). */
  healNotes?: string[];
  entryCount?: number;
}

export interface ImportState {
  phase: "reading" | "done";
  reads: ReadFile[];
}

function ReceiptCard({
  r,
  checked,
  onToggle,
}: {
  r: ReadFile;
  checked: boolean;
  onToggle: () => void;
}): JSX.Element {
  if (r.result.ok && r.result.receipt) {
    return (
      <label className="receipt" style={{ display: "block", cursor: "pointer" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
          <input type="checkbox" checked={checked} onChange={onToggle} />
          <div>
            <h3>{r.result.receipt.name}</h3>
            <p>{r.result.receipt.kindLine}</p>
            {typeof r.entryCount === "number" && (
              <p className="mono">
                {r.entryCount} entr{r.entryCount === 1 ? "y" : "ies"}
              </p>
            )}
            {r.healNotes && r.healNotes.length > 0 && (
              <p className="mono">
                Healed: {r.healNotes.slice(0, 3).join(" · ")}
                {r.healNotes.length > 3 ? ` · +${r.healNotes.length - 3} more` : ""}
              </p>
            )}
            {r.result.receipt.extras.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      </label>
    );
  }
  return (
    <div className="receipt bad">
      <h3>{r.filename}</h3>
      <p>{r.result.error ?? "We could not read this one."}</p>
    </div>
  );
}

export function ImportOverlay({
  state,
  onCommit,
  onCancel,
  onAddMore,
}: {
  state: ImportState;
  onCommit: (checkedIndexes: number[]) => void;
  onCancel: () => void;
  onAddMore?: () => void;
}): JSX.Element {
  const goodIndexes = state.reads
    .map((r, i) => (r.result.ok ? i : -1))
    .filter((i) => i >= 0);

  const [checked, setChecked] = useState<Set<number>>(() => new Set(goodIndexes));

  // When new reads arrive, select all good by default.
  useEffect(() => {
    setChecked(
      new Set(
        state.reads.map((r, i) => (r.result.ok ? i : -1)).filter((i) => i >= 0),
      ),
    );
  }, [state.reads]);

  if (state.phase === "reading") {
    return (
      <div className="overlay">
        <div className="sheet">
          <h2>Reading your files</h2>
        </div>
      </div>
    );
  }

  const selectedGood = goodIndexes.filter((i) => checked.has(i));

  return (
    <div className="overlay">
      <div className="sheet">
        <h2>
          {goodIndexes.length === state.reads.length
            ? "Pick what to keep."
            : "Here is what we read."}
        </h2>
        <p className="mono" style={{ marginBottom: "0.6rem" }}>
          Uncheck anything you do not want. Import only writes the checked ones.
        </p>
        {state.reads.map((r, i) => (
          <ReceiptCard
            key={i}
            r={r}
            checked={checked.has(i)}
            onToggle={() => {
              if (!r.result.ok) return;
              setChecked((prev) => {
                const next = new Set(prev);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              });
            }}
          />
        ))}
        <div className="actions">
          <button
            type="button"
            className="chipbtn stamp"
            onClick={() => setChecked(new Set(goodIndexes))}
          >
            Select all
          </button>
          {onAddMore && (
            <button type="button" className="chipbtn stamp" onClick={onAddMore}>
              Add more files
            </button>
          )}
          <button
            className="chipbtn primary stamp"
            disabled={selectedGood.length === 0}
            onClick={() => onCommit(selectedGood)}
          >
            {`Import ${selectedGood.length}`}
          </button>
          <button className="chipbtn stamp" onClick={onCancel}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The import runners, one pair per render: inspect every dropped file into receipt rows (a bad
 * file becomes a failed row, never a stuck overlay), then commit the checked ones as bundles.
 */
export function makeImportRunners(args: {
  ctx: AppContext;
  importState: ImportState | null;
  setImportState: (updater: ImportState | null | ((prev: ImportState | null) => ImportState | null)) => void;
  reload: () => void;
}): {
  runImport: (files: File[], append?: boolean) => void;
  commitImport: (checkedIndexes: number[]) => void;
} {
  const { ctx, importState, setImportState, reload } = args;

  const runImport = (files: File[], append = false): void => {
    void (async () => {
      setImportState((prev) =>
        append && prev?.phase === "done"
          ? { phase: "reading", reads: prev.reads }
          : { phase: "reading", reads: [] },
      );
      const prior = append && importState?.phase === "done" ? importState.reads : [];
      const read: ImportState["reads"] = [...prior];
      for (const file of files) {
        // Per-file guard, mirroring commitImport below: one oversized or corrupt file becomes a
        // failed receipt row. Unguarded, its rejection left the fullscreen "reading" overlay up
        // forever with no way out but a reload.
        try {
          const result = await ctx.api.inspectFile(file);
          read.push(annotateRead(file.name, result));
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          read.push(annotateRead(file.name, { ok: false, error }));
        }
      }
      setImportState({ phase: "done", reads: read });
    })();
  };

  const commitImport = (checkedIndexes: number[]): void => {
    if (!importState) return;
    void (async () => {
      const picked = checkedIndexes
        .map((i) => importState.reads[i])
        .filter((r): r is NonNullable<typeof r> => !!r && r.result.ok);
      const errors: string[] = [];
      for (const r of picked) {
        const payload = bundlePayloadFromInspect(r.result);
        if (!payload) continue;
        try {
          const result = await ctx.api.saveBundle(payload);
          if (!result.ok) {
            errors.push(`${r.filename}: ${result.error ?? "could not save"}`);
          }
        } catch (e) {
          errors.push(`${r.filename}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      setImportState(null);
      reload();
      if (errors.length > 0) {
        ctx.setStatus(errors.length === 1 ? errors[0]! : `${errors.length} files failed to save`);
      } else {
        ctx.setStatus(`imported ${picked.length} file${picked.length === 1 ? "" : "s"}`);
      }
    })();
  };

  return { runImport, commitImport };
}

export function pickFiles(onFiles: (files: File[]) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.addEventListener("change", () => onFiles([...(input.files ?? [])]));
  input.click();
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Annotate a successful inspect with an entry count. Every ok result here comes from a real format
 * adapter (server-engine handleInspect), so the body is already canonical and MUST pass through
 * untouched: healBook is a tolerant reader for foreign payloads that rebuilds by enumeration, and
 * running it on a canonical body silently reset every field outside its list (categories,
 * positions, selective logic, filters). Heal belongs to paths that ingest naked JSON, not this one.
 */
export function annotateRead(filename: string, result: InspectResult): ReadFile {
  if (!result.ok || !result.entity) return { filename, result };
  const entity = result.entity as { kind?: string; body?: unknown };
  const countOf = (v: unknown): number | undefined =>
    isRec(v) && Array.isArray(v.entries) ? v.entries.length : undefined;
  if (entity.kind !== "lorebook") {
    // related lorebooks on a character bundle
    const related = result.related?.lorebooks;
    if (Array.isArray(related) && related.length > 0) {
      const entries = related.reduce<number>(
        (n, lb) => n + (countOf(isRec(lb) ? lb.body : undefined) ?? 0),
        0,
      );
      return { filename, result, entryCount: entries || undefined };
    }
    return { filename, result };
  }
  return { filename, result, entryCount: countOf(entity.body) };
}
