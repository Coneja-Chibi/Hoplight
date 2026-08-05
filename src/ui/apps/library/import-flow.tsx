/**
 * Library import flow: triage (folder drops carry chats/settings/themes we never POST), a small
 * parallel inspect pool with live progress and a real Cancel, duplicate marking (against the shelf
 * by kind+name, within the drop by content), staged pick with plain-words receipts, and grouped
 * skip rows so 1,800 chat logs read as one honest line instead of a wall of red.
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { InkDialog } from "../../components/ink-dialog";
import { bundlePayloadFromInspect } from "./deck-core";
import {
  annotateRead,
  contentKey,
  defaultCheckedIndexes,
  groupBadRows,
  groupReportFailures,
  markDupes,
  shelfKey,
  summarizeImportedTotals,
  summarizeSkippedTables,
  triageFiles,
  withArchiveLinkCaveat,
  type ArchiveReportEntry,
  type BadGroup,
  type ReadFile,
} from "./import-triage";

export type { ArchiveReportEntry, ReadFile } from "./import-triage";

export type ImportState =
  | { phase: "reading"; reads: ReadFile[]; done: number; total: number; archiveReports: ArchiveReportEntry[] }
  | { phase: "done"; reads: ReadFile[]; archiveReports: ArchiveReportEntry[] }
  | { phase: "saving"; done: number; total: number };

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
    if (r.batchDupe) {
      return (
        <div className="improw dupe">
          <div className="impbody">
            <b className="impname">{r.result.receipt.name}</b>
            <p className="impmeta">Identical to {r.batchDupe} in this drop. We keep one.</p>
          </div>
        </div>
      );
    }
    return (
      <label className={`improw${checked ? " on" : ""}`}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="impcheck" aria-hidden="true" />
        <div className="impbody">
          <b className="impname">{r.result.receipt.name}</b>
          <p className="impkind">{r.result.receipt.kindLine}</p>
          {r.shelfDupe && (
            <p className="impmeta">Already on your shelf as {r.shelfDupe}. Importing keeps both.</p>
          )}
          {typeof r.entryCount === "number" && (
            <p className="impmeta">
              {r.entryCount} entr{r.entryCount === 1 ? "y" : "ies"}
            </p>
          )}
          {r.healNotes && r.healNotes.length > 0 && (
            <p className="impmeta">
              Healed: {r.healNotes.slice(0, 3).join(" · ")}
              {r.healNotes.length > 3 ? ` · +${r.healNotes.length - 3} more` : ""}
            </p>
          )}
          {r.result.receipt.extras.map((line, i) => (
            <p key={i} className="impkind">
              {line}
            </p>
          ))}
        </div>
      </label>
    );
  }
  return (
    <div className="improw bad">
      <div className="impbody">
        <span className="impflag">Could not read</span>
        <b className="impname">{r.filename}</b>
        <p className="imperr">{r.result.error ?? "We could not read this one."}</p>
      </div>
    </div>
  );
}

function BadGroupCard({ group }: { group: BadGroup }): JSX.Element {
  const sample = group.filenames.slice(0, 3).join(" · ");
  return (
    <div className="improw bad">
      <div className="impbody">
        <span className="impflag">Skipped</span>
        <b className="impname">
          {group.filenames.length} file{group.filenames.length === 1 ? "" : "s"}
        </b>
        <p className="imperr">{group.error}</p>
        <p className="impmeta">
          {sample}
          {group.filenames.length > 3 ? ` · +${group.filenames.length - 3} more` : ""}
        </p>
      </div>
    </div>
  );
}

/** One archive's own report: totals, honesty lines for what never came along, and its per-row
 *  failures collapsed the same way BadGroupCard collapses a mass file refusal. Never a bare shell -
 *  a zero-row archive still gets its totals line ("Nothing importable was found in this backup."). */
