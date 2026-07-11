/**
 * Library import flow: staged pick (check/uncheck, select all) + plain-words receipts.
 * Lorebooks get a heal summary when the payload is soft-healed before commit.
 */
import { useEffect, useState, type JSX } from "react";
import type { InspectResult } from "../../app-contract";
import { healBook } from "../../../core/lore";

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

export function pickFiles(onFiles: (files: File[]) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.addEventListener("change", () => onFiles([...(input.files ?? [])]));
  input.click();
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Attach heal notes onto original.vaud-studio.unmapped.healNotes for Health on first open. */
function withHealNotes(entity: unknown, notes: { path: string; message: string }[]): unknown {
  if (!isRec(entity) || notes.length === 0) return entity;
  const original = isRec(entity.original) ? { ...entity.original } : {};
  const studio = isRec(original["vaud-studio"])
    ? { ...(original["vaud-studio"] as Record<string, unknown>) }
    : {};
  const unmapped = isRec(studio.unmapped)
    ? { ...(studio.unmapped as Record<string, unknown>) }
    : {};
  unmapped.healNotes = notes;
  studio.unmapped = unmapped;
  original["vaud-studio"] = studio;
  return { ...entity, original };
}

/** Annotate a successful inspect with heal notes when the entity is a lorebook. */
export function annotateRead(filename: string, result: InspectResult): ReadFile {
  if (!result.ok || !result.entity) return { filename, result };
  const entity = result.entity as { kind?: string; body?: unknown; original?: unknown };
  if (entity.kind !== "lorebook") {
    // related lorebooks on a character bundle
    const related = result.related?.lorebooks;
    if (Array.isArray(related) && related.length > 0) {
      const notes: string[] = [];
      let entries = 0;
      const healedRelated = related.map((lb) => {
        const h = healBook((lb as { body?: unknown }).body ?? lb);
        notes.push(...h.healed.map((n) => n.message));
        entries += h.book.entries.length;
        return withHealNotes(lb, h.healed);
      });
      return {
        filename,
        result: {
          ...result,
          related: { lorebooks: healedRelated },
        },
        healNotes: notes.length ? notes : undefined,
        entryCount: entries || undefined,
      };
    }
    return { filename, result };
  }
  const h = healBook(entity.body);
  const patched = withHealNotes(
    { ...entity, body: h.book },
    h.healed,
  );
  return {
    filename,
    result: { ...result, entity: patched },
    healNotes: h.healed.map((n) => n.message),
    entryCount: h.book.entries.length,
  };
}
