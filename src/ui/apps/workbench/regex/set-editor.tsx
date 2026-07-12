/**
 * SetEditor - the regex set-editor chassis (design/vs-regex-editor.html, 1:1): header with the spine
 * chip, the Write-for tab strip, and a state-honest Save; the toc | page | rail columns; the mobile
 * Contents sheet. Pure session ops (session.ts); save via the Studio API overwrite, preserving the
 * sealed `original` so an imported set still round-trips byte-true. Exported as RegexSetEditor so the
 * workbench mount point re-exports it unchanged.
 */
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import type { CanonicalRegexSet, RegexRule, RegexSetBody } from "../../../../entities/regex/schema";
import {
  findingsForRule,
  inspectSet,
  parseWriteFor,
  REGEX_WRITE_FOR_LABELS,
  REGEX_WRITE_FOR_PROFILES,
  slowRuleIds,
  type RegexFinding,
  type RegexWriteForProfile,
} from "../../../../core/regex";
import { BottomSheet } from "../../../components/bottom-sheet";
import { MobileEditorHead, type MobileMenuItem } from "../../../components/mobile-editor-head";
import { WriteForStrip } from "../../../components/write-for-strip";
import { regexStyles as styles } from "./regex-styles";
import { RuleToc } from "./rule-toc";
import { RulePage } from "./rule-page";
import { RuleRail } from "./rule-rail";
import { BenchPane } from "./bench-pane";
import { HealthPane } from "./health-pane";
import { GalleryPane } from "./gallery-pane";
import { templateToRule } from "../../../../core/regex";
import {
  addRule,
  addRuleFrom,
  deleteRule,
  duplicateRule,
  focusedRule,
  normalizeSession,
  reconcileRegexAfterSave,
  selectRule,
  sessionDirty,
  updateRule,
  updateSet,
  type RegexSession,
} from "./session";

