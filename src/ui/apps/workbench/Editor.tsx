/**
 * The character editor pane - vs-editor-2 TRANSCRIBED (the locked wireframe): multi-select
 * platform tabs whose lens dims/hides what no selected platform carries (computed from
 * /api/coverage data - this file names no platform), completion chips, Grid|Steps dual mode over
 * one draft, and the bento of cards (identity + casting + reorderable prose + greetings rows +
 * signature colors + palette + background + spotlight). RC bones, Vaude skin.
 *
 * Layout adaptation, stated: the wireframe's LEFT column (portrait/variants) is PieceFrame's art
 * column in this shell, so the bento here is center + right; the portrait card's lens entry stays
 * registered for steps/completion. Deferred with honesty: palette EDITING (swatches render
 * read-only), per-field AI affordances (brain milestone), the action rail beyond Save.
 *
 * One instance stays mounted per open piece (hidden, not unmounted): its React state IS the
 * unsaved draft. The draft is the WHOLE body (writePath immutable ops), so saving round-trips
 * every untouched field - the no-data-loss law, pinned in editor-core tests.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { AppContext, CoverageInfo } from "../../app-contract";
import { BentoCard } from "../../components/bento-card";
import { PlatformTabs, type OffTarget } from "../../components/platform-tabs";
import { normalizeHex } from "../../_shared/color-math";
import {
  completionOf,
  deepEq,
  EDITOR_CARDS,
  KNOWN_FIELD_ORDER,
  lensVerdict,
  moveCard,
  readPath,
  reconcileOrder,
  STEP_ORDER,
  writePath,
  type EditorCard,
  type StepId,
} from "./editor-core";
import { fieldsFor } from "./inspect-core";
import styles from "./Editor.module.css";
import roomStyles from "./styles.module.css";

const PREF_TARGETS = "editor.targets";
const PREF_OFF_TARGET = "editor.offTarget";

const PROSE_IDS = ["description", "personality", "scenario", "firstMes", "mesExample"] as const;
const PROSE_MONO = new Set(["firstMes", "mesExample"]);
const RENDERED_ORDER_IDS = new Set([...PROSE_IDS, "alternateGreetings"]);

/** spoiler rows offered by the spotlight card (canonical spoilers.fields is an open map) */
const SPOTLIGHT_FIELDS: ReadonlyArray<readonly [key: string, label: string]> = [
  ["description", "Description"],
  ["personality", "Personality"],
  ["scenario", "Scenario"],
  ["firstMessage", "First Message"],
  ["creatorNotes", "From the Creator"],
  ["systemPrompt", "System Prompt"],
];

/** inspector labels the editor writes; the read-only tail shows everything else */
const COVERED_LABELS = new Set([
  "tagline", "description", "personality", "scenario", "first message", "example messages",
  "full name", "title", "age", "pronouns", "tags", "rating",
]);

const rec = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

interface Greeting {
  text: string;
  title?: string;
}
const greetingsOf = (draft: unknown): Greeting[] => {
  const raw = readPath(draft, "greetings.alternateGreetings");
  if (!Array.isArray(raw)) return [];
  return raw.map((g) => ({ text: str(rec(g).text), title: str(rec(g).title) || undefined }));
};

const cardById = new Map(EDITOR_CARDS.map((c) => [c.id, c]));

export interface CharacterEditorProps {
  /** the fetched entity (summary fields + canonical body) - fetched once by the caller */
  entity: unknown;
  ctx: AppContext;
}

