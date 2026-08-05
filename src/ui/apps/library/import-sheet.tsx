/**
 * The import sheet's own presentation: receipt/skip/report cards and the ImportOverlay dialog that
 * arranges them. Split out of import-flow.tsx at the file's own size cap - pure code motion, no
 * behavior change. The runners (triage + inspect + commit) that feed this stay in import-flow.tsx;
 * this file owns no network calls of its own.
 */
import { useEffect, useState, type JSX } from "react";
import { InkDialog } from "../../components/ink-dialog";
import {
  defaultCheckedIndexes,
  groupBadRows,
  groupReportFailures,
  summarizeImportedTotals,
  summarizeSkippedTables,
  unresolvedArchiveRefs,
  withArchiveLinkCaveat,
  type ArchiveReportEntry,
  type BadGroup,
  type ReadFile,
} from "./import-triage";

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

  // The live link caveat: recomputed from `checked` on every render (one set per archive actually
  // present), never baked into a row once at inspect time - see unresolvedArchiveRefs's own doc.
  const archiveKeys = [...new Set(state.reads.map((r) => r.archiveKey).filter((k): k is string => !!k))];
  const unresolvedByArchive = new Map(archiveKeys.map((k) => [k, unresolvedArchiveRefs(state.reads, checked, k)]));
  const decorated = (r: ReadFile): ReadFile =>
    r.archiveKey
      ? { ...r, result: withArchiveLinkCaveat(r.result, unresolvedByArchive.get(r.archiveKey) ?? new Set()) }
      : r;
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
            r={decorated(r)}
            checked={checked.has(i)}
            onToggle={() => {
              if (!r.result.ok || r.batchDupe) return;
              toggle(i);
            }}
          />
        ))}
        {dupeRows.map(({ r, i }) => (
          <ReceiptCard key={i} r={decorated(r)} checked={false} onToggle={() => {}} />
        ))}
        {badGroups.map((g, gi) =>
          g.filenames.length >= 4 ? (
            <BadGroupCard key={`g${gi}`} group={g} />
          ) : (
            g.indexes.map((i) => (
              <ReceiptCard key={i} r={decorated(state.reads[i]!)} checked={false} onToggle={() => {}} />
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
