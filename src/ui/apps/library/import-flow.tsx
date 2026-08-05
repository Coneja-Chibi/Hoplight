/**
 * Library import runners: triage + a small parallel inspect pool with live progress and a real
 * Cancel, duplicate marking (against the shelf by kind+name, within the drop by content), and
 * commit (dependency-first save ordering + archive-internal knowledgeRef rewrite, ISC-35). The
 * sheet's own presentation (receipt/skip/report cards, ImportOverlay) lives in import-sheet.tsx,
 * split out at this file's own size cap; re-exported below so nothing else has to know that moved.
 */
import type { AppContext } from "../../app-contract";
import { commitOrderedRows, orderForCommit } from "./deck-core";
import type { ImportState } from "./import-sheet";
import {
  annotateRead,
  contentKey,
  markDupes,
  shelfKey,
  triageFiles,
  type ArchiveReportEntry,
  type ReadFile,
} from "./import-triage";

export { ImportOverlay, type ImportState } from "./import-sheet";
export type { ArchiveReportEntry, ReadFile } from "./import-triage";

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
                const annotated = markDupes(annotateRead(`${file.name}: ${label}`, row), shelf, seen);
                // Tags this row to its own archive's id namespace - the sheet's live caveat and the
                // commit path's own reordering both key off this, never a raw filename guess.
                annotated.archiveKey = file.name;
                read.push(annotated);
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
      // Dependency-first within each archive drop (ISC-35): a lorebook before the characters/
      // personas that reference it, so its REAL post-keep-both id exists before a dependent's ref
      // needs rewriting to it. Non-archive rows are untouched, in their original order.
      const picked = orderForCommit(
        checkedIndexes.map((i) => importState.reads[i]).filter((r): r is ReadFile => !!r && r.result.ok),
      );
      const { shelved, errors } = await commitOrderedRows(picked, ctx.api.saveBundle, (done, total) =>
        setImportState({ phase: "saving", done, total }),
      );
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

