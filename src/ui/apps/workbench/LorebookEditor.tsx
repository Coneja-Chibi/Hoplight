/**
 * LorebookEditor - the lorebook desk (vs-lorebook-desk-f, 1:1): Book settings fold, Write for
 * strip, entry sidebar with quick controls + the stagehand stack, up to two entry panels side by
 * side, and the status bar. Pure session ops; save via Studio API overwrite.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import type { CanonicalLorebook, LorebookBody } from "../../../entities/lorebook/schema";
import {
  estimateBookTokens,
  estimateEntryTokens,
  loreHealth,
  loreSummary,
  LORE_WRITE_FOR_LABELS,
  LORE_WRITE_FOR_PROFILES,
  parseWriteFor,
  type LoreWriteForProfile,
} from "../../../core/lore";
import {
  addCategory,
  addEntry,
  closeEntryPanel,
  deleteCategory,
  deleteEntry,
  duplicateEntry,
  focusEntryPanel,
  normalizeSession,
  openEntries,
  openEntryBeside,
  reconcileLoreAfterSave,
  renameCategory,
  reorderEntry,
  selectEntry,
  sessionDirty,
  setEntryCategory,
  updateBook,
  updateEntry,
  type LoreSession,
} from "./lore/session";
import { LoreEntryPanel } from "./lore/entry-panel";
import { LoreEntrySidebar } from "./lore/entry-sidebar";
import { LoreBookSettings } from "./lore/book-settings";
import deskStyles from "./LorebookEditor.module.css";
import panelStyles from "./lore/entry-panel.module.css";
import sidebarStyles from "./lore/entry-sidebar.module.css";

/** one styles object for the whole desk: chrome + panel skin + sidebar skin (disjoint class sets;
 * the leaves keep taking a single `styles` prop so they stay platform- and file-layout-blind) */
const styles = { ...deskStyles, ...panelStyles, ...sidebarStyles };