/** Build the writable pane for one canonical character (the vs-editor-2 surface). */
export function CharacterEditor({ entity, ctx }: CharacterEditorProps): JSX.Element {
  const [init] = useState(() => {
    const ent = rec(entity);
    const baseline = structuredClone(rec(ent.body));
    const savedOrder = rec(baseline.presentation).fieldOrder;
    return {
      ent,
      baseline,
      hadOrder: Array.isArray(savedOrder) && savedOrder.length > 0,
      order: reconcileOrder(savedOrder),
    };
  });
  const [baseline, setBaseline] = useState(init.baseline);
  const [draft, setDraft] = useState(init.baseline);
  const [order, setOrder] = useState(init.order);
  const orderBaselineRef = useRef(init.order);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"grid" | "steps">("grid");
  const [step, setStep] = useState<StepId>("casting");
  const [coverage, setCoverage] = useState<CoverageInfo[]>([]);
  const [targets, setTargets] = useState<string[]>(() => strArr(ctx.prefs.get(PREF_TARGETS)));
  const [offTarget, setOffTarget] = useState<OffTarget>(() =>
    ctx.prefs.get(PREF_OFF_TARGET) === "hide" ? "hide" : "dim",
  );

  useEffect(() => {
    void ctx.api.coverage().then(setCoverage).catch(() => setCoverage([]));
    // mount-once: coverage claims change only when formats change (a rebuild), never mid-session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderDirty = JSON.stringify(order) !== JSON.stringify(orderBaselineRef.current);
  const dirty = orderDirty || !deepEq(draft, baseline);
  const setField = (path: string, value: unknown): void => setDraft((d) => writePath(d, path, value));
  const text = (path: string): string => str(readPath(draft, path));

  const platformLabel = useCallback(
    (id: string): string => {
      const hit = coverage.find((c) => c.id === id);
      if (!hit) return id;
      // "SillyTavern character card (...)" -> the platform word is the honest short label
      return hit.label.split(" ")[0] ?? id;
    },
    [coverage],
  );
  const verdictOf = (card: EditorCard): { off: boolean; missing: string[] } => {
    const v = lensVerdict(card.paths, targets, coverage);
    return { off: v.off, missing: v.missing.map(platformLabel) };
  };

  const done = completionOf(draft);
  const lensClean = targets.length > 0 && EDITOR_CARDS.every((c) => lensVerdict(c.paths, targets, coverage).missing.length === 0);

  const doSave = useCallback(async (): Promise<void> => {
    if (saving || !dirty) return;
    const name = text("identity.name").trim();
    if (!name) {
      ctx.setStatus("a name is required before saving");
      return;
    }
    setSaving(true);
    try {
      let newBody = draft;
      if (init.hadOrder || JSON.stringify(order) !== JSON.stringify(KNOWN_FIELD_ORDER)) {
        newBody = writePath(newBody, "presentation.fieldOrder", [...order]);
      }
      await ctx.api.saveEntity({ ...init.ent, body: newBody });
      setBaseline(structuredClone(newBody));
      setDraft(newBody);
      orderBaselineRef.current = [...order];
      ctx.setStatus(`${name} saved`);
    } catch (e) {
      ctx.setStatus(`save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
    // text() closes over draft, which the deps carry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, dirty, draft, init.ent, init.hadOrder, order, saving]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); // the shell owns no save; without this the browser offers to save the page
        void doSave();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (dirty) e.preventDefault(); // the standard unsaved-changes prompt
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [doSave, dirty]);

  const toggleTarget = (id: string): void => {
    setTargets((prev) => {
      const next = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id];
      ctx.prefs.set(PREF_TARGETS, next);
      return next;
    });
  };
  const pickOffTarget = (m: OffTarget): void => {
    setOffTarget(m);
    ctx.prefs.set(PREF_OFF_TARGET, m);
  };

  // -- card bodies -----------------------------------------------------------------------------------

  const identityBody = (
    <>
      <label className={styles.k}>name</label>
      <input className={styles.in} value={text("identity.name")} onChange={(e) => setField("identity.name", e.target.value)} />
      <label className={styles.k}>tagline</label>
      <input className={styles.in} value={text("identity.tagline")} onChange={(e) => setField("identity.tagline", e.target.value)} />
      <label className={styles.k}>tags</label>
      <div className={styles.tags}>
        {strArr(readPath(draft, "discovery.tags")).map((tag) => (
          <button
            key={tag}
            type="button"
            className={styles.tag}
            title={`Remove tag ${tag}`}
            onClick={() => setField("discovery.tags", strArr(readPath(draft, "discovery.tags")).filter((t) => t !== tag))}
          >
            {tag} <i>x</i>
          </button>
        ))}
        <input
          className={styles.tagIn}
          placeholder="+ tag, enter"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const value = e.currentTarget.value.trim();
            if (!value) return;
            const cur = strArr(readPath(draft, "discovery.tags"));
            if (!cur.includes(value)) setField("discovery.tags", [...cur, value]);
            e.currentTarget.value = "";
          }}
        />
      </div>
      <label className={styles.k}>content rating</label>
      <select
        className={styles.in}
        value={text("discovery.rating") || ""}
        onChange={(e) => setField("discovery.rating", e.target.value)}
      >
        <option value="">unrated</option>
        <option value="all-ages">all ages</option>
        <option value="mature">mature</option>
        <option value="explicit">explicit</option>
      </select>
    </>
  );

  const castingBody = (
    <div className={styles.idGrid}>
      {(
        [
          ["identity.fullName", "full name / legal name"],
          ["identity.title", "title / epithet"],
          ["identity.age", "age"],
          ["identity.pronouns", "pronouns"],
        ] as const
      ).map(([path, label]) => (
        <div className={styles.field} key={path}>
          <span className={styles.k}>{label}</span>
          <input className={styles.in} value={text(path)} onChange={(e) => setField(path, e.target.value)} />
        </div>
      ))}
    </div>
  );

  const proseBody = (id: string, path: string): JSX.Element => {
    const value = text(path);
    return (
      <>
        <textarea
          className={`${styles.ta}${PROSE_MONO.has(id) ? ` ${styles.mono}` : ""}`}
          spellCheck={false}
          value={value}
          onChange={(e) => setField(path, e.target.value)}
        />
        <span className={styles.cnt}>{`${value.length} chars`}</span>
      </>
    );
  };

  const greetings = greetingsOf(draft);
  const setGreetings = (rows: Greeting[]): void =>
    setField(
      "greetings.alternateGreetings",
      rows.filter((g) => g.text !== "" || (g.title ?? "") !== ""),
    );
  const greetingsBody = (
    <>
      {greetings.map((g, i) => (
        <div className={styles.greetRow} key={i}>
          <div className={styles.greetHead}>
            <input
              className={styles.in}
              placeholder="optional title"
              value={g.title ?? ""}
              onChange={(e) => setGreetings(greetings.map((x, j) => (j === i ? { ...x, title: e.target.value || undefined } : x)))}
            />
            <button type="button" className={styles.rm} onClick={() => setGreetings(greetings.filter((_, j) => j !== i))}>
              remove
            </button>
          </div>
          <textarea
            className={`${styles.ta} ${styles.mono}`}
            spellCheck={false}
            value={g.text}
            onChange={(e) => setGreetings(greetings.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
          />
        </div>
      ))}
      <button type="button" className={styles.add} onClick={() => setGreetings([...greetings, { text: "" }])}>
        + add a greeting
      </button>
    </>
  );

  const gradient = strArr(readPath(draft, "presentation.gradientColors"));
  const gradientBody = (
    <>
      <span className={styles.hint}>up to 3 colors for the gradient accent</span>
      <div className={styles.gradRow}>
        {[0, 1, 2].map((i) => (
          <span className={styles.gradSlot} key={i}>
            <span className={styles.swatch} style={{ background: gradient[i] ?? "transparent" }} />
            <input
              className={styles.hexIn}
              placeholder="#hex"
              value={gradient[i] ?? ""}
              onChange={(e) => {
                const next = [...gradient];
                const norm = normalizeHex(e.target.value);
                if (e.target.value === "") next.splice(i, 1);
                else next[i] = norm ?? e.target.value;
                setField("presentation.gradientColors", next.filter(Boolean).slice(0, 3));
              }}
            />
          </span>
        ))}
      </div>
    </>
  );

  const palette = ((): { label?: string; name?: string; hex: string }[] => {
    const raw = readPath(draft, "presentation.palette");
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => rec(s)).filter((s) => typeof s.hex === "string") as { label?: string; name?: string; hex: string }[];
  })();
  const paletteBody = (
    <>
      <div className={styles.palRow}>
        {palette.length === 0 && <span className={styles.hint}>no palette on this card yet</span>}
        {palette.map((s, i) => (
          <span className={styles.palSwatch} key={i}>
            <span className={styles.swatch} style={{ background: s.hex }} />
            <i>{s.label ?? s.name ?? s.hex}</i>
          </span>
        ))}
      </div>
      <span className={styles.hint}>palette editing lands next slice; shown honestly meanwhile</span>
    </>
  );

  const backgroundBody = (
    <>
      <label className={styles.k}>background ref / url</label>
      <input
        className={styles.in}
        placeholder="applied when starting a chat"
        value={text("presentation.background.ref")}
        onChange={(e) => setField("presentation.background.ref", e.target.value)}
      />
    </>
  );

  const spoilFields = rec(readPath(draft, "presentation.spoilers.fields"));
  const spotlightBody = (
    <>
      {SPOTLIGHT_FIELDS.map(([key, label]) => {
        const on = spoilFields[key] === true;
        return (
          <div className={styles.spoilRow} key={key}>
            <span>{label}</span>
            <button
              type="button"
              className={`${styles.spoil}${on ? ` ${styles.spoilOn}` : ""}`}
              onClick={() => setField("presentation.spoilers.fields", { ...spoilFields, [key]: !on })}
            >
              {on ? "SPOILERED" : "visible"}
            </button>
          </div>
        );
      })}
    </>
  );

  const bodyFor = (id: string): JSX.Element | null => {
    switch (id) {
      case "identity": return identityBody;
      case "casting": return castingBody;
      case "alternateGreetings": return greetingsBody;
      case "gradient": return gradientBody;
      case "palette": return paletteBody;
      case "background": return backgroundBody;
      case "spotlight": return spotlightBody;
      case "description": return proseBody(id, "identity.description");
      case "personality": return proseBody(id, "persona.personality");
      case "scenario": return proseBody(id, "persona.scenario");
      case "firstMes": return proseBody(id, "greetings.firstMessage");
      case "mesExample": return proseBody(id, "examples.exampleMessages");
      default: return null; // portrait: PieceFrame's art column IS that card in this shell
    }
  };

  const renderCard = (card: EditorCard, movable: boolean): JSX.Element | null => {
    const body = bodyFor(card.id);
    if (body === null) return null;
    const v = verdictOf(card);
    const filled = card.paths.some((p) => {
      const val = readPath(draft, p);
      return val !== undefined && val !== "" && !(Array.isArray(val) && val.length === 0);
    });
    return (
      <BentoCard
        key={card.id}
        title={card.label}
        filled={filled}
        off={v.off}
        offMode={offTarget}
        missing={v.missing}
        onMove={movable ? (dir) => setOrder((prev) => moveCard(prev, card.id, dir, RENDERED_ORDER_IDS)) : undefined}
      >
        {body}
      </BentoCard>
    );
  };

  const centerOrdered: JSX.Element[] = [
    renderCard(cardById.get("identity")!, false),
    renderCard(cardById.get("casting")!, false),
    ...order.map((id) => (RENDERED_ORDER_IDS.has(id) ? renderCard(cardById.get(id)!, true) : null)),
    renderCard(cardById.get("gradient")!, false),
  ].filter((el): el is JSX.Element => el !== null);
  const rightCards = EDITOR_CARDS.filter((c) => c.region === "right")
    .map((c) => renderCard(c, false))
    .filter((el): el is JSX.Element => el !== null);

  const stepCards = EDITOR_CARDS.filter((c) => c.step === step)
    .map((c) => renderCard(c, false))
    .filter((el): el is JSX.Element => el !== null);
  const stepIndex = STEP_ORDER.indexOf(step);

  const tail = fieldsFor("character", draft).filter((f) => !COVERED_LABELS.has(f.k) && !f.k.startsWith("alt greeting"));

  return (
    <div className={styles.root}>
      <PlatformTabs
        platforms={coverage.map((c) => ({ id: c.id, label: platformLabel(c.id) }))}
        selected={targets}
        onToggle={toggleTarget}
        onClear={() => {
          setTargets([]);
          ctx.prefs.set(PREF_TARGETS, []);
        }}
        offTarget={offTarget}
        onOffTarget={pickOffTarget}
      />

      <div className={styles.chips}>
        {(
          [
            ["Portrait", done.portrait],
            ["Name", done.name],
            ["Core Prompts", done.corePrompts],
            ["Greeting", done.greeting],
            ["Tags", done.tags],
            ["Lens Check", lensClean],
          ] as const
        ).map(([label, ok]) => (
          <span key={label} className={`${styles.chip}${ok ? ` ${styles.chipOk}` : ""}`}>
            {label}
          </span>
        ))}
      </div>

      <div className={styles.bar}>
        <span className={styles.seg}>
          <button type="button" className={mode === "grid" ? styles.on : undefined} onClick={() => setMode("grid")}>
            Grid
          </button>
          <button type="button" className={mode === "steps" ? styles.on : undefined} onClick={() => setMode("steps")}>
            Steps
          </button>
        </span>
        <button type="button" className={styles.save} disabled={saving || !dirty} onClick={() => void doSave()}>
          Save
        </button>
        <span className={`${styles.flag}${dirty ? ` ${styles.on}` : ""}`}>
          <span className={styles.flagDot} />
          {dirty ? "unsaved changes" : "saved"}
        </span>
      </div>

      {mode === "grid" ? (
        <div className={styles.bento}>
          <div className={styles.col}>{centerOrdered}</div>
          <div className={styles.col}>{rightCards}</div>
        </div>
      ) : (
        <div className={styles.col}>
          <div className={styles.stepRail}>
            {STEP_ORDER.map((s, i) => (
              <button
                key={s}
                type="button"
                className={`${styles.stepTab}${s === step ? ` ${styles.on}` : ""}`}
                onClick={() => setStep(s)}
              >
                {`${i + 1} ${s}`}
              </button>
            ))}
          </div>
          {stepCards}
          <div className={styles.stepNav}>
            <button type="button" disabled={stepIndex === 0} onClick={() => setStep(STEP_ORDER[stepIndex - 1]!)}>
              back
            </button>
            <button
              type="button"
              disabled={stepIndex === STEP_ORDER.length - 1}
              onClick={() => setStep(STEP_ORDER[stepIndex + 1]!)}
            >
              next
            </button>
          </div>
        </div>
      )}

      {tail.length > 0 && (
        <div className={styles.col}>
          {tail.map((f) => (
            <div className={roomStyles.field} key={f.k}>
              <div className={roomStyles.fk}>{f.k}</div>
              <div className={roomStyles.fv}>{f.v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
