/**
 * LorebookEditor - the binder (vs-lorebook-binder-2, 1:1): header with the book's spine chip and
 * the Writing-for select, a quiet searchable table of contents, ONE entry owning the page as
 * dossier cards, and the fine-print rail. Book rules live behind a dialog. Pure session ops;
 * save via Studio API overwrite.
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
  addEntry,
  deleteEntries,
  deleteEntry,
  duplicateEntry,
  focusedEntry,
  normalizeSession,
  reconcileLoreAfterSave,
  reorderEntry,
  selectEntry,
  sessionDirty,
  setEntriesEnabled,
  updateBook,
  updateEntry,
  type LoreSession,
} from "./lore/session";
import { LoreEntryPage } from "./lore/entry-page";
import { LoreEntryToc } from "./lore/entry-toc";
import { LoreEntryRail } from "./lore/entry-rail";
import { LoreBookSettings } from "./lore/book-settings";
import { BottomSheet } from "../../components/bottom-sheet";
import { InkDialog } from "../../components/ink-dialog";
import deskStyles from "./LorebookEditor.module.css";
import panelStyles from "./lore/entry-panel.module.css";
import panelKeyStyles from "./lore/entry-panel-keys.module.css";
import pageStyles from "./lore/entry-page.module.css";
import tocStyles from "./lore/entry-toc.module.css";
import railStyles from "./lore/entry-rail.module.css";
import platformCardStyles from "./lore/platforms/cards.module.css";

/** one styles object for the whole binder (disjoint class sets - a name lives in exactly ONE
 * module; the leaves keep taking a single `styles` prop so they stay file-layout-blind) */