export interface LorebookEditorProps {
  entity: unknown;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function bodyFromEntity(entity: unknown): LorebookBody {
  const e = isRec(entity) ? entity : {};
  const b = isRec(e.body) ? (e.body as unknown as LorebookBody) : null;
  if (b && typeof b.name === "string" && Array.isArray(b.entries)) return structuredClone(b);
  return {
    name: "Untitled lorebook",
    tags: [],
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    globalScanDepth: 4,
    globalRecursion: false,
    tokenBudget: 0,
    budgetMode: "token",
    entryBudget: 0,
    entries: [],
  };
}

const WRITE_FOR_PREF = "lorebook.writeFor";

export function LorebookEditor({ entity, ctx, piece, topRight }: LorebookEditorProps): JSX.Element {
  const initBody = useMemo(() => bodyFromEntity(entity), [entity]);
  const [baseline, setBaseline] = useState(() => structuredClone(initBody));
  const [session, setSession] = useState<LoreSession>(() => normalizeSession(initBody));
  const [saving, setSaving] = useState(false);
  const [writeFor, setWriteForState] = useState<LoreWriteForProfile>(() =>
    parseWriteFor(ctx.prefs.get(WRITE_FOR_PREF)),
  );

  const dirty = sessionDirty(session, baseline);
  const panels = openEntries(session);
  const summary = loreSummary(session.body);
  const health = loreHealth(session.body);
  const bookEstimate = estimateBookTokens(session.body);

  const setWriteFor = (p: LoreWriteForProfile): void => {
    setWriteForState(p);
    ctx.prefs.set(WRITE_FOR_PREF, p);
  };

  const doSave = useCallback(async (): Promise<void> => {
    if (saving || !dirty) return;
    const name = session.body.name.trim();
    if (!name) {
      ctx.setStatus("a name is required before saving");
      return;
    }
    const submitted = structuredClone(session.body);
    setSaving(true);
    try {
      const payload: CanonicalLorebook = {
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "lorebook",
        id: piece.id,
        body: submitted,
        original:
          isRec(entity) && isRec(entity.original)
            ? (entity.original as CanonicalLorebook["original"])
            : {},
      };
      await ctx.api.saveEntity(payload, { overwrite: true });
      setBaseline(structuredClone(submitted));
      setSession((live) => {
        const r = reconcileLoreAfterSave({ live: live.body, submitted });
        return { body: r.current, openIds: live.openIds, focusedId: live.focusedId };
      });
      ctx.setStatus(`saved lorebook · ${name}`);
    } catch (e) {
      ctx.setStatus(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, dirty, session.body, ctx, piece.id, entity]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [doSave, dirty]);

  useEffect(() => {
    ctx.workbench.setDirty(piece.id, piece.kind, dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, piece.id, piece.kind]);

  useEffect(() => {
    const warn = health.filter((h) => h.level === "warn").length;
    ctx.setStatus(
      `${summary.entryCount} entries · ${summary.enabledCount} on · ${summary.keyCount} keys` +
        (warn > 0 ? ` · ${warn} tip${warn === 1 ? "" : "s"}` : ""),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.entryCount, summary.enabledCount, summary.keyCount, health.length]);

  return (
    <div
      className={styles.root}
      style={piece.accent ? ({ "--a": piece.accent } as CSSProperties) : undefined}
    >
      <header className={styles.hdr}>
        <h1 className={styles.title}>{session.body.name || "Untitled lorebook"}</h1>
        <span className={styles.hdrMeta}>
          {summary.entryCount} {summary.entryCount === 1 ? "entry" : "entries"}
        </span>
        <span className={styles.hdrRight}>
          <button
            type="button"
            className={styles.save}
            disabled={saving || !dirty}
            onClick={() => void doSave()}
            title="Save · ctrl+s"
          >
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
          {topRight}
        </span>
      </header>

      <details className={styles.fold}>
        <summary className={styles.foldSum}>
          <span className={styles.foldMark}>B</span>
          <strong className={styles.foldTitle}>Book settings</strong>
          <span className={styles.foldMeta}>
            {summary.entryCount} {summary.entryCount === 1 ? "entry" : "entries"} · ~{bookEstimate} tokens
            {session.body.tokenBudget > 0 ? ` · ${session.body.tokenBudget} budget` : ""}
          </span>
          <span className={styles.foldHint}>name · description · matching · budget</span>
        </summary>
        <div className={styles.foldBody}>
          <LoreBookSettings
            body={session.body}
            styles={styles}
            onBook={(patch) => setSession((s) => updateBook(s, patch))}
          />
        </div>
      </details>

      <div className={styles.strip}>
        <strong className={styles.stripTitle}>Write for</strong>
        <span className={styles.stripNote}>one host at a time · the book itself never forks</span>
        {LORE_WRITE_FOR_PROFILES.map((p) => (
          <button
            key={p}
            type="button"
            className={p === writeFor ? `${styles.stripChip} ${styles.stripChipOn}` : styles.stripChip}
            aria-pressed={p === writeFor}
            onClick={() => setWriteFor(p)}
          >
            {LORE_WRITE_FOR_LABELS[p]}
          </button>
        ))}
        <span className={styles.stripHint}>shows and hides advanced dials only</span>
      </div>

      <div className={styles.body}>
        <LoreEntrySidebar
          session={session}
          styles={styles}
          health={health}
          bookEstimate={bookEstimate}
          onSelect={(id) => setSession((s) => selectEntry(s, id))}
          onOpenBeside={(id) => setSession((s) => openEntryBeside(s, id))}
          onAdd={() => setSession((s) => addEntry(s))}
          onDuplicate={(id) => setSession((s) => duplicateEntry(s, id))}
          onDelete={(id) => setSession((s) => deleteEntry(s, id))}
          onMove={(id, dir) =>
            setSession((s) => {
              const at = s.body.entries.findIndex((e) => e.id === id);
              return at < 0 ? s : reorderEntry(s, id, at + dir);
            })
          }
          onPatchEntry={(id, patch) => setSession((s) => updateEntry(s, id, patch))}
          onAddCategory={(name) => setSession((s) => addCategory(s, name))}
          onRenameCategory={(id, name) => setSession((s) => renameCategory(s, id, name))}
          onDeleteCategory={(id) => setSession((s) => deleteCategory(s, id))}
          onSetCategory={(entryId, categoryId) => setSession((s) => setEntryCategory(s, entryId, categoryId))}
        />

        <main className={panels.length === 2 ? `${styles.panes} ${styles.panesSplit}` : styles.panes}>
          {panels.length === 0 && <div className={styles.empty}>Select or add an entry.</div>}
          {panels.map((entry) => (
            <LoreEntryPanel
              key={entry.id}
              entry={entry}
              writeFor={writeFor}
              styles={styles}
              focused={entry.id === session.focusedId}
              tokenEstimate={estimateEntryTokens(entry)}
              onPatch={(patch) => setSession((s) => updateEntry(s, entry.id, patch))}
              onClose={() => setSession((s) => closeEntryPanel(s, entry.id))}
              onFocus={() => setSession((s) => focusEntryPanel(s, entry.id))}
            />
          ))}
        </main>
      </div>

      <footer className={styles.statusbar}>
        <span>
          <b>{panels.length} panel{panels.length === 1 ? "" : "s"} open</b> · {summary.entryCount}{" "}
          {summary.entryCount === 1 ? "entry" : "entries"}
        </span>
        <span className={styles.statusRight}>~{bookEstimate} tokens estimated</span>
      </footer>
    </div>
  );
}