function ArchiveReportCard({ entry }: { entry: ArchiveReportEntry }): JSX.Element {
  const { filename, report } = entry;
  const totals = summarizeImportedTotals(report.imported) || "Nothing importable was found in this backup.";
  const skipped = summarizeSkippedTables(report.skippedTables);
  const failGroups = groupReportFailures(report.failed);
  return (
    <div className="impreport">
      <b className="impname">Backup report: {filename}</b>
      <p className="impkind">{totals}</p>
      {skipped && <p className="impmeta">{skipped}</p>}
      {report.missingBinaries.length > 0 && (
        <p className="impmeta">
          {report.missingBinaries.length} referenced file{report.missingBinaries.length === 1 ? "" : "s"} (avatars,
          images) could not be found.
        </p>
      )}
      {report.unresolvedLinks.length > 0 && (
        <p className="impmeta">
          {report.unresolvedLinks.length} cross-reference{report.unresolvedLinks.length === 1 ? "" : "s"} pointed at
          something that was never imported.
        </p>
      )}
      {report.warnings.map((w, i) => (
        <p key={i} className="impmeta">
          {w}
        </p>
      ))}
      {failGroups.length > 0 && (
        <ul>
          {failGroups.map((g, i) => (
            <li key={i}>
              {g.filenames.length >= 4
                ? `${g.filenames.length} rows: ${g.error} (${g.filenames.slice(0, 3).join(" · ")} · +${g.filenames.length - 3} more)`
                : `${g.filenames.join(", ")}: ${g.error}`}
            </li>
          ))}
        </ul>
      )}
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
  // Null until the read pass lands; the reading pool mutates ONE reads array for speed, so the
  // reset below keys on this became-non-null transition, never on array identity alone.
  const doneReads = state.phase === "done" ? state.reads : null;
  const checkable = defaultCheckedIndexes(doneReads ?? []);
  const [checked, setChecked] = useState<Set<number>>(() => new Set(checkable));

  // Reset to the honest default (readable, not a duplicate) when the receipts arrive.
  useEffect(() => {
    if (doneReads) setChecked(new Set(defaultCheckedIndexes(doneReads)));
  }, [doneReads]);

  if (state.phase === "reading" || state.phase === "saving") {
    const bad = state.phase === "reading" ? state.reads.filter((r) => !r.result.ok).length : 0;
    const pct = state.total === 0 ? 0 : Math.round((state.done / state.total) * 100);
    const line =
      state.phase === "saving"
        ? `Shelving ${Math.min(state.done + 1, state.total)} of ${state.total}…`
        : state.total === 0
          ? "Sorting the drop…"
          : `Read ${state.done} of ${state.total}${bad > 0 ? ` · ${bad} could not be read` : ""}`;
    return (
      <InkDialog
        // dismissal mid-save would orphan the run's feedback while writes continue; sit tight
        onDismiss={state.phase === "saving" ? () => {} : onCancel}
        ariaLabel={state.phase === "saving" ? "Shelving your pieces" : "Reading your files"}
        sheetClassName="impsheet"
      >
        <p className="impkick">The Library · Import</p>
        <b className="imptitle">{state.phase === "saving" ? "Shelving…" : "Reading your files…"}</b>
        <span className="impbar" role="progressbar" aria-valuemin={0} aria-valuemax={state.total} aria-valuenow={state.done}>
          <i style={{ width: `${pct}%` }} />
        </span>
        <p className="impprog" role="status">
          {line}
        </p>
        {state.phase === "reading" && (
          <div className="impacts">
            <button type="button" className="impbtn stamp" onClick={onCancel}>
              Cancel
            </button>
          </div>
        )}
      </InkDialog>
    );
  }

  // Row order: readable pieces (dupes-of-shelf among them), identical copies, grouped refusals.
  const okRows = state.reads.map((r, i) => ({ r, i })).filter(({ r }) => r.result.ok && !r.batchDupe);
  const dupeRows = state.reads.map((r, i) => ({ r, i })).filter(({ r }) => r.result.ok && !!r.batchDupe);
  const badGroups = groupBadRows(state.reads);
  const badCount = badGroups.reduce((n, g) => n + g.filenames.length, 0);
  const selectedGood = checkable.filter((i) => checked.has(i));
  const shelfDupes = okRows.filter(({ r }) => r.shelfDupe).length;

  const summary = [
    `${okRows.length} readable`,
    ...(shelfDupes > 0 ? [`${shelfDupes} already on your shelf`] : []),
    ...(dupeRows.length > 0 ? [`${dupeRows.length} identical cop${dupeRows.length === 1 ? "y" : "ies"}`] : []),
    ...(badCount > 0 ? [`${badCount} skipped`] : []),
  ].join(" · ");

  const toggle = (i: number): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Pick what to import" sheetClassName="impsheet">
      <p className="impkick">The Library · Import</p>
      <b className="imptitle">
        {badCount === 0 && dupeRows.length === 0 ? "Pick what to keep." : "Here is what we read."}
      </b>
      <p className="impsub">
        {summary}. Uncheck anything you do not want. Import only writes the checked ones.
      </p>
      <div className="improws">
        {state.archiveReports.map((entry, i) => (
          <ArchiveReportCard key={`report${i}`} entry={entry} />
        ))}
        {okRows.map(({ r, i }) => (
          <ReceiptCard
            key={i}
            r={r}
            checked={checked.has(i)}
            onToggle={() => {
              if (!r.result.ok || r.batchDupe) return;
              toggle(i);
            }}
          />
        ))}
        {dupeRows.map(({ r, i }) => (
          <ReceiptCard key={i} r={r} checked={false} onToggle={() => {}} />
        ))}
        {badGroups.map((g, gi) =>
          g.filenames.length >= 4 ? (
            <BadGroupCard key={`g${gi}`} group={g} />
          ) : (
            g.indexes.map((i) => (
              <ReceiptCard key={i} r={state.reads[i]!} checked={false} onToggle={() => {}} />
            ))
          ),
        )}
      </div>
      <div className="impacts">
        <button type="button" className="impbtn stamp" onClick={() => setChecked(new Set(checkable))}>
          Select all
        </button>
        {onAddMore && (
          <button type="button" className="impbtn stamp" onClick={onAddMore}>
            Add more files
          </button>
        )}
        <button
          type="button"
          className="impbtn primary stamp"
          disabled={selectedGood.length === 0}
          onClick={() => onCommit(selectedGood)}
        >
          {`Import ${selectedGood.length}`}
        </button>
        <button type="button" className="impbtn stamp" onClick={onCancel}>
          Not now
        </button>
      </div>
    </InkDialog>
  );
}