const styles = {
  ...deskStyles,
  ...panelStyles,
  ...panelKeyStyles,
  ...pageStyles,
  ...tocStyles,
  ...railStyles,
  ...platformCardStyles,
};

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
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [writeFor, setWriteForState] = useState<LoreWriteForProfile>(() =>
    parseWriteFor(ctx.prefs.get(WRITE_FOR_PREF)),
  );

  // Open-beside / deep-link: piece.params.focusEntry lands on that entry once.
  useEffect(() => {
    const focus = piece.params?.focusEntry;
    if (!focus) return;
    setSession((s) => (s.body.entries.some((e) => e.id === focus) ? selectEntry(s, focus) : s));
  }, [piece.params?.focusEntry, piece.id]);

  const dirty = sessionDirty(session, baseline);
  const entry = focusedEntry(session);
  const summary = loreSummary(session.body);
  const health = loreHealth(session.body);
  const bookEstimate = estimateBookTokens(session.body);
  const entryIndex = entry ? session.body.entries.findIndex((e) => e.id === entry.id) : -1;

  const setWriteFor = (p: LoreWriteForProfile): void => {
    setWriteForState(p);
    ctx.prefs.set(WRITE_FOR_PREF, p);
  };

  const flip = (dir: -1 | 1): void => {
    setSession((s) => {
      const at = s.focusedId !== null ? s.body.entries.findIndex((e) => e.id === s.focusedId) : -1;
      const next = s.body.entries[at + dir];
      return next ? selectEntry(s, next.id) : s;
    });
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

  const monogram = (session.body.name.trim().charAt(0) || "?").toUpperCase();

  const tocProps = {
    entries: session.body.entries,
    focusedId: session.focusedId,
    writeFor,
    styles,
    onSelect: (id: string) => setSession((s) => selectEntry(s, id)),
    onAdd: () => setSession((s) => addEntry(s)),
    onPatch: (id: string, patch: Parameters<typeof updateEntry>[2]) =>
      setSession((s) => updateEntry(s, id, patch)),
    onDuplicate: (id: string) => setSession((s) => duplicateEntry(s, id)),
    onDelete: (id: string) => setSession((s) => deleteEntry(s, id)),
    onMove: (id: string, dir: -1 | 1) =>
      setSession((s) => {
        const at = s.body.entries.findIndex((e) => e.id === id);
        return at < 0 ? s : reorderEntry(s, id, at + dir);
      }),
    selectMode,
    onSelectMode: (on: boolean) => {
      setSelectMode(on);
      if (!on) setPicked(new Set());
    },
    picked,
    onTogglePick: (id: string) => {
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    onBulkEnable: (on: boolean) => {
      const ids = [...picked];
      setSession((s) => setEntriesEnabled(s, ids, on));
    },
    onBulkDelete: () => {
      const ids = [...picked];
      setSession((s) => deleteEntries(s, ids));
      setPicked(new Set());
    },
    onClearPick: () => setPicked(new Set()),
    onOpenBeside: (id: string) => {
      ctx.workbench.openBeside({
        ...piece,
        params: { focusEntry: id },
      });
    },
  };

  return (
    <div
      className={styles.root}
      style={piece.accent ? ({ "--a": piece.accent } as CSSProperties) : undefined}
    >
      {/* ---- header: spine chip + writing-for + save ---- */}
      <header className={styles.ehead}>
        <div className={styles.spine}>
          <span className={styles.spineMark}>{monogram}</span>
          <div className={styles.spineText}>
            <b className={styles.spineName}>{session.body.name || "Untitled lorebook"}</b>
            <span className={styles.spineMeta}>
              {summary.entryCount} {summary.entryCount === 1 ? "entry" : "entries"} · ~{bookEstimate}
              {session.body.tokenBudget > 0 ? ` / ${session.body.tokenBudget}` : ""} tok ·{" "}
              <button type="button" className={styles.rulesLink} onClick={() => setRulesOpen(true)}>
                book rules
              </button>
            </span>
          </div>
        </div>
        <span className={styles.eheadActs}>
          <select
            className={styles.lensSel}
            value={writeFor}
            aria-label="Writing for one host"
            onChange={(ev) => setWriteFor(parseWriteFor(ev.target.value))}
          >
            {LORE_WRITE_FOR_PROFILES.map((p) => (
              <option key={p} value={p}>
                Writing for: {LORE_WRITE_FOR_LABELS[p]}
              </option>
            ))}
          </select>
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

      {/* ---- mobile contents bar: the TOC leaves the flow below 34rem (vs-mobile-editors) ---- */}
      <div className={styles.mBar}>
        <button type="button" className={styles.mContents} onClick={() => setTocOpen(true)}>
          &#9776; Contents
        </button>
        <span className={styles.mPageNo}>
          {entry ? `${entryIndex + 1} / ${session.body.entries.length}` : "empty"}
        </span>
        <button type="button" className={styles.mPg} aria-label="Previous entry" disabled={!entry || entryIndex <= 0} onClick={() => flip(-1)}>
          &#8249;
        </button>
        <button type="button" className={styles.mPg} aria-label="Next entry" disabled={!entry || entryIndex >= session.body.entries.length - 1} onClick={() => flip(1)}>
          &#8250;
        </button>
      </div>

      {/* ---- toc | page | rail ---- */}
      <div className={styles.cols}>
        <div className={styles.tocCol}>
          <LoreEntryToc {...tocProps} />
        </div>

        <main className={styles.pageCol}>
          {!entry ? (
            <div className={styles.empty}>The book is empty. Add an entry from the contents.</div>
          ) : (
            <LoreEntryPage
              entry={entry}
              writeFor={writeFor}
              styles={styles}
              index={entryIndex}
              count={session.body.entries.length}
              onPrev={() => flip(-1)}
              onNext={() => flip(1)}
              tokenEstimate={estimateEntryTokens(entry)}
              onPatch={(patch) => setSession((s) => updateEntry(s, entry.id, patch))}
            />
          )}
        </main>

        {entry && (
          <LoreEntryRail
            entries={session.body.entries}
            notes={health.filter((h) => h.entryId === entry.id)}
            styles={styles}
          />
        )}
      </div>

      {/* ---- mobile contents sheet: same TOC, docked to the pane bottom ---- */}
      {tocOpen && (
        <div className={styles.mGate}>
          <BottomSheet title="Contents" onDismiss={() => setTocOpen(false)}>
            <LoreEntryToc
              {...tocProps}
              onSelect={(id) => {
                tocProps.onSelect(id);
                setTocOpen(false);
              }}
            />
          </BottomSheet>
        </div>
      )}

      {/* ---- book rules: the book-level form behind its own sheet ---- */}
      {rulesOpen && (
        <InkDialog onDismiss={() => setRulesOpen(false)} ariaLabel="Book rules">
          <div className={styles.rulesSheet}>
            <div className={styles.rulesHead}>
              <b>Book rules</b>
              <i>name · description · matching defaults · budget</i>
              <button
                type="button"
                className={styles.pgBtn}
                aria-label="Close book rules"
                onClick={() => setRulesOpen(false)}
              >
                &times;
              </button>
            </div>
            <LoreBookSettings
              body={session.body}
              styles={styles}
              onBook={(patch) => setSession((s) => updateBook(s, patch))}
            />
          </div>
        </InkDialog>
      )}
    </div>
  );
}
