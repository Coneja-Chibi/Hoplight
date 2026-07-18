/**
 * The Press - the export desk (vs-press option 1, the Job Sheet, transcribed): the studio tray on
 * the left with every piece by kind, the work order on the right. Pick pieces, pick ONE target
 * platform, run the press; each row prints its honest result (printed with what it carries, skipped
 * with the reason, failed with the error) and the whole run lands as one zip. Single-piece export stays on each
 * editor's Export button; this room is for batches. Pure logic lives in press-core.ts.
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import { zipSync } from "fflate";
import type { AppContext, StudioEntitySummary, VaudeApp } from "../../app-contract";
import { mediaExportSummary } from "../../components/export-dialog/honesty";
import { triggerDownload } from "../../components/export-dialog/download";
import {
  flavorChoosable,
  flavorExtension,
  foldSummary,
  groupPlatforms,
  mintFilename,
  payloadBytes,
  planRun,
  type FileFlavor,
  type PressPlatform,
  type RunRow,
} from "./press-core";
import styles from "./styles.module.css";

/** the locked press mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="4"/><path d="M7 7v3M17 7v3"/><rect x="4" y="14" width="16" height="6"/><path d="M9 10.5 12 13l3-2.5"/></svg>';

const KIND_ORDER = ["character", "lorebook", "persona", "preset", "regex", "pack"] as const;
const KIND_LABEL: Record<string, string> = {
  character: "characters",
  lorebook: "lorebooks",
  persona: "personas",
  preset: "presets",
  regex: "regex sets",
  pack: "packs",
};

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const keyOf = (p: StudioEntitySummary): string => `${p.kind}:${p.id}`;

function Press({ ctx }: { ctx: AppContext }): JSX.Element {
  const [entities, setEntities] = useState<StudioEntitySummary[]>([]);
  const [platforms, setPlatforms] = useState<PressPlatform[]>([]);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [target, setTarget] = useState<string>("");
  const [rows, setRows] = useState<RunRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [zip, setZip] = useState<{ blob: Blob; filename: string } | null>(null);
  // per-row output choices, keyed kind:id - the file's base name and its flavor (normal/txt/md)
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [flavors, setFlavors] = useState<Record<string, FileFlavor>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [list, formats] = await Promise.all([ctx.api.listEntities(), ctx.api.formats()]);
        if (cancelled) return;
        setEntities(list);
        setPlatforms(groupPlatforms(formats));
      } catch {
        if (!cancelled) setLoadNote("could not load the studio · the server may be unreachable");
      }
    })();
    return () => {
      cancelled = true;
    };
    // mount-once: the tray is a snapshot of the shelf, refreshed by reopening the room
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    const known = KIND_ORDER.filter((k) => entities.some((e) => e.kind === k)).map((kind) => ({
      kind: kind as string,
      label: KIND_LABEL[kind] ?? kind,
      pieces: entities.filter((e) => e.kind === kind),
    }));
    const stray = entities.filter((e) => !(KIND_ORDER as readonly string[]).includes(e.kind));
    return stray.length > 0 ? [...known, { kind: "other", label: "other", pieces: stray }] : known;
  }, [entities]);

  const platform = platforms.find((p) => p.friendly === target) ?? null;
  const pickedPieces = entities.filter((e) => picked.has(keyOf(e)));
  const previewRows = rows ?? (platform ? planRun(pickedPieces, platform) : []);

  const resetRun = (): void => {
    setRows(null);
    setZip(null);
  };

  const togglePiece = (k: string): void => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    resetRun();
  };

  const toggleGroup = (pieces: StudioEntitySummary[], allOn: boolean): void => {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const p of pieces) {
        if (allOn) next.delete(keyOf(p));
        else next.add(keyOf(p));
      }
      return next;
    });
    resetRun();
  };

  const run = async (): Promise<void> => {
    if (!platform || pickedPieces.length === 0 || running) return;
    setRunning(true);
    setZip(null);
    const plan = planRun(pickedPieces, platform);
    setRows([...plan]);
    const files: Record<string, Uint8Array> = {};
    const taken = new Set<string>();

    for (let i = 0; i < plan.length; i++) {
      const row = plan[i]!;
      if (row.status !== "wait" || !row.targetId) continue;
      try {
        const entity = await ctx.api.getEntity(
          `kind=${encodeURIComponent(row.kind)}&id=${encodeURIComponent(row.id)}`,
        );
        const out = await ctx.api.exportEntity(entity, row.targetId);
        if (!out || (isRec(out) && "error" in out)) {
          const msg = isRec(out) && typeof out.error === "string" ? out.error : "export failed";
          throw new Error(msg);
        }
        const payload = out as { suggestedExtension: string; text?: string; bytesB64?: string };
        const bytes = payloadBytes(payload);
        if (!bytes) throw new Error("empty export payload");
        const rowKey = `${row.kind}:${row.id}`;
        const flavor = flavorChoosable(payload.suggestedExtension) ? (flavors[rowKey] ?? "normal") : "normal";
        const filename = mintFilename(
          fileNames[rowKey]?.trim() || row.name,
          flavorExtension(payload.suggestedExtension, flavor),
          taken,
        );
        files[filename] = bytes;
        // the same media-summary voice as the editor's Export dialog: neutral facts, not warnings
        const body = isRec(entity) ? entity.body : undefined;
        const original = isRec(entity) ? entity.original : undefined;
        const chips = row.kind === "character" ? mediaExportSummary(body, original).chips : [];
        const carries = chips.length > 0 ? `carries: ${chips.join(" · ")}` : undefined;
        plan[i] = {
          ...row,
          status: "ok",
          filename,
          info: [row.info, carries].filter(Boolean).join(" · ") || undefined,
        };
      } catch (e) {
        plan[i] = { ...row, status: "fail", note: e instanceof Error ? e.message : String(e) };
      }
      setRows([...plan]);
    }

    if (Object.keys(files).length > 0) {
      const zipped = zipSync(files);
      const stamp = platform.friendly.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      setZip({
        blob: new Blob([zipped], { type: "application/zip" }),
        filename: `vaude-press-${stamp}.zip`,
      });
    }
    ctx.setStatus(`press run · ${foldSummary(plan)}`);
    setRunning(false);
  };

  return (
    <div className={styles.room}>
      <aside className={styles.tray}>
        <span className={styles.kick}>the studio</span>
        {loadNote && <p className={styles.empty}>{loadNote}</p>}
        {groups.map((g) => {
          const allOn = g.pieces.length > 0 && g.pieces.every((p) => picked.has(keyOf(p)));
          return (
            <div key={g.kind} className={styles.grp}>
              <label className={styles.grpHead}>
                <input type="checkbox" checked={allOn} onChange={() => toggleGroup(g.pieces, allOn)} />
                <span className={styles.kick}>{`${g.label} · ${g.pieces.length}`}</span>
              </label>
              {g.pieces.map((p) => (
                <label key={keyOf(p)} className={styles.pickRow}>
                  <input
                    type="checkbox"
                    checked={picked.has(keyOf(p))}
                    onChange={() => togglePiece(keyOf(p))}
                  />
                  <span className={styles.pickName}>{p.name || p.id}</span>
                </label>
              ))}
            </div>
          );
        })}
      </aside>

      <section className={styles.sheet}>
        <div className={styles.sheetHead}>
          <span className={styles.kick}>
            {`job sheet · ${pickedPieces.length} piece${pickedPieces.length === 1 ? "" : "s"}`}
          </span>
          <span className={styles.targets}>
            {platforms.map((p) => (
              <button
                key={p.friendly}
                type="button"
                className={`${styles.tchip}${p.friendly === target ? ` ${styles.tchipOn}` : ""}`}
                onClick={() => {
                  setTarget(p.friendly);
                  resetRun();
                }}
              >
                {p.friendly}
              </button>
            ))}
          </span>
        </div>

        {previewRows.length === 0 ? (
          <p className={styles.empty}>
            Tick pieces on the left, pick a platform above, and run the press. Every piece prints
            with an honest result row: printed, skipped, or failed, and why.
          </p>
        ) : (
          previewRows.map((r) => (
            <div key={`${r.kind}:${r.id}`} className={styles.jrow}>
              <span
                className={`${styles.dot}${
                  r.status === "ok"
                    ? ` ${styles.dotOk}`
                    : r.status === "warn"
                      ? ` ${styles.dotWarn}`
                      : r.status === "fail"
                        ? ` ${styles.dotFail}`
                        : ""
                }`}
              />
              <span className={styles.pickName}>{r.name}</span>
              <span className={styles.jkind}>{r.kind}</span>
              <span className={styles.jfile}>{r.filename ?? ""}</span>
              {r.note && (
                <span className={`${styles.jnote}${r.status === "fail" ? ` ${styles.jnoteFail}` : ""}`}>
                  {r.note}
                </span>
              )}
              {r.info && <span className={styles.jinfo}>{r.info}</span>}
              {r.status === "wait" && !running && r.targetId && (
                <span className={styles.fileEdit}>
                  <input
                    className={styles.fileIn}
                    value={fileNames[`${r.kind}:${r.id}`] ?? r.name}
                    aria-label={`filename for ${r.name}`}
                    onChange={(e) =>
                      setFileNames((prev) => ({ ...prev, [`${r.kind}:${r.id}`]: e.target.value }))
                    }
                  />
                  {flavorChoosable(
                    platform?.byKind[r.kind]?.outputExtensions[0] ?? "",
                  ) &&
                    (["normal", "txt", "md"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`${styles.flavor}${(flavors[`${r.kind}:${r.id}`] ?? "normal") === f ? ` ${styles.flavorOn}` : ""}`}
                        onClick={() => setFlavors((prev) => ({ ...prev, [`${r.kind}:${r.id}`]: f }))}
                      >
                        {f === "normal" ? `.${(platform?.byKind[r.kind]?.outputExtensions[0] ?? "json").replace(/^\./, "")}` : `.${f}`}
                      </button>
                    ))}
                </span>
              )}
            </div>
          ))
        )}

        <div className={styles.foot}>
          <span className={styles.sum}>{foldSummary(previewRows)}</span>
          {zip && (
            <button
              type="button"
              className={styles.stamp}
              onClick={() => triggerDownload(zip.blob, zip.filename)}
            >
              download the bundle
            </button>
          )}
          {rows && !running && (
            <button type="button" className={styles.stamp} onClick={resetRun}>
              clear
            </button>
          )}
          <button
            type="button"
            className={`${styles.stamp} ${styles.stampRun}`}
            disabled={!platform || pickedPieces.length === 0 || running}
            title={!platform ? "Pick a target platform first" : undefined}
            onClick={() => void run()}
          >
            {running ? "printing…" : "run the press"}
          </button>
        </div>
      </section>
    </div>
  );
}

const app: VaudeApp = {
  manifest: {
    id: "press",
    title: "The Press",
    markSvg: MARK_SVG,
    accent: "#8b5cf6", // hardcode-ok: per-app identity accent, not theming
    order: 30,
    subtitle: "app · convert",
  },
  Component: Press,
};

export default app;