// One import flow runs at a time (the sheet is modal); Cancel and a new drop both abort the
// previous pool so a stale worker can never resurrect the overlay after dismissal.
let activeAbort: AbortController | null = null;

const INSPECT_POOL = 3;
// Archives are rare per drop (usually zero or one) and each upload already competes for the same
// bandwidth/disk I/O a second concurrent one would, so this stays sequential rather than pooled -
// a future bump to 2+ is a one-constant change, not a structural one.
const ARCHIVE_POOL = 1;

/**
 * The import runners, one trio per render: triage + inspect every dropped file into receipt rows
 * (a bad file becomes a failed row, never a stuck overlay), then commit the checked ones as
 * bundles. cancelImport aborts in-flight inspects AND closes the sheet; plain dismissal must go
 * through it or a finishing pool would reopen the overlay.
 */
export function makeImportRunners(args: {
  ctx: AppContext;
  importState: ImportState | null;
  setImportState: (updater: ImportState | null | ((prev: ImportState | null) => ImportState | null)) => void;
  reload: () => void;
}): {
  runImport: (files: File[], append?: boolean) => void;
  commitImport: (checkedIndexes: number[]) => void;
  cancelImport: () => void;
} {
  const { ctx, importState, setImportState, reload } = args;

  const cancelImport = (): void => {
    activeAbort?.abort();
    activeAbort = null;
    setImportState(null);
  };

  const runImport = (files: File[], append = false): void => {
    activeAbort?.abort();
    const abort = new AbortController();
    activeAbort = abort;
    void (async () => {
      const priorReads = append && importState?.phase === "done" ? importState.reads : [];
      const priorReports = append && importState?.phase === "done" ? importState.archiveReports : [];
      const { candidates, archives, skipped } = triageFiles(files);
      // ONE reads array for the whole pass, shared by reference into every progress tick: copying
      // it per completed file made a 2,000-file drop quadratic for nothing the overlay renders.
      const read: ReadFile[] = [...priorReads, ...skipped];
      const archiveReports: ArchiveReportEntry[] = [...priorReports];
      const total = candidates.length + archives.length;
      setImportState({ phase: "reading", reads: read, done: 0, total, archiveReports });

      // Shelf names for duplicate marking; an unreachable list never blocks an import.
      let shelf = new Map<string, string>();
      try {
        const pieces = await ctx.api.listEntities();
        shelf = new Map(pieces.map((p) => [shelfKey(p.kind, p.name), p.name]));
      } catch {
        /* shelf unknown: imports proceed, nothing is marked */
      }
      const seen = new Map<string, string>();
      for (const r of priorReads) {
        const key = r.result.ok ? contentKey(r.result) : null;
        if (key && !seen.has(key)) seen.set(key, r.filename);
      }

      let done = 0;
      const tick = (): void => setImportState({ phase: "reading", reads: read, done, total, archiveReports });

      let nextFile = 0;
      const fileWorker = async (): Promise<void> => {
        while (!abort.signal.aborted) {
          const mine = nextFile++;
          const file = candidates[mine];
          if (!file) return;
          // Per-file guard: one oversized or corrupt file becomes a failed receipt row.
          // Unguarded, its rejection left the fullscreen "reading" overlay up forever.
          try {
            const result = await ctx.api.inspectFile(file, abort.signal);
            read.push(markDupes(annotateRead(file.name, result), shelf, seen));
          } catch (e) {
            if (abort.signal.aborted) return;
            const error = e instanceof Error ? e.message : String(e);
            read.push(annotateRead(file.name, { ok: false, error }));
          }
          done++;
          tick();
        }
      };

      let nextArchive = 0;
      const archiveWorker = async (): Promise<void> => {
        while (!abort.signal.aborted) {
          const mine = nextArchive++;
          const file = archives[mine];
          if (!file) return;
          try {
            const result = await ctx.api.inspectArchive(file, abort.signal);
            if (result.ok) {
              // Never a silent nothing: the report renders even when rows is empty (M12 edge).
              // Guarded, not asserted - this crossed the network, and a missing report should
              // still let the rows through rather than throw the whole worker.
              if (result.report) archiveReports.push({ filename: file.name, report: result.report });
              for (const row of result.rows ?? []) {
                const label = row.receipt?.name ?? row.kind ?? "entity";
                read.push(markDupes(annotateRead(`${file.name}: ${label}`, withArchiveLinkCaveat(row)), shelf, seen));
              }
            } else {
              read.push(annotateRead(file.name, { ok: false, error: result.error ?? "We could not read this one." }));
            }
          } catch (e) {
            if (abort.signal.aborted) return;
            const error = e instanceof Error ? e.message : String(e);
            read.push(annotateRead(file.name, { ok: false, error }));
          }
          done++;
          tick();
        }
      };

      await Promise.all([
        ...Array.from({ length: INSPECT_POOL }, fileWorker),
        ...Array.from({ length: ARCHIVE_POOL }, archiveWorker),
      ]);
      if (abort.signal.aborted) return;
      activeAbort = null;
      setImportState({ phase: "done", reads: read, archiveReports });
    })();
  };

  const commitImport = (checkedIndexes: number[]): void => {
    if (importState?.phase !== "done") return;
    void (async () => {
      const picked = checkedIndexes
        .map((i) => importState.reads[i])
        .filter((r): r is NonNullable<typeof r> => !!r && r.result.ok);
      const errors: string[] = [];
      let shelved = 0;
      let attempted = 0;
      for (const r of picked) {
        setImportState({ phase: "saving", done: attempted++, total: picked.length });
        const payload = bundlePayloadFromInspect(r.result);
        if (!payload) continue;
        try {
          const result = await ctx.api.saveBundle(payload);
          if (!result.ok) {
            errors.push(`${r.filename}: ${result.error ?? "could not save"}`);
          } else {
            shelved++;
          }
        } catch (e) {
          errors.push(`${r.filename}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      reload();
      if (errors.length > 0) {
        // failure must be LOUD: the sheet stays up with one red receipt per failed file
        // (closing it while whispering into the status bar read as "imported, then nothing")
        setImportState({
          phase: "done",
          reads: errors.map((msg) => {
            const at = msg.indexOf(": ");
            return {
              filename: at > 0 ? msg.slice(0, at) : msg,
              result: { ok: false as const, error: at > 0 ? msg.slice(at + 2) : "could not save" },
            };
          }),
          // the archives' own reports describe THEIR import, not this save pass - still true
          // regardless of which rows failed to shelve, so they stay on screen.
          archiveReports: importState.archiveReports,
        });
        ctx.setStatus(`shelved ${shelved} · ${errors.length} of ${picked.length} failed to save`);
      } else {
        setImportState(null);
        ctx.setStatus(`imported ${shelved} file${shelved === 1 ? "" : "s"} · counts updated on the deck chips`);
      }
    })();
  };

  return { runImport, commitImport, cancelImport };
}

export function pickFiles(onFiles: (files: File[]) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.addEventListener("change", () => onFiles([...(input.files ?? [])]));
  input.click();
}

