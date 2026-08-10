/**
 * ExportDialog - pick a platform, read honesty lines, download the file.
 * Uses InkDialog chrome; honesty is pure (honesty.ts). Download is the only DOM edge.
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import type { AppContext, CoverageInfo, FormatInfo } from "../../app-contract";
import { InkDialog } from "../ink-dialog";
import { exportBlob, triggerDownload } from "./download";
import {
  behaviorFlagsFromBody,
  buildExportHonesty,
  mediaExportSummary,
  type ExportHonesty,
} from "./honesty";
import styles from "./styles.module.css";

export interface ExportDialogProps {
  ctx: AppContext;
  /** full entity payload (body + original + id/kind/name) */
  entity: unknown;
  /** display name for the file stem */
  name: string;
  /** when true, original may hold a packaged module */
  hasPackage?: boolean;
  onClose(): void;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function ExportDialog({
  ctx,
  entity,
  name,
  hasPackage = false,
  onClose,
}: ExportDialogProps): JSX.Element {
  const [formats, setFormats] = useState<FormatInfo[]>([]);
  const [coverage, setCoverage] = useState<CoverageInfo[]>([]);
  const [targetId, setTargetId] = useState<string>("");
  /**
   * Which container, when the chosen format writes more than one.
   *
   * PNG WAS UNREACHABLE FROM THE APP. A card PNG is how characters are traded, the adapter could
   * write one, and the dialog listed ".json · .png" - but nothing ever sent an extension, so every
   * export took the first branch and produced json. Empty means "whatever the format suggests",
   * which is what every single-container format keeps doing.
   */
  const [extension, setExtension] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Guarded like Library's reload: an unreachable studio must say so, not leave the dialog
      // showing "no formats" forever with every export silently dead.
      try {
        const [fmts, cov] = await Promise.all([ctx.api.formats(), ctx.api.coverage()]);
        if (cancelled) return;
        const kind = isRec(entity) && typeof entity.kind === "string" ? entity.kind : "character";
        const publish = fmts.filter((f) => f.kind === kind && !f.native);
        setFormats(publish);
        setCoverage(cov);
        const prefer =
          publish.find((f) => f.id === "risu") ??
          publish.find((f) => f.id === "sillytavern") ??
          publish[0];
        if (prefer) setTargetId(prefer.id);
      } catch {
        if (!cancelled) setErr("could not load export formats · the studio may be unreachable · close and retry");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, entity]);

  const body = isRec(entity) ? entity.body : undefined;
  const original = isRec(entity) ? entity.original : undefined;
  const flags = useMemo(() => behaviorFlagsFromBody(body, hasPackage), [body, hasPackage]);
  const mediaChips = useMemo(
    () => mediaExportSummary(body, original).chips,
    [body, original],
  );

  const target = formats.find((f) => f.id === targetId);
  const cov = coverage.find((c) => c.id === targetId);

  const honesty: ExportHonesty | null = useMemo(() => {
    if (!target) return null;
    return buildExportHonesty({
      targetId: target.id,
      targetFriendly: target.friendly || target.label,
      carries: cov?.carries ?? [],
      flags,
      body,
      original,
    });
  }, [target, cov, flags, body, original]);

  const doExport = async (): Promise<void> => {
    if (!targetId) return;
    setBusy(true);
    setErr(null);
    try {
      const out = await ctx.api.exportEntity(entity, targetId, extension || undefined);
      if (!out || (typeof out === "object" && "error" in (out as object))) {
        const msg = isRec(out) && typeof out.error === "string" ? out.error : "export failed";
        throw new Error(msg);
      }
      const { blob, filename } = exportBlob(out, name);
      triggerDownload(blob, filename);
      const loss = out.report.dropped.length;
      const lossLine = out.report.coverage === "unknown"
        ? " · loss unknown"
        : loss > 0
          ? ` · ${loss} field${loss === 1 ? "" : "s"} not carried`
          : "";
      ctx.setStatus(`exported ${filename}${lossLine}`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <InkDialog onDismiss={onClose} ariaLabel="Export card" sheetClassName={styles.sheet}>
      <h2 className={styles.title}>Export</h2>
      <p className={styles.sub}>Pick a platform. We tell you what will and will not travel.</p>

      {mediaChips.length > 0 ? (
        <div className={styles.chips} aria-label="Media on this card">
          {mediaChips.map((c) => (
            <span key={c} className={styles.chip}>
              {c}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.list} role="listbox" aria-label="Export formats">
        {formats.map((f) => (
          <button
            key={f.id}
            type="button"
            role="option"
            aria-selected={f.id === targetId}
            className={`${styles.opt}${f.id === targetId ? ` ${styles.optOn}` : ""}`}
            onClick={() => { setTargetId(f.id); setExtension(""); }}
          >
            <b>{f.friendly || f.label}</b>
            <span>{f.outputExtensions.map((e) => `.${e.replace(/^\./, "")}`).join(" · ") || f.id}</span>
          </button>
        ))}
        {formats.length === 0 && (
          <p className={styles.sub}>No export formats loaded yet.</p>
        )}
      </div>

      {/*
        Only when there IS a choice. A format that writes one container has nothing to ask about,
        and a control that always appears teaches people to ignore it.
      */}
      {(target?.outputExtensions.length ?? 0) > 1 && (
        <div className={styles.list} role="radiogroup" aria-label="File type">
          {target?.outputExtensions.map((raw) => {
            const ext = raw.replace(/^\./, "");
            const picked = extension === ext || (!extension && ext === target.outputExtensions[0]?.replace(/^\./, ""));
            return (
              <button
                key={ext}
                type="button"
                role="radio"
                aria-checked={picked}
                className={`${styles.opt}${picked ? ` ${styles.optOn}` : ""}`}
                onClick={() => setExtension(ext)}
              >
                <b>{`.${ext}`}</b>
                {/* Said plainly, because "which one do I send someone" is the actual question. */}
                <span>{ext === "png" ? "the card image other apps import" : "plain data file"}</span>
              </button>
            );
          })}
        </div>
      )}

      {honesty && (
        <div className={styles.honesty} role="status">
          <h4>{honesty.headline}</h4>
          {honesty.lines.map((l, i) => (
            <p
              key={i}
              className={`${styles.line}${
                l.kind === "keep"
                  ? ` ${styles.lineKeep}`
                  : l.kind === "warn"
                    ? ` ${styles.lineWarn}`
                    : ` ${styles.lineDrop}`
              }`}
            >
              {l.kind === "drop" ? "Dropped: " : l.kind === "warn" ? "Note: " : ""}
              {l.text}
            </p>
          ))}
        </div>
      )}

      {err && <p className={styles.err}>{err}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => void doExport()}
          disabled={busy || !targetId}
        >
          {busy ? "Exporting…" : honesty?.level === "warn" ? "Export anyway" : "Export"}
        </button>
      </div>
    </InkDialog>
  );
}