export interface RegexSetEditorProps {
  entity: unknown;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Read a canonical regex set out of the loaded entity, tolerant of a missing/partial body. */
function bodyFromEntity(entity: unknown): RegexSetBody {
  const e = isRec(entity) ? entity : {};
  const b = isRec(e.body) ? (e.body as unknown as RegexSetBody) : null;
  if (b && typeof b.name === "string" && Array.isArray(b.rules)) return structuredClone(b);
  return { name: "Untitled regex set", rules: [] };
}

const WRITE_FOR_PREF = "regex.writeFor";

export function RegexSetEditor({ entity, ctx, piece, topRight }: RegexSetEditorProps): JSX.Element {
  const initBody = useMemo(() => bodyFromEntity(entity), [entity]);
  const [baseline, setBaseline] = useState(() => structuredClone(initBody));
  const [session, setSession] = useState<RegexSession>(() => normalizeSession(initBody));
  const [saving, setSaving] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [benchOpen, setBenchOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [writeFor, setWriteForState] = useState<RegexWriteForProfile>(() =>
    parseWriteFor(ctx.prefs.get(WRITE_FOR_PREF)),
  );

  const dirty = sessionDirty(session, baseline);
  const rule = focusedRule(session);
  const count = session.body.rules.length;
  const enabledCount = session.body.rules.filter((r) => r.enabled).length;
  const ruleIndex = rule ? session.body.rules.findIndex((r) => r.id === rule.id) : -1;

  // The set linter (R4): deferred so keystrokes stay snappy - the shadowing check runs the real
  // engine over each rule's examples, which is bounded but not free.
  const deferredBody = useDeferredValue(session.body);
  const findings = useMemo(() => inspectSet(deferredBody), [deferredBody]);
  const slowIds = useMemo(() => new Set(slowRuleIds(findings)), [findings]);

  const applyFix = (f: RegexFinding): void => {
    if (!f.fix) return;
    setSession((s) => ({ ...s, body: f.fix!(s.body) }));
    ctx.setStatus("fixed - save to keep");
  };

  const setWriteFor = (p: RegexWriteForProfile): void => {
    setWriteForState(p);
    ctx.prefs.set(WRITE_FOR_PREF, p);
  };

  const flip = (dir: -1 | 1): void => {
    setSession((s) => {
      const at = s.focusedId !== null ? s.body.rules.findIndex((r) => r.id === s.focusedId) : -1;
      const next = s.body.rules[at + dir];
      return next ? selectRule(s, next.id) : s;
    });
  };

  // Staged import from the test bench: the rules arrive already re-ided + re-ordered (stageRules);
  // append them into the open set and focus the first, so nothing is written until the user saves.
  const appendImported = (staged: RegexRule[]): void => {
    if (staged.length === 0) return;
    setSession((s) => ({
      body: { ...s.body, rules: [...s.body.rules, ...staged] },
      focusedId: staged[0]?.id ?? s.focusedId,
    }));
    ctx.setStatus(`added ${staged.length} rule${staged.length === 1 ? "" : "s"} from import - save to keep`);
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
      const payload: CanonicalRegexSet = {
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "regex",
        id: piece.id,
        body: submitted,
        original:
          isRec(entity) && isRec(entity.original)
            ? (entity.original as CanonicalRegexSet["original"])
            : {},
      };
      await ctx.api.saveEntity(payload, { overwrite: true });
      setBaseline(structuredClone(submitted));
      setSession((live) => {
        const r = reconcileRegexAfterSave({ live: live.body, submitted });
        return { body: r.current, focusedId: live.focusedId };
      });
      ctx.setStatus(`saved regex set · ${name}`);
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave]);

  useEffect(() => {
    ctx.workbench.setDirty(piece.id, piece.kind, dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, piece.id, piece.kind]);

  useEffect(() => {
    ctx.setStatus(`${count} rule${count === 1 ? "" : "s"} · ${enabledCount} on`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, enabledCount]);

  const monogram = (session.body.name.trim().charAt(0) || "R").toUpperCase();

  // "+ New rule" opens the recipe gallery per the locked wire; Start blank keeps the old path.
  const tocProps = {
    rules: session.body.rules,
    focusedId: session.focusedId,
    styles,
    onSelect: (id: string) => setSession((s) => selectRule(s, id)),
    onAdd: () => {
      setBenchOpen(false);
      setHealthOpen(false);
      setGalleryOpen(true);
    },
    slowIds,
  };

  // Mobile head kebab (below 34rem the desktop Write-for strip yields to this menu): every profile is
  // a picker row, the active one marked ● in the house on/off idiom - the phase picker's lens honesty
  // stays reachable on the phone.
  const mobileMenu: MobileMenuItem[] = REGEX_WRITE_FOR_PROFILES.map((p) => ({
    label: `${writeFor === p ? "● " : "○ "}Writing for: ${REGEX_WRITE_FOR_LABELS[p]}`,
    onPick: () => setWriteFor(p),
  }));

  return (
    <div
      className={styles.root}
      style={piece.accent ? ({ "--a": piece.accent } as CSSProperties) : undefined}
    >
      {/* mobile head: below 34rem the desktop header hides and this thumb-sized back / name / save /
          kebab takes over (design/vs-regex-shelf-gallery wire 3, the registry MobileEditorHead) */}
      <div className={styles.mHeadGate}>
        <MobileEditorHead
          name={session.body.name || "Untitled regex set"}
          sub={`regex set · ${saving ? "saving…" : dirty ? "unsaved changes" : "saved"}`}
          dirty={dirty}
          saving={saving}
          onBack={() => ctx.workbench.remove(piece.id, piece.kind)}
          onSave={() => void doSave()}
          menu={mobileMenu}
        />
      </div>

      {/* header: spine chip + write-for strip + save */}
      <header className={styles.ehead}>
        <div className={styles.spine}>
          <span className={styles.spineMark}>{monogram}</span>
          <div className={styles.spineText}>
            <input
              className={styles.spineName}
              value={session.body.name}
              placeholder="Untitled regex set"
              aria-label="Set name"
              onChange={(e) => setSession((s) => updateSet(s, { name: e.target.value }))}
            />
            <span className={styles.spineMeta}>
              {count} rule{count === 1 ? "" : "s"} · {enabledCount} on · regex set
            </span>
          </div>
        </div>
        <span className={styles.eheadActs}>
          <WriteForStrip
            profiles={REGEX_WRITE_FOR_PROFILES}
            labels={REGEX_WRITE_FOR_LABELS}
            value={writeFor}
            onChange={setWriteFor}
          />
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

      {/* mobile contents bar: the TOC leaves the flow below 34rem. Hidden while the bench is open so
          the full-screen takeover (page hidden at 34rem) isn't steered by a pager for an invisible
          page (design/vs-regex-shelf-gallery wire 3, bench frame carries no Contents/pager bar). */}
      {!benchOpen && (
      <div className={styles.mBar}>
        <button type="button" className={styles.mContents} onClick={() => setTocOpen(true)}>
          &#9776; Rules
        </button>
        <span className={styles.mPageNo}>{rule ? `${ruleIndex + 1} / ${count}` : "empty"}</span>
        <button
          type="button"
          className={styles.mPg}
          aria-label="Previous rule"
          disabled={!rule || ruleIndex <= 0}
          onClick={() => flip(-1)}
        >
          &#8249;
        </button>
        <button
          type="button"
          className={styles.mPg}
          aria-label="Next rule"
          disabled={!rule || ruleIndex >= count - 1}
          onClick={() => flip(1)}
        >
          &#8250;
        </button>
      </div>
      )}

      {/* toc | page | rail (or the wide test bench beside a slim editor) */}
      <div className={benchOpen || healthOpen || galleryOpen ? `${styles.cols} ${styles.colsBench}` : styles.cols}>
        <div className={styles.tocCol}>
          <RuleToc {...tocProps} />
        </div>

        <main className={styles.pageCol}>
          {!rule ? (
            <div className={styles.empty}>
              This set has no rules yet. Add one from the list to start authoring.
            </div>
          ) : (
            <RulePage
              key={rule.id}
              rule={rule}
              rules={session.body.rules}
              writeFor={writeFor}
              index={ruleIndex}
              count={count}
              styles={styles}
              onPrev={() => flip(-1)}
              onNext={() => flip(1)}
              onPatch={(patch) => setSession((s) => updateRule(s, rule.id, patch))}
              onDuplicate={() => setSession((s) => duplicateRule(s, rule.id))}
              onDelete={() => {
                setSession((s) => deleteRule(s, rule.id));
                ctx.setStatus(`deleted "${rule.label.trim() || "the rule"}" - save to keep`);
              }}
            />
          )}
        </main>

        <div className={styles.railCol}>
          {galleryOpen ? (
            <GalleryPane
              onPick={(entry) => {
                setSession((s) => addRuleFrom(s, (id, sortOrder) => templateToRule(entry, id, sortOrder)));
                setGalleryOpen(false);
                ctx.setStatus(`added "${entry.name}" - save to keep`);
              }}
              onStartBlank={() => {
                setSession((s) => addRule(s));
                setGalleryOpen(false);
              }}
              onClose={() => setGalleryOpen(false)}
            />
          ) : benchOpen ? (
            <BenchPane
              ctx={ctx}
              rules={session.body.rules}
              onClose={() => setBenchOpen(false)}
              onImportPicked={appendImported}
            />
          ) : healthOpen ? (
            <HealthPane
              findings={findings}
              rules={session.body.rules}
              onClose={() => setHealthOpen(false)}
              onGoTo={(id) => setSession((s) => selectRule(s, id))}
              onFix={applyFix}
            />
          ) : (
            rule && (
              <RuleRail
                rule={rule}
                styles={styles}
                findings={findingsForRule(findings, rule.id)}
                onOpenBench={() => {
                  setHealthOpen(false);
                  setBenchOpen(true);
                }}
                onOpenHealth={() => {
                  setBenchOpen(false);
                  setHealthOpen(true);
                }}
              />
            )
          )}
        </div>
      </div>

      {/* mobile contents sheet: same TOC, docked to the pane bottom */}
      {tocOpen && (
        <div className={styles.mGate}>
          <BottomSheet title="Rules" onDismiss={() => setTocOpen(false)}>
            <RuleToc
              {...tocProps}
              onSelect={(id) => {
                tocProps.onSelect(id);
                setTocOpen(false);
              }}
            />
          </BottomSheet>
        </div>
      )}
    </div>
  );
}
