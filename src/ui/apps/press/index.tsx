/**
 * The Press - the locked vs-press-room-1 room, staging grammar: no studio browser in here. Pieces
 * arrive via "Stage for the Press" (the shell entity menu, the offer rail); the room works ONLY the
 * staged queue, grouped as KITS (a character owns his linked lorebooks; riders droppable per run),
 * each card carrying its readiness against the run's target (readiness-core over the same coverage
 * claims the Write-for lens trusts). One target per run, filenames + flavors per row, the lever,
 * one zip out. Ledger and drag-reorder are follow-up slices, named here so absence reads as
 * not-yet, never as done.
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import { zipSync } from "fflate";
import type { AppContext, CoverageInfo, StudioEntitySummary, HoplightApp } from "../../app-contract";
import { SETTING_KEYS } from "../../../studio/settings-shape";
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
import { lorebookKeyGap, readiness, readinessLine } from "./readiness-core";
import { groupKits, knowledgeRefsOf, pieceKeyOf, runSet } from "./press-kits";
import styles from "./styles.module.css";

/** the locked press mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
  '<rect x="5" y="3" width="14" height="4"/><path d="M7 7v3.5M17 7v3.5"/>' +
  '<path d="m9 11.5 3 2.8 3-2.8"/><rect x="4" y="16.5" width="16" height="4.5"/>' +
  "</svg>";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function Press({ ctx }: { ctx: AppContext }): JSX.Element {
  const [queue, setQueue] = useState<StudioEntitySummary[]>(() => ctx.press.queue());
  const [allSummaries, setAllSummaries] = useState<StudioEntitySummary[]>([]);
  const [platforms, setPlatforms] = useState<PressPlatform[]>([]);
  const [coverage, setCoverage] = useState<CoverageInfo[]>([]);
  const [entities, setEntities] = useState<Record<string, unknown>>({});
  const [dropped, setDropped] = useState<Set<string>>(() => new Set());
  const [target, setTarget] = useState<string>("");
  const [rows, setRows] = useState<RunRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [zip, setZip] = useState<{ blob: Blob; filename: string } | null>(null);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [flavors, setFlavors] = useState<Record<string, FileFlavor>>({});
  const [loadNote, setLoadNote] = useState<string | null>(null);

  // the queue is shell state (survives app switches); this room mirrors it live
  useEffect(() => ctx.press.onChange(() => setQueue(ctx.press.queue())), [ctx]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [list, formats, cov] = await Promise.all([
          ctx.api.listEntities(),
          ctx.api.formats(),
          ctx.api.coverage(),
        ]);
        if (cancelled) return;
        setAllSummaries(list);
        const grouped = groupPlatforms(formats);
        setPlatforms(grouped);
        setCoverage(cov);
        // the setup/Settings publish answer finally DOES something here: the first pick that
        // exists in the roster starts selected (an untouched room otherwise starts unselected)
        const picksRaw = ctx.prefs.get(SETTING_KEYS.publishTargets);
        const picks = Array.isArray(picksRaw)
          ? picksRaw.filter((t): t is string => typeof t === "string")
          : [];
        const preferred = picks.find((p) => grouped.some((g) => g.friendly === p));
        if (preferred) setTarget((t) => (t === "" ? preferred : t));
      } catch {
        if (!cancelled) setLoadNote("could not load the studio · the server may be unreachable");
      }
    })();
    return () => {
      cancelled = true;
    };
    // mount-once snapshot, same rule as the workbench rail
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refsByOwner = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const p of queue) {
      if (p.kind !== "character") continue;
      out[pieceKeyOf(p)] = knowledgeRefsOf(entities[pieceKeyOf(p)]);
    }
    return out;
  }, [queue, entities]);

  const grouping = useMemo(() => groupKits(queue, allSummaries, refsByOwner), [queue, allSummaries, refsByOwner]);

  // Fetch bodies for the queue AND kit riders (readiness + kit links need them; the run reuses the
  // cache). Riders arrive one pass late by design: fetching an owner reveals his refs, the grouping
  // gains the rider, this effect refires and fetches him. Rider bodies never change the grouping,
  // so it settles in two passes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const wanted = [...queue, ...grouping.kits.flatMap((k) => k.riders)];
      for (const p of wanted) {
        const key = pieceKeyOf(p);
        if (entities[key] !== undefined) continue;
        try {
          const e = await ctx.api.getEntity(
            `kind=${encodeURIComponent(p.kind)}&id=${encodeURIComponent(p.id)}`,
          );
          if (cancelled) return;
          setEntities((prev) => ({ ...prev, [key]: e }));
        } catch {
          // a failed fetch leaves readiness honest-unknown; the run reports its own failure
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // entities is the cache being filled; keying on it would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, grouping, ctx]);
  const platform = platforms.find((p) => p.friendly === target) ?? null;
  const set = useMemo(() => runSet(grouping, dropped), [grouping, dropped]);
  const staged = new Set(queue.map(pieceKeyOf));
  const offers = allSummaries.filter((s) => !staged.has(pieceKeyOf(s)));

  const covFor = (kind: string): CoverageInfo | undefined =>
    kind === "character" && platform
      ? coverage.find((c) => c.label === platform.friendly) ?? coverage.find((c) => c.id === platform.byKind.character?.id)
      : undefined;

  const readinessOf = (p: StudioEntitySummary): { line: string; tone: "ok" | "warn" | "bad" | "dim" } | null => {
    const entity = entities[pieceKeyOf(p)];
    if (entity === undefined) return { line: "reading the piece…", tone: "dim" };
    const body = isRec(entity) ? entity.body : undefined;
    if (p.kind === "lorebook") {
      const gap = lorebookKeyGap(body);
      const entries = (n: number): string => (n === 1 ? "1 entry" : `${n} entries`);
      if (gap.total > 0 && gap.keyless === gap.total)
        return { line: "no entry has keywords - it will never fire", tone: "bad" };
      if (gap.keyless > 0)
        return { line: `${entries(gap.keyless)} of ${gap.total} without keywords`, tone: "warn" };
      return { line: `${entries(gap.total)} · keys fine`, tone: "ok" };
    }
    if (p.kind === "character" && platform) {
      const r = readiness(body, covFor(p.kind));
      if (r.verdict === "unknown") return null;
      return { line: readinessLine(r), tone: r.verdict === "ready" ? "ok" : "warn" };
    }
    return null;
  };

  const resetRun = (): void => {
    setRows(null);
    setZip(null);
  };

  const run = async (): Promise<void> => {
    if (!platform || set.length === 0 || running) return;
    setRunning(true);
    setZip(null);
    const plan = planRun(set, platform);
    setRows([...plan]);
    const files: Record<string, Uint8Array> = {};
    const taken = new Set<string>();

    for (let i = 0; i < plan.length; i++) {
      const row = plan[i]!;
      if (row.status !== "wait" || !row.targetId) continue;
      const rowKey = `${row.kind}:${row.id}`;
      try {
        const entity =
          entities[rowKey] ??
          (await ctx.api.getEntity(`kind=${encodeURIComponent(row.kind)}&id=${encodeURIComponent(row.id)}`));
        const out = await ctx.api.exportEntity(entity, row.targetId);
        if (!out || (isRec(out) && "error" in out)) {
          const msg = isRec(out) && typeof out.error === "string" ? out.error : "export failed";
          throw new Error(msg);
        }
        const payload = out;
        const bytes = payloadBytes(payload);
        if (!bytes) throw new Error("empty export payload");
        const flavor = flavorChoosable(payload.suggestedExtension) ? (flavors[rowKey] ?? "normal") : "normal";
        const filename = mintFilename(
          fileNames[rowKey]?.trim() || row.name,
          flavorExtension(payload.suggestedExtension, flavor),
          taken,
        );
        files[filename] = bytes;
        const body = isRec(entity) ? entity.body : undefined;
        const original = isRec(entity) ? entity.original : undefined;
        const chips = row.kind === "character" ? mediaExportSummary(body, original).chips : [];
        const carries = chips.length > 0 ? `carries: ${chips.join(" · ")}` : undefined;
        const reportLine = out.report.dropped.length > 0
          ? `${out.report.dropped.length} field${out.report.dropped.length === 1 ? "" : "s"} not carried`
          : out.report.warnings[0];
        plan[i] = {
          ...row,
          status: reportLine ? "warn" : "ok",
          filename,
          info: [row.info, carries, reportLine].filter(Boolean).join(" · ") || undefined,
        };
      } catch (e) {
        plan[i] = { ...row, status: "fail", note: e instanceof Error ? e.message : String(e) };
      }
      setRows([...plan]);
    }

    if (Object.keys(files).length > 0) {
      const zipped = zipSync(files);
      const stamp = platform.friendly.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      setZip({ blob: new Blob([zipped], { type: "application/zip" }), filename: `vaude-press-${stamp}.zip` });
    }
    ctx.setStatus(`press run · ${foldSummary(plan)}`);
    setRunning(false);
  };

  const rowFor = (r: RunRow[] | null, p: StudioEntitySummary): RunRow | undefined =>
    r?.find((x) => x.id === p.id && x.kind === p.kind);

  const card = (p: StudioEntitySummary, rider?: { of: string }): JSX.Element => {
    const key = pieceKeyOf(p);
    const ready = readinessOf(p);
    const row = rowFor(rows, p);
    const adapter = platform?.byKind[p.kind];
    const borrowed = platform?.borrowed?.[p.kind];
    const isDropped = rider !== undefined && dropped.has(key);
    return (
      <div key={key} className={`${styles.kcard}${isDropped ? ` ${styles.kcardDropped}` : ""}`}>
        <span
          className={`${styles.dot}${
            row?.status === "ok" ? ` ${styles.dotOk}` : row?.status === "fail" ? ` ${styles.dotFail}` : ready?.tone === "ok" ? ` ${styles.dotOk}` : ready?.tone === "warn" ? ` ${styles.dotWarn}` : ready?.tone === "bad" ? ` ${styles.dotFail}` : ""
          }`}
        />
        <b className={styles.kname}>{p.name}</b>
        <span className={styles.jkind}>
          {p.kind}
          {rider ? " · rides with " + rider.of : ""}
          {borrowed ? " · prints as a CCv3 card" : ""}
        </span>
        {rider && (
          <button
            type="button"
            className={styles.riderDrop}
            onClick={() => {
              setDropped((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
              resetRun();
            }}
          >
            {isDropped ? "ride again" : "drop from this run"}
          </button>
        )}
        {!isDropped && ready && (
          <span className={`${styles.jinfo}${ready.tone === "warn" ? ` ${styles.jnote}` : ready.tone === "bad" ? ` ${styles.jnote} ${styles.jnoteFail}` : ""}`}>
            {ready.line}
            {ready.tone !== "ok" && ready.tone !== "dim" && (
              <>
                {" · "}
                <button type="button" className={styles.fixLink} onClick={() => ctx.workbench.send(p)}>
                  open in the editor
                </button>
              </>
            )}
          </span>
        )}
        {row?.note && <span className={`${styles.jnote} ${styles.jnoteFail}`}>{row.note}</span>}
        {row?.info && <span className={styles.jinfo}>{row.info}</span>}
        {row?.filename && <span className={styles.jfile}>{row.filename}</span>}
        {!isDropped && !rows && adapter && (
          <span className={styles.fileEdit}>
            <input
              className={styles.fileIn}
              value={fileNames[key] ?? p.name}
              aria-label={`filename for ${p.name}`}
              onChange={(e) => setFileNames((prev) => ({ ...prev, [key]: e.target.value }))}
            />
            {flavorChoosable(adapter.outputExtensions[0] ?? "") &&
              (["normal", "txt", "md"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`${styles.flavor}${(flavors[key] ?? "normal") === f ? ` ${styles.flavorOn}` : ""}`}
                  onClick={() => setFlavors((prev) => ({ ...prev, [key]: f }))}
                >
                  {f === "normal" ? `.${(adapter.outputExtensions[0] ?? "json").replace(/^\./, "")}` : `.${f}`}
                </button>
              ))}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={styles.roomHost}>
      <div className={styles.room2}>
        <aside className={styles.rail}>
          <span className={styles.kick}>from the library · click to stage</span>
          {loadNote && <p className={styles.empty}>{loadNote}</p>}
          <div className={styles.offerList}>
            {offers.map((s) => (
              <button key={pieceKeyOf(s)} type="button" className={styles.offer} onClick={() => ctx.press.stage([s])}>
                <span className={styles.offerName}>{s.name || s.id}</span>
                <span className={styles.jkind}>{s.kind}</span>
              </button>
            ))}
            {offers.length === 0 && <p className={styles.empty}>everything is staged</p>}
          </div>
        </aside>

        <section>
          <div className={styles.sheetHead}>
            <span className={styles.kick}>
              {`the queue · ${queue.length} staged${dropped.size > 0 ? ` · ${dropped.size} dropped` : ""}`}
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

          {queue.length === 0 ? (
            <p className={styles.empty}>
              Nothing staged. Stage pieces from the Library - right-click any piece, or use the rail
              on the left. A staged character brings his linked lorebooks as a kit.
            </p>
          ) : (
            <>
              {grouping.kits.map((kit) => (
                <div key={pieceKeyOf(kit.owner)} className={styles.kit}>
                  <div className={styles.kitMarq}>
                    <span>{`kit · ${kit.owner.name}`}</span>
                    <i>{kit.riders.length > 0 ? `character + ${kit.riders.length} linked` : "character"}</i>
                    <button type="button" className={styles.unstage} onClick={() => ctx.press.unstage(kit.owner.id, kit.owner.kind)}>
                      unstage ×
                    </button>
                  </div>
                  {card(kit.owner)}
                  {kit.riders.map((r) => card(r, { of: kit.owner.name }))}
                </div>
              ))}
              {grouping.solos.map((s) => (
                <div key={pieceKeyOf(s)} className={styles.kit}>
                  <div className={styles.kitMarq}>
                    <span>{`solo · ${s.name}`}</span>
                    <i>{s.kind}</i>
                    <button type="button" className={styles.unstage} onClick={() => ctx.press.unstage(s.id, s.kind)}>
                      unstage ×
                    </button>
                  </div>
                  {card(s)}
                </div>
              ))}
            </>
          )}

          <div className={styles.foot}>
            <span className={styles.sum}>
              {rows
                ? foldSummary(rows)
                : platform
                  ? foldSummary(planRun(set, platform))
                  : `${set.length} in the run · pick a platform`}
            </span>
            {zip && (
              <button type="button" className={styles.stamp} onClick={() => triggerDownload(zip.blob, zip.filename)}>
                download the bundle
              </button>
            )}
            {rows && !running && (
              <button type="button" className={styles.stamp} onClick={resetRun}>
                clear the results
              </button>
            )}
            {queue.length > 0 && !running && (
              <button type="button" className={styles.stamp} onClick={() => { ctx.press.clear(); resetRun(); }}>
                clear the queue
              </button>
            )}
            <button
              type="button"
              className={`${styles.stamp} ${styles.stampRun}`}
              disabled={!platform || set.length === 0 || running}
              title={!platform ? "Pick a target platform first" : undefined}
              onClick={() => void run()}
            >
              {running ? "printing…" : "run the press"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const app: HoplightApp = {
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
