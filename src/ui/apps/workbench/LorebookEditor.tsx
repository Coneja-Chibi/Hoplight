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
  findingsFromHealNotes,
  healNotesFromOriginal,
  inspectBook,
  loreHealth,
  loreSummary,
  LORE_WRITE_FOR_LABELS,
  LORE_WRITE_FOR_PROFILES,
  parseWriteFor,
  type LoreWriteForProfile,
} from "../../../core/lore";
import {
  addEntry,
  canUndo,
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
  undoSession,
  updateBook,
  updateEntry,
  type LoreSession,
} from "./lore/session";
import { LoreEntryPage } from "./lore/entry-page";
import { LoreEntryToc } from "./lore/entry-toc";
import { LoreBookSettings } from "./lore/book-settings";
import { CardsView } from "./lore/cards-view";
import { WebView } from "./lore/web-view";
import { BinderSide, type BinderSidePane } from "./lore/binder-side";
import { binderStyles as styles } from "./lore/binder-styles";
import {
  LoreWorkshopDialog,
  type LoreWorkshopState,
} from "../library/lore-workshop-dialog";
import { BottomSheet } from "../../components/bottom-sheet";
import { InkDialog } from "../../components/ink-dialog";
import { EditorEhead } from "../../components/editor-ehead";

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
  const [sidePane, setSidePane] = useState<BinderSidePane>(null);
  const [view, setView] = useState<"pages" | "cards" | "web">("pages");
  const [workshop, setWorkshop] = useState<LoreWorkshopState | null>(null);
  const [writeFor, setWriteForState] = useState<LoreWriteForProfile>(() =>
    parseWriteFor(ctx.prefs.get(WRITE_FOR_PREF)),
  );
  // Session baseline for Changes: body as it arrived this sitting (does not move on save).
  const [importBaseline] = useState(() => structuredClone(initBody));

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

  const healFindings = useMemo(() => {
    const original =
      isRec(entity) && isRec(entity.original) ? entity.original : undefined;
    return findingsFromHealNotes(healNotesFromOriginal(original));
  }, [entity]);

  const healthByEntry = useMemo(() => {
    const map = new Map<string, "problem" | "worth-a-look">();
    for (const f of inspectBook(session.body)) {
      if (!f.entryId) continue;
      const prev = map.get(f.entryId);
      if (f.severity === "problem" || !prev) map.set(f.entryId, f.severity);
    }
    return map;
  }, [session.body]);

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
        return;
      }
      // Undo bulk / Fix All only when not typing in a field
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;
        if (!canUndo(session)) return;
        e.preventDefault();
        setSession((s) => undoSession(s));
        ctx.setStatus("undid last bulk change");
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
  }, [doSave, dirty, session, ctx]);

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
    categories: session.body.categories ?? [],
    healthByEntry,
    onSelect: (id: string) => setSession((s) => selectEntry(s, id)),
    onAdd: () => setSession((s) => addEntry(s)),
    onPatch: (id: string, patch: Parameters<typeof updateEntry>[2]) =>
      setSession((s) => updateEntry(s, id, patch)),
    onDuplicate: (id: string) => setSession((s) => duplicateEntry(s, id)),
    onDelete: (id: string) => setSession((s) => deleteEntry(s, id)),
    onReorder: (id: string, toIndex: number) =>
      setSession((s) => reorderEntry(s, id, toIndex)),
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
    onBulkMove: () => {
      if (picked.size === 0) return;
      setWorkshop({
        mode: "split",
        source: piece,
        seedMovedIds: [...picked],
      });
    },
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
      <EditorEhead
        mark={monogram}
        name={session.body.name || "Untitled lorebook"}
        meta={
          <>
            {summary.entryCount} {summary.entryCount === 1 ? "entry" : "entries"} · ~{bookEstimate}
            {session.body.tokenBudget > 0 ? ` / ${session.body.tokenBudget}` : ""} tok ·{" "}
            <button type="button" className={styles.rulesLink} onClick={() => setRulesOpen(true)}>
              book rules
            </button>
          </>
        }
        dirty={dirty}
        saving={saving}
        onSave={() => void doSave()}
        topRight={topRight}
      >
        <span className={styles.viewSwitch} role="group" aria-label="Binder view">
          {(
            [
              ["pages", "Pages"],
              ["cards", "Cards"],
              ["web", "Web"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={view === id ? `${styles.viewBtn} ${styles.viewBtnOn}` : styles.viewBtn}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </span>
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
      </EditorEhead>

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
          {view === "cards" ? (
            <CardsView
              entries={session.body.entries}
              writeFor={writeFor}
              onSelect={(id) => {
                setSession((s) => selectEntry(s, id));
                setView("pages");
              }}
              onPatch={(id, patch) => setSession((s) => updateEntry(s, id, patch))}
              onAdd={() => setSession((s) => addEntry(s))}
            />
          ) : view === "web" ? (
            <WebView
              body={session.body}
              onSelect={(id) => {
                setSession((s) => selectEntry(s, id));
                setView("pages");
              }}
              onFallbackCards={() => setView("cards")}
            />
          ) : !entry ? (
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
              prefs={ctx.prefs}
            />
          )}
        </main>

        <BinderSide
          sidePane={sidePane}
          setSidePane={setSidePane}
          body={session.body}
          baseline={importBaseline}
          entry={entry}
          notes={health.filter((h) => (entry ? h.entryId === entry.id : false))}
          styles={styles}
          setSession={setSession}
          extraFindings={healFindings}
        />
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

      {workshop && (
        <LoreWorkshopDialog
          ctx={ctx}
          state={workshop}
          onDismiss={() => setWorkshop(null)}
          onDone={() => {
            setWorkshop(null);
            setPicked(new Set());
            setSelectMode(false);
            void (async () => {
              try {
                const raw = await ctx.api.getEntity(
                  `kind=${encodeURIComponent(piece.kind)}&id=${encodeURIComponent(piece.id)}`,
                );
                const body = bodyFromEntity(raw);
                setSession(normalizeSession(body));
                setBaseline(structuredClone(body));
                ctx.setStatus("book updated after split");
              } catch (e) {
                ctx.setStatus(e instanceof Error ? e.message : "reload failed");
              }
            })();
          }}
        />
      )}
    </div>
  );
}
