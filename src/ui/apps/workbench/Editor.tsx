/**
 * The character editor pane - vs-editor-2 TRANSCRIBED 1:1 (the locked wireframe): tab strip
 * (platform tabs + completion chips right), header row (close square + NAME + version chip left;
 * Grid|Steps + save state right), then the THREE-column bento: the portrait card (dashed frame,
 * variants strip, name + token/edited meta, Change Image / Manage Sprites stamps), the prompts
 * center, the utilities right. Lens verdicts come from /api/coverage data via editor-core
 * lensVerdict - this file names zero platforms. Wired-shut affordances (tagsheet, auto-tag, AI
 * wand/convert, image/sprite management) render exactly where the wireframe drew them, disabled
 * with their milestone named.
 *
 * One instance stays mounted per open piece (hidden, not unmounted): its React state IS the
 * unsaved draft. The draft is the WHOLE body (writePath immutable ops), so saving round-trips
 * every untouched field - the no-data-loss law, pinned in editor-core tests.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, JSX, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { AppContext, CoverageInfo, StudioEntitySummary } from "../../app-contract";
import { BentoCard } from "../../components/bento-card";
import { PlatformTabs, type OffTarget } from "../../components/platform-tabs";
import { categorizeTag, type TagCategory } from "../../../core/tag-taxonomy";
import { ColorPicker } from "../../components/color-picker";
import { RenderBox } from "../../components/render-box";
import { normalizeHex } from "../../_shared/color-math";
import {
  completionOf,
  deepEq,
  EDITOR_CARDS,
  KNOWN_FIELD_ORDER,
  lensVerdict,
  readPath,
  reconcileOrder,
  writePath,
  type LensVerdict,
} from "./editor-core";
import { FIELD_MODULES, type FieldModule, type SubField } from "./fields";
import { signatureFromPng } from "../../../studio/signature-color";
import styles from "./Editor.module.css";

const PREF_TARGETS = "editor.targets";
const PREF_OFF_TARGET = "editor.offTarget";
const PREF_EDITOR_SCALE = "editor.scale";
const PREF_EDITOR_LAYOUT = "editor.layout";
const SCALE_MIN = 0.5;
const SCALE_MAX = 2;
const SCALE_STEP = 0.1;

/** tolerant reader for the app-wide editor scale (out-of-range or malformed drops to 1). */
const parseScale = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0.5 && v <= 2 ? v : 1;

const PROSE_MONO = new Set(["firstMes", "mesExample"]);

/** MediaAsset.role choices for the asset gallery (mirrors the canonical MediaAsset role union). */
const ASSET_ROLES: readonly string[] = ["portrait", "emotion", "outfit", "pose", "background", "other"];

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
const rec = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

interface Greeting {
  text: string;
  title?: string;
}
const greetingsOf = (draft: unknown, path: string): Greeting[] => {
  const raw = readPath(draft, path);
  if (!Array.isArray(raw)) return [];
  return raw.map((g) => ({ text: str(rec(g).text), title: str(rec(g).title) || undefined }));
};

/** honest rough size: prose chars / 4, labeled "~tokens" (a real tokenizer is macro-layer work) */
function tokenEstimate(draft: unknown): number {
  const paths = ["identity.description", "persona.personality", "persona.scenario", "greetings.firstMessage", "examples.exampleMessages", "prompts.systemPrompt"];
  const chars = paths.reduce((n, p) => n + str(readPath(draft, p)).length, 0);
  return Math.round(chars / 4);
}

/** a smaller line glyph for tag chips (11px, sits before the tag text) */
const tglyph = (children: ReactNode): JSX.Element => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
/** presentation for each tag category: RC-style base color + a line icon. Categorization itself is
 * pure core (categorizeTag); this map is the UI's read of the result. */
const TAG_CATEGORY_STYLE: Record<TagCategory, { color: string; icon: JSX.Element }> = {
  identity: { color: "#22d3ee", icon: tglyph(<><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" /></>) },
  trait: { color: "#a78bfa", icon: tglyph(<path d="M12 3l2.4 6H21l-5 4 1.9 6-5.9-4-5.9 4 1.9-6-5-4h6.6z" />) },
  role: { color: "#fb7185", icon: tglyph(<><rect x="3" y="7" width="18" height="13" rx="1" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>) },
  genre: { color: "#818cf8", icon: tglyph(<><path d="M12 6c-2-1.4-5-1.4-7 0v12c2-1.4 5-1.4 7 0 2-1.4 5-1.4 7 0V6c-2-1.4-5-1.4-7 0z" /><path d="M12 6v12" /></>) },
  theme: { color: "#f472b6", icon: tglyph(<path d="M7 4h10v16l-5-4-5 4z" />) },
  setting: { color: "#34d399", icon: tglyph(<><path d="M12 21s-6-5-6-10a6 6 0 0 1 12 0c0 5-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>) },
  pov: { color: "#38bdf8", icon: tglyph(<><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></>) },
  mood: { color: "#fbbf24", icon: tglyph(<><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4 4 0 0 0 7 0M9 10h.01M15 10h.01" /></>) },
  kink: { color: "#f87171", icon: tglyph(<path d="M12 3s5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.2 2-4 .4 2 3 1.6 3-5z" />) },
  warning: { color: "#fb923c", icon: tglyph(<><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>) },
  meta: { color: "#94a3b8", icon: tglyph(<path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />) },
};

export interface CharacterEditorProps {
  /** the fetched entity (summary fields + canonical body) - fetched once by the caller */
  entity: unknown;
  ctx: AppContext;
  piece: StudioEntitySummary;
  /** room chrome hoisted into the editor's own tab strip (the focus toggle) - no crumb bar exists */
  topRight?: ReactNode;
}

/** Build the writable pane for one canonical character (the vs-editor-2 surface, 1:1). */
export function CharacterEditor({ entity, ctx, piece, topRight }: CharacterEditorProps): JSX.Element {
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
  const [order] = useState(init.order);
  const orderBaselineRef = useRef(init.order);
  const [saving, setSaving] = useState(false);
  // Quiz is the default presenter; Grid (the bento) is the power view. The toggle in the header
  // switches between them - both pure views over the same draft.
  const [mode, setMode] = useState<"grid" | "interview">("interview");
  const [flowIndex, setFlowIndex] = useState(0); // how many questions the guided flow has revealed
  const activeCardRef = useRef<HTMLDivElement>(null);

  // drag-resizable split between the question card and the stage (the user sets the balance)
  const [splitPct, setSplitPct] = useState(42);
  const quizRef = useRef<HTMLDivElement>(null);
  const onSplitDown = (e: ReactPointerEvent): void => {
    e.preventDefault();
    const move = (ev: PointerEvent): void => {
      const el = quizRef.current;
      if (el === null) return;
      const r = el.getBoundingClientRect();
      const pct = ((ev.clientX - r.left) / r.width) * 100;
      setSplitPct(Math.max(24, Math.min(72, pct)));
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flowIndex]);

  // the character's own accent, derived from its portrait art (signatureColor), lights the stage.
  // Client-side decode: the portrait bytes are fetched once and reduced to one hue; failure = no color.
  const [artAccent, setArtAccent] = useState<string | null>(null);
  useEffect(() => {
    if (!piece.hasPortrait) {
      setArtAccent(null);
      return;
    }
    let cancelled = false;
    const url = `/api/studio/portrait?kind=${encodeURIComponent(piece.kind)}&id=${encodeURIComponent(piece.id)}`;
    void (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const color = signatureFromPng(new Uint8Array(await res.arrayBuffer()));
        if (!cancelled && color !== null) setArtAccent(color);
      } catch {
        // no accent; the stage falls back to the house accent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [piece.id, piece.kind, piece.hasPortrait]);
  const [coverage, setCoverage] = useState<CoverageInfo[]>([]);
  const [targets, setTargets] = useState<string[]>(() => strArr(ctx.prefs.get(PREF_TARGETS)));
  const [offTarget, setOffTarget] = useState<OffTarget>(() =>
    ctx.prefs.get(PREF_OFF_TARGET) === "hide" ? "hide" : "dim",
  );
  // editor-wide content scale, remembered APP-WIDE (prefs, same as targets): sizes the grid/quiz
  // content up or down. Persists across characters, presenters, and fullscreen; 1 = default.
  const [editorScale, setEditorScaleState] = useState<number>(() => parseScale(ctx.prefs.get(PREF_EDITOR_SCALE)));
  // the ref holds the live scale so rapid +/- clicks accumulate from the latest value, not a stale
  // render's (two quick clicks would otherwise both read the same number and lose a step).
  const scaleRef = useRef(editorScale);
  const setEditorScale = (next: number): void => {
    const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(next * 100) / 100));
    scaleRef.current = clamped;
    setEditorScaleState(clamped);
    ctx.prefs.set(PREF_EDITOR_SCALE, clamped);
  };
  const stepScale = (dir: -1 | 1): void => setEditorScale(scaleRef.current + dir * SCALE_STEP);
  // which grid-mode layout: the Bento (default) or the Playbill. Remembered app-wide; both are pure
  // views over FIELD_MODULES, selectable here and in Settings.
  const [editorLayout, setEditorLayoutState] = useState<"bento" | "playbill">(() =>
    ctx.prefs.get(PREF_EDITOR_LAYOUT) === "playbill" ? "playbill" : "bento",
  );
  const setEditorLayout = (l: "bento" | "playbill"): void => {
    setEditorLayoutState(l);
    ctx.prefs.set(PREF_EDITOR_LAYOUT, l);
  };
  const [palSel, setPalSel] = useState(0); // which palette swatch the inline picker edits
  const [gradSel, setGradSel] = useState(0); // which gradient stop the inline picker edits

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
      return hit ? (hit.label.split(" ")[0] ?? id) : id;
    },
    [coverage],
  );
  const done = completionOf(draft);
  const lensClean = targets.length > 0 && EDITOR_CARDS.every((c) => lensVerdict(c.paths, targets, coverage).missing.length === 0);
  const chips = [
    ["Portrait", done.portrait],
    ["Name", done.name],
    ["Core Prompts", done.corePrompts],
    ["Greeting", done.greeting],
    ["Tags", done.tags],
    ["Lens Check", lensClean],
  ] as const;
  const doneCount = chips.filter(([, ok]) => ok).length;

  const doSave = useCallback(async (): Promise<void> => {
    if (saving || !dirty) return;
    const name = str(readPath(draft, "identity.name")).trim();
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
  }, [ctx, dirty, draft, init.ent, init.hadOrder, order, saving]);

  // the shell tab wears THE dirty dot (row-3's "saved locally" pill is dead - one indicator, one
  // home). ctx stays OUT of these deps: it is a stable adapter whose identity churns on every
  // store write, and identity-retriggered writers are how the status ping-pong loop was born.
  useEffect(() => {
    ctx.workbench.setDirty(piece.id, piece.kind, dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, piece.id, piece.kind]);

  // completion reports in the STATUS BAR (passive status does not rent space in a control row);
  // only what is MISSING is worth words
  const missingChips = chips.filter(([, ok]) => !ok).map(([label]) => label.toLowerCase()).join(" · ");
  useEffect(() => {
    ctx.setStatus(missingChips === "" ? `${doneCount}/${chips.length} · piece complete` : `${doneCount}/${chips.length} · needs ${missingChips}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount, missingChips]);

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

  // -- left column: the portrait card (wireframe 1:1) ------------------------------------------------

  const artUrl = piece.hasPortrait
    ? `/api/studio/portrait?kind=${encodeURIComponent(piece.kind)}&id=${encodeURIComponent(piece.id)}`
    : null;
  const assets = ((): { label: string }[] => {
    const raw = readPath(draft, "media.assets");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((a) => rec(a))
      .filter((a) => a.role !== "portrait")
      .slice(0, 2)
      .map((a) => ({ label: str(a.label) || str(a.name) || "asset" }));
  })();
  const updatedAt = ((): string | null => {
    const t = readPath(draft, "attribution.updatedAt");
    return typeof t === "number" && Number.isFinite(t) ? new Date(t * 1000).toLocaleDateString() : null;
  })();

  const leftCard = (
    <section className={styles.lcard}>
      <div className={styles.portrait}>
        {artUrl ? <img src={artUrl} alt="" /> : <b>{(text("identity.name") || piece.name).charAt(0).toUpperCase()}</b>}
      </div>
      <div className={styles.variants}>
        <span className={`${styles.varThumb} ${styles.varOn}`} style={artUrl ? { backgroundImage: `url("${artUrl}")` } : undefined}>
          <i>Base</i>
        </span>
        {assets.map((a, i) => (
          <span className={styles.varThumb} key={i}>
            <i>{a.label}</i>
          </span>
        ))}
        <button type="button" className={styles.varAdd} disabled title="Alternate art variants land with the media milestone">
          +
        </button>
      </div>
      <div className={styles.lmeta}>
        <b>{(text("identity.name") || piece.name).toUpperCase()}</b>
        <div className={styles.lsub}>
          {piece.sourceVariant !== undefined && `${piece.sourceVariant} · `}
          {`~${tokenEstimate(draft)} tokens`}
          {updatedAt !== null && ` · last edited ${updatedAt}`}
        </div>
      </div>
      <div className={styles.btnrow}>
        <button type="button" className={styles.stampBtn} disabled title="Image management lands with the media milestone">
          Change Image
        </button>
        <button type="button" className={styles.stampBtn} disabled title="Sprites land with the media milestone">
          Manage Sprites
        </button>
      </div>
    </section>
  );

  // -- field controls --------------------------------------------------------------------------------

  // extracted so BOTH the grid's identity card and the Interview/Callsheet presenters render the one
  // tags editor and the one rating control - a field module and a bento card call the same JSX.
  const tagsControl = (
    <>
      <div className={styles.tagbar}>
        <button type="button" className={styles.tagsheet} disabled title="The tagsheet taxonomy lands with the discovery milestone">
          Open Tagsheet
        </button>
        <button type="button" className={styles.autotag} disabled title="Auto-tag lands with the brain milestone">
          Auto-tag
        </button>
      </div>
      <label className={styles.k}>{`selected tags (${strArr(readPath(draft, "discovery.tags")).length})`}</label>
      <div className={styles.tags}>
        {strArr(readPath(draft, "discovery.tags")).map((tag) => {
          const cs = TAG_CATEGORY_STYLE[categorizeTag(tag)];
          return (
            <button
              key={tag}
              type="button"
              className={styles.tag}
              style={{ color: cs.color, borderColor: `${cs.color}80`, background: `${cs.color}1f` }}
              title={`Remove tag ${tag}`}
              onClick={() => setField("discovery.tags", strArr(readPath(draft, "discovery.tags")).filter((t) => t !== tag))}
            >
              <span className={styles.tagIco}>{cs.icon}</span>
              {tag} <i>x</i>
            </button>
          );
        })}
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
    </>
  );

  const ratingControl = (
    <div className={styles.rating}>
      <div className={styles.ratingRow}>
        <b>CONTENT RATING</b>
        <span className={styles.pill}>{text("discovery.rating") || "unrated"}</span>
        <i>auto-calc lands with the tagsheet</i>
      </div>
      <label className={styles.k}>override</label>
      <select className={styles.in} value={text("discovery.rating") || ""} onChange={(e) => setField("discovery.rating", e.target.value)}>
        <option value="">unrated</option>
        <option value="all-ages">all ages</option>
        <option value="mature">mature</option>
        <option value="explicit">explicit</option>
      </select>
    </div>
  );

  const proseBody = (id: string, path: string): JSX.Element => {
    const value = text(path);
    return (
      <RenderBox value={value} format="markdown">
        <textarea
          className={`${styles.ta}${PROSE_MONO.has(id) ? ` ${styles.mono}` : ""}`}
          spellCheck={false}
          value={value}
          onChange={(e) => setField(path, e.target.value)}
        />
        <span className={styles.cnt}>{`${value.length} chars`}</span>
      </RenderBox>
    );
  };

  // greetings control, bound to a path so alternateGreetings AND groupOnlyGreetings share one editor.
  const greetingsBodyFor = (path: string): JSX.Element => {
    const rows = greetingsOf(draft, path);
    const setRows = (next: Greeting[]): void =>
      setField(path, next.filter((g) => g.text !== "" || (g.title ?? "") !== ""));
    return (
      <>
        {rows.map((g, i) => (
          <div className={styles.greetRow} key={i}>
            <div className={styles.greetHead}>
              <input
                className={styles.in}
                placeholder="optional title"
                value={g.title ?? ""}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value || undefined } : x)))}
              />
              <button type="button" className={styles.rm} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                remove
              </button>
            </div>
            <RenderBox value={g.text} format="markdown">
              <textarea
                className={`${styles.ta} ${styles.mono}`}
                spellCheck={false}
                value={g.text}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              />
            </RenderBox>
          </div>
        ))}
        <button type="button" className={styles.add} onClick={() => setRows([...rows, { text: "" }])}>
          + add a greeting
        </button>
      </>
    );
  };

  const gradient = strArr(readPath(draft, "presentation.gradientColors"));
  const setGradient = (rows: string[]): void =>
    setField("presentation.gradientColors", rows.filter(Boolean).slice(0, 3));
  const gradAt = Math.min(gradSel, Math.max(0, gradient.length - 1));
  // a single color renders solid; two or more blend left to right (a 1-stop gradient is invalid CSS)
  const gradCss = gradient.length < 2 ? (gradient[0] ?? "transparent") : `linear-gradient(90deg, ${gradient.join(", ")})`;
  const gradientBody = (
    <>
      <span className={styles.hint}>up to 3 colors, blended left to right into the accent gradient</span>
      <div className={styles.palGrid}>
        {gradient.map((hex, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.palTile}${i === gradAt ? ` ${styles.palTileOn}` : ""}`}
            onClick={() => setGradSel(i)}
            title={hex}
          >
            <span className={styles.palChip} style={{ background: hex }} />
            <span className={styles.palName}>{hex}</span>
          </button>
        ))}
        {gradient.length < 3 && (
          <button
            type="button"
            className={styles.palAdd}
            onClick={() => {
              const next = [...gradient, "#e11d48"];
              setGradient(next);
              setGradSel(next.length - 1);
            }}
          >
            + add
          </button>
        )}
      </div>
      {gradient.length === 0 ? (
        <span className={styles.hint}>no colors yet - add one to start the gradient</span>
      ) : (
        <>
          <div className={styles.gradBar} style={{ background: gradCss }} />
          <div className={styles.palEdit}>
            <ColorPicker
              value={normalizeHex(gradient[gradAt] ?? "") ?? gradient[gradAt]}
              onChange={(hex) => setGradient(gradient.map((c, i) => (i === gradAt ? hex : c)))}
            />
            <button
              type="button"
              className={styles.rm}
              onClick={() => {
                setGradient(gradient.filter((_, i) => i !== gradAt));
                setGradSel(Math.max(0, gradAt - 1));
              }}
            >
              remove color
            </button>
          </div>
        </>
      )}
    </>
  );

  const palette = ((): { label?: string; name?: string; hex: string }[] => {
    const raw = readPath(draft, "presentation.palette");
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => rec(s)).filter((s) => typeof s.hex === "string") as { label?: string; name?: string; hex: string }[];
  })();
  const setPalette = (rows: { label?: string; name?: string; hex: string }[]): void =>
    setField("presentation.palette", rows.filter((r) => r.hex));
  const palAt = Math.min(palSel, Math.max(0, palette.length - 1));
  const palCur = palette[palAt];
  const paletteBody = (
    <>
      <div className={styles.palGrid}>
        {palette.map((s, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.palTile}${i === palAt ? ` ${styles.palTileOn}` : ""}`}
            onClick={() => setPalSel(i)}
            title={s.name ?? s.label ?? s.hex}
          >
            <span className={styles.palChip} style={{ background: s.hex }} />
            <span className={styles.palName}>{s.name ?? s.label ?? "unnamed"}</span>
          </button>
        ))}
        <button
          type="button"
          className={styles.palAdd}
          onClick={() => {
            const next = [...palette, { name: "", hex: "#e11d48" }];
            setPalette(next);
            setPalSel(next.length - 1);
          }}
        >
          + add
        </button>
      </div>
      {palette.length === 0 ? (
        <span className={styles.hint}>no palette on this card yet - add a swatch to name a signature color</span>
      ) : (
        palCur && (
          <div className={styles.palEdit}>
            <input
              className={styles.in}
              placeholder="Name this swatch (Hair, Eyes, Skin...)"
              value={palCur.name ?? palCur.label ?? ""}
              onChange={(e) => setPalette(palette.map((s, i) => (i === palAt ? { ...s, name: e.target.value } : s)))}
            />
            <ColorPicker
              value={normalizeHex(palCur.hex) ?? palCur.hex}
              onChange={(hex) => setPalette(palette.map((s, i) => (i === palAt ? { ...s, hex } : s)))}
            />
            <button
              type="button"
              className={styles.rm}
              onClick={() => {
                setPalette(palette.filter((_, i) => i !== palAt));
                setPalSel(Math.max(0, palAt - 1));
              }}
            >
              remove swatch
            </button>
          </div>
        )
      )}
    </>
  );

  const bgRef = text("presentation.background.ref");
  const backgroundBody = (
    <>
      {bgRef === "" ? (
        <div className={styles.bgempty}>No default background</div>
      ) : (
        <div className={styles.bgPreview} style={{ backgroundImage: `url("${bgRef}")` }} />
      )}
      <div className={styles.bgrow}>
        <span>Custom URL</span>
        <input
          className={styles.in}
          style={{ maxWidth: "12rem" }}
          placeholder="applied when starting a chat"
          value={bgRef}
          onChange={(e) => setField("presentation.background.ref", e.target.value)}
        />
      </div>
    </>
  );

  const spoilers = rec(readPath(draft, "presentation.spoilers"));
  const spoilFields = rec(spoilers.fields);
  const spoilOrder = ((): string[] => {
    const saved = strArr(spoilers.order).filter((k) => SPOTLIGHT_FIELDS.some(([key]) => key === k));
    const missing = SPOTLIGHT_FIELDS.map(([key]) => key).filter((k) => !saved.includes(k));
    return [...saved, ...missing];
  })();
  const moveSpoil = (key: string, dir: -1 | 1): void => {
    const at = spoilOrder.indexOf(key);
    const to = at + dir;
    if (to < 0 || to >= spoilOrder.length) return;
    const next = [...spoilOrder];
    [next[at], next[to]] = [next[to]!, next[at]!];
    setField("presentation.spoilers", { ...spoilers, order: next });
  };
  const spotlightBody = (
    <>
      {spoilOrder.map((key) => {
        const label = SPOTLIGHT_FIELDS.find(([k]) => k === key)?.[1] ?? key;
        const on = spoilFields[key] === true;
        return (
          <div className={styles.spoilRow} key={key}>
            <span className={styles.ud}>
              <button type="button" onClick={() => moveSpoil(key, -1)} title={`Move ${label} up`}>&#8593;</button>
              <button type="button" onClick={() => moveSpoil(key, 1)} title={`Move ${label} down`}>&#8595;</button>
            </span>
            <span>{label}</span>
            <button
              type="button"
              className={`${styles.spoil}${on ? ` ${styles.spoilOn}` : ""}`}
              onClick={() => setField("presentation.spoilers", { ...spoilers, fields: { ...spoilFields, [key]: !on } })}
            >
              {on ? "SPOILERED" : "visible"}
            </button>
          </div>
        );
      })}
    </>
  );

  // the one control per field kind - reused by every presenter (and, later, by the grid). Composite
  // kinds return the bespoke body already built above; text/prose are generic.
  // one SubField control: value in, new value out. Small and total; reused by the structured-subeditor
  // (object fields) and the list-subeditor (row fields), so a composite never re-implements a control.
  const renderSub = (value: unknown, onChange: (v: unknown) => void, sf: SubField): JSX.Element => {
    switch (sf.kind) {
      case "prose":
        return <textarea className={styles.ta} spellCheck={false} value={str(value)} onChange={(e) => onChange(e.target.value)} />;
      case "number":
        return (
          <input
            className={styles.in}
            type="number"
            step={sf.number?.step}
            min={sf.number?.min}
            max={sf.number?.max}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        );
      case "toggle":
        return (
          <button
            type="button"
            className={`${styles.toggle}${value === true ? ` ${styles.toggleOn}` : ""}`}
            aria-pressed={value === true}
            onClick={() => onChange(value !== true)}
          >
            {value === true ? "On" : "Off"}
          </button>
        );
      case "select":
        return (
          <select className={styles.in} value={str(value)} onChange={(e) => onChange(e.target.value)}>
            {(sf.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      default:
        return <input className={styles.in} placeholder={sf.placeholder} value={str(value)} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  const controlFor = (m: FieldModule): JSX.Element => {
    switch (m.kind) {
      case "text":
        return (
          <input
            className={styles.in}
            placeholder={m.placeholder}
            value={text(m.path)}
            onChange={(e) => setField(m.path, e.target.value)}
          />
        );
      case "prose": return proseBody(m.id, m.path);
      case "tags": return tagsControl;
      case "rating": return ratingControl;
      case "portrait": return leftCard;
      case "gradient": return gradientBody;
      case "palette": return paletteBody;
      case "greetings": return greetingsBodyFor(m.path);
      case "background": return backgroundBody;
      case "spotlight": return spotlightBody;
      case "list": {
        const items = strArr(readPath(draft, m.path));
        return (
          <div className={styles.tags}>
            {items.map((it) => (
              <button
                key={it}
                type="button"
                className={styles.tag}
                style={{ color: "var(--text-dim)", borderColor: "var(--seam)", background: "transparent" }}
                title={`Remove ${it}`}
                onClick={() => setField(m.path, items.filter((x) => x !== it))}
              >
                {it} <i>x</i>
              </button>
            ))}
            <input
              className={styles.tagIn}
              placeholder="+ add, enter"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const v = e.currentTarget.value.trim();
                if (v === "") return;
                if (!items.includes(v)) setField(m.path, [...items, v]);
                e.currentTarget.value = "";
              }}
            />
          </div>
        );
      }
      case "select": {
        const cur = text(m.path);
        return (
          <div className={styles.opts}>
            {(m.options ?? []).map((o, i) => {
              const on = cur === o.value;
              return (
                <button
                  key={o.value || "none"}
                  type="button"
                  className={`${styles.opt}${on ? ` ${styles.optOn}` : ""}`}
                  onClick={() => setField(m.path, o.value)}
                >
                  {on && <span className={styles.optMark}>Picked</span>}
                  <span className={styles.rank}>{String.fromCharCode(65 + i)}</span>
                  <span className={styles.optBody}>
                    <span className={styles.optTitle}>{o.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        );
      }
      case "color": {
        const cur = str(readPath(draft, m.path));
        return (
          <div className={styles.colorRow}>
            <ColorPicker value={normalizeHex(cur) ?? cur} onChange={(hex) => setField(m.path, hex)} />
            {cur !== "" && (
              <button type="button" className={styles.rm} onClick={() => setField(m.path, "")}>
                clear
              </button>
            )}
          </div>
        );
      }
      case "number": {
        const raw = readPath(draft, m.path);
        const n = typeof raw === "number" ? raw : undefined;
        const meta = m.number;
        if (meta?.range) {
          return (
            <div className={styles.numrange}>
              <input
                type="range"
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={n ?? meta.min ?? 0}
                onChange={(e) => setField(m.path, Number(e.target.value))}
              />
              <span className={styles.numval}>{n === undefined ? "unset" : `${n}${meta.unit ?? ""}`}</span>
            </div>
          );
        }
        return (
          <input
            className={styles.in}
            type="number"
            step={meta?.step}
            min={meta?.min}
            max={meta?.max}
            value={n ?? ""}
            onChange={(e) => setField(m.path, e.target.value === "" ? undefined : Number(e.target.value))}
          />
        );
      }
      case "keyvalue": {
        const entries = Object.entries(rec(readPath(draft, m.path)));
        const kv = m.keyValue ?? { keyLabel: "Key", valueLabel: "Value" };
        const isList = kv.valueList === true;
        const showVal = (v: unknown): string => (isList ? strArr(v).join(", ") : str(v));
        const parseVal = (s: string): unknown => (isList ? s.split(",").map((x) => x.trim()).filter(Boolean) : s);
        const write = (next: [string, unknown][]): void => setField(m.path, Object.fromEntries(next));
        return (
          <div className={styles.kv}>
            {entries.map(([k, v], i) => (
              <div className={styles.kvrow} key={i}>
                <input
                  className={styles.in}
                  placeholder={kv.keyPlaceholder ?? kv.keyLabel}
                  value={k}
                  onChange={(e) => write(entries.map((en, j) => (j === i ? [e.target.value, en[1]] : en)))}
                />
                <input
                  className={styles.in}
                  placeholder={kv.valueLabel}
                  value={showVal(v)}
                  onChange={(e) => write(entries.map((en, j) => (j === i ? [en[0], parseVal(e.target.value)] : en)))}
                />
                <button type="button" className={styles.rm} onClick={() => write(entries.filter((_, j) => j !== i))}>
                  remove
                </button>
              </div>
            ))}
            <button type="button" className={styles.add} onClick={() => write([...entries, ["", ""]])}>
              {`+ add ${kv.keyLabel.toLowerCase()}`}
            </button>
          </div>
        );
      }
      case "list-subeditor": {
        const raw = readPath(draft, m.path);
        const rows: Record<string, unknown>[] = Array.isArray(raw) ? raw.map(rec) : [];
        const subs = m.subFields ?? [];
        const setRows = (next: Record<string, unknown>[]): void => setField(m.path, next);
        return (
          <div className={styles.sublist}>
            {rows.map((row, i) => (
              <div className={styles.subrow} key={i}>
                {subs.map((sf) => (
                  <label className={styles.subcell} key={sf.key}>
                    <span className={styles.subk}>{sf.label}</span>
                    {renderSub(row[sf.key], (v) => setRows(rows.map((r, j) => (j === i ? { ...r, [sf.key]: v } : r))), sf)}
                  </label>
                ))}
                <button type="button" className={styles.rm} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  remove
                </button>
              </div>
            ))}
            <button type="button" className={styles.add} onClick={() => setRows([...rows, {}])}>
              {m.addLabel ?? "+ add"}
            </button>
          </div>
        );
      }
      case "structured-subeditor": {
        const obj = rec(readPath(draft, m.path));
        const subs = m.subFields ?? [];
        return (
          <div className={styles.structured}>
            {subs.map((sf) => (
              <label className={styles.subcell} key={sf.key}>
                <span className={styles.subk}>{sf.label}</span>
                {renderSub(obj[sf.key], (v) => setField(`${m.path}.${sf.key}`, v), sf)}
              </label>
            ))}
          </div>
        );
      }
      case "asset-gallery": {
        const raw = readPath(draft, m.path);
        const assets: Record<string, unknown>[] = Array.isArray(raw) ? raw.map(rec) : [];
        const setAssets = (next: Record<string, unknown>[]): void => setField(m.path, next);
        const update = (i: number, patch: Record<string, unknown>): void =>
          setAssets(assets.map((a, j) => (j === i ? { ...a, ...patch } : a)));
        const addFiles = (files: FileList | null): void => {
          if (files === null) return;
          const readers = [...files].map(
            (f) =>
              new Promise<Record<string, unknown>>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ role: "other", ref: String(reader.result), mime: f.type, label: f.name });
                reader.readAsDataURL(f);
              }),
          );
          void Promise.all(readers).then((added) => setAssets([...assets, ...added]));
        };
        return (
          <div className={styles.gallery}>
            {assets.map((a, i) => {
              const ref = str(a.ref);
              const isImg = ref.startsWith("data:image") || ref.startsWith("http");
              return (
                <div className={styles.assetCard} key={i}>
                  <div className={styles.assetThumb}>
                    {isImg ? <img src={ref} alt="" /> : <span>{str(a.role) || "asset"}</span>}
                  </div>
                  <select className={styles.in} value={str(a.role)} onChange={(e) => update(i, { role: e.target.value })}>
                    {ASSET_ROLES.map((rr) => (
                      <option key={rr} value={rr}>{rr}</option>
                    ))}
                  </select>
                  <input className={styles.in} placeholder="label" value={str(a.label)} onChange={(e) => update(i, { label: e.target.value })} />
                  <div className={styles.assetRow}>
                    <button
                      type="button"
                      className={`${styles.toggle}${a.primary === true ? ` ${styles.toggleOn}` : ""}`}
                      onClick={() => update(i, { primary: a.primary !== true })}
                    >
                      Primary
                    </button>
                    <button type="button" className={styles.rm} onClick={() => setAssets(assets.filter((_, j) => j !== i))}>
                      remove
                    </button>
                  </div>
                </div>
              );
            })}
            <label className={styles.add}>
              + add images
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        );
      }
    }
  };

  // The guided quiz: one question per bright card (your setup's language), the character taking shape
  // on the stage beside it. Pure view over the draft; Skip/Next only move the cursor. The portrait is
  // the stage, not a question, so it drops out of the walked list.
  const walkable = FIELD_MODULES.filter((m) => m.kind !== "portrait");
  // the platform lens drives the walk: with targets selected, HIDE drops questions no selected
  // platform carries (fewer questions), DIM keeps them (marked below). Empty selection = ask all.
  const moduleVerdict = (m: FieldModule): LensVerdict => lensVerdict([m.path], targets, coverage);
  const hidByLens = targets.length > 0 && offTarget === "hide";
  const lensWalk = hidByLens ? walkable.filter((m) => !moduleVerdict(m).off) : walkable;
  // per-field lens for the bento/playbill layouts: a field no selected platform carries HIDES under
  // the hide treatment and DIMS (stays visible, honest) under dim. Empty selection = the full card.
  const lensHides = (m: FieldModule): boolean => hidByLens && moduleVerdict(m).off;
  const lensDims = (m: FieldModule): boolean => targets.length > 0 && offTarget === "dim" && moduleVerdict(m).off;
  // never strand the walk empty (a near-empty platform under HIDE) - fall back to the full list.
  const flowModules = lensWalk.length > 0 ? lensWalk : walkable;
  const flowAt = Math.min(flowIndex, flowModules.length - 1);
  const active = flowModules[flowAt]!;
  const goFlow = (i: number): void => setFlowIndex(Math.max(0, Math.min(i, flowModules.length - 1)));
  const filled = (m: FieldModule): boolean => {
    const v = readPath(draft, m.path);
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  };
  const answeredCount = flowModules.filter(filled).length;

  // the answer per kind: text/prose get a ruled write field; rating gets pickable cards (the rose
  // PICKED snap); the composite editors keep their bespoke bodies inside the card.
  const RATING_OPTIONS: ReadonlyArray<{ value: string; title: string; sub: string }> = [
    { value: "", title: "Unrated", sub: "Not set. We guess from the tags." },
    { value: "all-ages", title: "All ages", sub: "Safe for everyone. No mature themes." },
    { value: "mature", title: "Mature", sub: "Adult themes, violence, some spice." },
    { value: "explicit", title: "Explicit", sub: "Anything goes. After dark." },
  ];
  const answerFor = (m: FieldModule): JSX.Element => {
    if (m.kind === "rating") {
      const cur = text(m.path);
      return (
        <div className={styles.opts}>
          {RATING_OPTIONS.map((o, i) => {
            const on = cur === o.value;
            return (
              <button
                key={o.value || "unrated"}
                type="button"
                className={`${styles.opt}${on ? ` ${styles.optOn}` : ""}`}
                onClick={() => setField(m.path, o.value)}
              >
                {on && <span className={styles.optMark}>Picked</span>}
                <span className={styles.rank}>{String.fromCharCode(65 + i)}</span>
                <span className={styles.optBody}>
                  <span className={styles.optTitle}>{o.title}</span>
                  <span className={styles.optSub}>{o.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      );
    }
    if (m.kind === "text") {
      return <input className={styles.write} placeholder={m.placeholder} value={text(m.path)} onChange={(e) => setField(m.path, e.target.value)} />;
    }
    // prose renders through RenderBox (rendered by default, one click to edit the source)
    if (m.kind === "prose") return <div className={styles.composite}>{proseBody(m.id, m.path)}</div>;
    return <div className={styles.composite}>{controlFor(m)}</div>;
  };

  const stageName = text("identity.name") || piece.name;
  const snippet = (s: string): string => (s.length > 84 ? `${s.slice(0, 84).trimEnd()}…` : s);
  // one dossier line per module, shown as a short display value; the sheet grows richer with each answer
  const dossierValue = (m: FieldModule): string => {
    const raw = readPath(draft, m.path);
    if (typeof raw === "string") return snippet(raw);
    if (Array.isArray(raw)) return m.kind === "tags" || m.kind === "list" ? strArr(raw).join(" · ") : `${raw.length} set`;
    if (raw !== null && typeof raw === "object") return "set";
    return "";
  };
  // the growing record: every field REACHED so far, in order (filled shows its value, skipped is
  // marked, the current one is "answering now") - so it grows predictably, never cherry-picked.
  const dossierRows = flowModules.slice(0, flowAt + 1);
  const entityAccent =
    str(readPath(draft, "presentation.signatureColor")) ||
    strArr(readPath(draft, "presentation.gradientColors"))[0] ||
    artAccent ||
    undefined;

  const flowView = (
    <div className={styles.quiz} ref={quizRef} style={{ ["--ql"]: `${splitPct}%` } as CSSProperties}>
      <div className={styles.qcol}>
        <div className={styles.qcard} ref={activeCardRef}>
          <span className={styles.qframe} />
          <div className={styles.qtop}>
            <span className={styles.qstep}>{active.step}</span>
            <span className={styles.qprog}>
              <span className={styles.qdots}>
                {flowModules.map((mod, i) => (
                  <i key={mod.id} className={i < flowAt ? styles.qdotDone : i === flowAt ? styles.qdotNow : undefined} />
                ))}
              </span>
              {`${flowAt + 1} of ${flowModules.length}`}
            </span>
          </div>
          <h2 className={styles.qbig}>
            {active.question}
            {active.required && <span className={styles.qreq}> *</span>}
          </h2>
          {active.helper !== undefined && <p className={styles.qsay}>{active.helper}</p>}
          {moduleVerdict(active).missing.length > 0 && (
            <p className={styles.qmiss}>{`not carried on: ${moduleVerdict(active).missing.map(platformLabel).join(", ")}`}</p>
          )}
          <div className={styles.qanswer}>{answerFor(active)}</div>
          <div className={styles.qcontrols}>
            <button type="button" className={styles.qskip} disabled={flowAt === 0 && active.kind !== "rating"} onClick={() => goFlow(flowAt - 1)}>
              &larr; Back
            </button>
            {flowAt === flowModules.length - 1 ? (
              <button type="button" className={`stamp ${styles.qnext}`} disabled={saving} onClick={() => void doSave()}>
                {saving ? "Saving…" : "Complete"}
              </button>
            ) : (
              <button type="button" className={`stamp ${styles.qnext}`} onClick={() => goFlow(flowAt + 1)}>
                Next &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className={styles.splitter}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        onPointerDown={onSplitDown}
      />

      <div className={styles.stagecol}>
        <p className={styles.stagecap}>
          Your character <em>&middot; taking shape</em>
        </p>
        <div className={styles.stage}>
          <span className={`${styles.cr} ${styles.crtl}`} />
          <span className={`${styles.cr} ${styles.crtr}`} />
          <span className={`${styles.cr} ${styles.crbl}`} />
          <span className={`${styles.cr} ${styles.crbr}`} />
          <div className={styles.stinner}>
            <div className={styles.pcol}>
              <div className={styles.pplate}>
                {artUrl !== null && <img className={styles.pimg} src={artUrl} alt="" />}
              </div>
              <b className={styles.pname}>{stageName}</b>
            </div>
            <div className={styles.dossier}>
              {dossierRows.map((m) => {
                const has = filled(m);
                return (
                  <div key={m.id} className={`${styles.drow}${has ? "" : ` ${styles.drowAwait}`}`}>
                    <span className={styles.dk}>{m.sheetLabel}</span>
                    <span className={styles.dv}>{has ? dossierValue(m) : m.id === active.id ? "answering now…" : "skipped"}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.floor} />
          <div className={styles.taking}>{`~${tokenEstimate(draft)} tokens · ${answeredCount} of ${flowModules.length} answered`}</div>
        </div>
      </div>
    </div>
  );

  // Grid presenter: ONE bento per field (not per section) so the boxes pack naturally as a masonry -
  // a short field is a short box, a big prose field is a tall box, and they flow to fill the width
  // instead of a few giant section columns. Reads FIELD_MODULES in registry order (section-grouped),
  // so related fields stay adjacent. controlFor is the shared renderer with the quiz.
  // ===== BENTO layout, transcribed 1:1 from design/vs-editor-2.html. Fixed 3 columns: the face +
  // sealed rail | everything you write | presentation + meta. Fields render from FIELD_MODULES via
  // controlFor - the LAYOUT is data (a column's ordered cards, each naming its module ids), so a
  // second layout (playbill) and drag-drop are just different data over the same registry.
  const moduleById = new Map(FIELD_MODULES.map((m) => [m.id, m]));
  const bcard = (title: string, ids: readonly string[]): JSX.Element | null => {
    const mods = ids
      .map((id) => moduleById.get(id))
      .filter((m): m is FieldModule => m !== undefined && !lensHides(m));
    if (mods.length === 0) return null; // all fields hidden by the lens -> drop the whole card
    return (
      <BentoCard key={title} title={title}>
        {mods.map((m) => (
          <div key={m.id} className={`${styles.bfield}${lensDims(m) ? ` ${styles.dimlens}` : ""}`}>
            <span className={styles.blabel}>
              {m.sheetLabel}
              {m.required && <span className={styles.qreq}> *</span>}
            </span>
            {controlFor(m)}
          </div>
        ))}
      </BentoCard>
    );
  };

  // macro inventory: scan the prose the way the wireframe does - every {{macro}} with a count.
  const macroCounts = ((): Array<[string, number]> => {
    const paths = [
      "identity.description", "persona.personality", "persona.scenario", "persona.appearance",
      "greetings.firstMessage", "examples.exampleMessages", "prompts.systemPrompt",
      "prompts.postHistoryInstructions", "prompts.prefill", "prompts.additionalText",
    ];
    const tally = new Map<string, number>();
    for (const p of paths) {
      for (const mm of str(readPath(draft, p)).matchAll(/\{\{\s*([^}|:]+?)\s*(?:[:|][^}]*)?\}\}/g)) {
        const name = `{{${mm[1]!.trim()}}}`;
        tally.set(name, (tally.get(name) ?? 0) + 1);
      }
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]);
  })();
  const macroCard = (
    <BentoCard key="macros" title="Variables · Macro Inventory">
      {macroCounts.length === 0 ? (
        <div className={styles.blabel}>No macros detected yet</div>
      ) : (
        macroCounts.map(([name, n]) => (
          <div key={name} className={styles.mrow}>
            <span className={styles.mname}>{name}</span>
            <span className={styles.mcnt}>{`× ${n}`}</span>
          </div>
        ))
      )}
    </BentoCard>
  );

  // sealed cargo: the FOREIGN-format twin(s) kept for lossless round-trip, shown honestly. Vaude's own
  // internal keys (vaud-studio bookkeeping, vaud-json passthrough) are not sealed cargo - exclude them.
  const escrowFormats = Object.keys(rec(init.ent.escrow)).filter((k) => k !== "vaud-studio" && k !== "vaud-json");
  const sealedCard =
    escrowFormats.length === 0 ? null : (
      <BentoCard key="sealed" title="Sealed Cargo">
        <div className={styles.sealed}>
          {`The original ${escrowFormats.map((k) => platformLabel(k)).join(" and ")} card is kept here whole and re-emitted byte-for-byte when you export back to that format. Read-only.`}
        </div>
      </BentoCard>
    );

  const bentoView = (
    <div className={styles.bento}>
      <div className={styles.bcol}>
        {leftCard}
        {sealedCard}
      </div>
      <div className={styles.bcol}>
        {bcard("Identity", ["name", "tagline", "tags", "rating"])}
        {bcard("Casting Card", ["fullName", "title", "age", "pronouns", "nickname", "culture", "characterVersion"])}
        {bcard("Description", ["description"])}
        {bcard("Personality", ["personality"])}
        {bcard("Appearance", ["appearance"])}
        {bcard("Scenario", ["scenario"])}
        {bcard("Persona · Structured", ["structuredKind", "structuredAttributes"])}
        {bcard("System Prompt", ["systemPrompt"])}
        {bcard("Post-History", ["postHistoryInstructions"])}
        {bcard("Prefill", ["prefill"])}
        {bcard("Additional Text", ["additionalText"])}
        {bcard("Depth Injections", ["depthInjections"])}
        {bcard("First Message", ["firstMes"])}
        {bcard("Alt Greetings", ["alternateGreetings"])}
        {bcard("Group Greetings", ["groupOnlyGreetings"])}
        {bcard("Examples", ["mesExample"])}
      </div>
      <div className={styles.bcol}>
        {bcard("Color Palette", ["palette", "gradient", "accentColor", "signatureColor"])}
        {bcard("Default Background", ["background"])}
        {macroCard}
        {bcard("Spotlight Definitions", ["spotlight"])}
        {bcard("Discovery", ["genre", "fandom", "contentWarnings"])}
        {bcard("Voice", ["voice"])}
        {bcard("Image Prompt", ["imagePrompt", "imagePromptRows"])}
        {bcard("Media", ["visualKind", "mediaLinks"])}
        {bcard("Settings", ["talkativeness", "risuSettings"])}
        {bcard("Bias", ["bias"])}
        {bcard("Attribution", ["creator", "creatorNotes", "publicNote", "originalCreator", "source", "sourceUrl", "license", "creatorNotesMultilingual"])}
      </div>
    </div>
  );

  // ===== PLAYBILL layout, transcribed from design/vs-editor-v2.html, with the Bill and the character
  // image SWAPPED (owner's call): portrait LEFT, the Acts form center, the act nav (The Bill) RIGHT.
  // Same FIELD_MODULES, arranged as vertical "acts" (field-group sections) with a jump nav - the
  // second layout over the one registry, proving the modularity.
  const ACTS: ReadonlyArray<{ id: string; no: string; title: string; ids: readonly string[] }> = [
    { id: "identity", no: "Act I", title: "Identity", ids: ["name", "tagline", "fullName", "title", "age", "pronouns", "nickname", "culture", "characterVersion", "tags", "rating"] },
    { id: "persona", no: "Act II", title: "Persona", ids: ["personality", "scenario", "appearance", "structuredKind", "structuredAttributes", "voice", "imagePrompt", "imagePromptRows"] },
    { id: "prompts", no: "Act III", title: "Prompts", ids: ["systemPrompt", "postHistoryInstructions", "prefill", "additionalText", "depthInjections"] },
    { id: "greetings", no: "Act IV", title: "Greetings", ids: ["firstMes", "alternateGreetings", "groupOnlyGreetings"] },
    { id: "examples", no: "Act V", title: "Examples", ids: ["mesExample"] },
    { id: "discovery", no: "Act VI", title: "Discovery", ids: ["genre", "fandom", "contentWarnings"] },
    { id: "attribution", no: "Act VII", title: "Attribution", ids: ["creator", "creatorNotes", "publicNote", "originalCreator", "source", "sourceUrl", "license", "creatorNotesMultilingual"] },
    { id: "presentation", no: "Act VIII", title: "Presentation", ids: ["palette", "gradient", "accentColor", "signatureColor", "background", "spotlight", "mediaLinks", "visualKind"] },
    { id: "settings", no: "Act IX", title: "Settings", ids: ["talkativeness", "risuSettings", "bias"] },
  ];
  const WIDE_KINDS = new Set(["prose", "greetings", "list", "keyvalue", "list-subeditor", "structured-subeditor", "spotlight", "background", "palette", "gradient", "asset-gallery", "tags", "rating"]);
  const actModules = (ids: readonly string[]): FieldModule[] =>
    ids.map((id) => moduleById.get(id)).filter((m): m is FieldModule => m !== undefined);
  const playbillView = (
    <div className={styles.playbill}>
      <div className={styles.pbLeft}>
        {leftCard}
        {sealedCard}
      </div>
      <div className={styles.pbForm}>
        {ACTS.map((act) => {
          const mods = actModules(act.ids).filter((m) => !lensHides(m));
          if (mods.length === 0) return null;
          return (
            <section key={act.id} id={`act-${act.id}`} className={styles.act}>
              <div className={styles.actbreak}>
                <span className={styles.abar} />
                <span className={styles.amid}>
                  <span className={styles.ano}>{act.no}</span>
                  <span className={styles.anm}>{act.title}</span>
                </span>
                <span className={styles.abar} />
              </div>
              <div className={styles.pbfields}>
                {mods.map((m) => (
                  <div
                    key={m.id}
                    className={`${styles.pbfield}${WIDE_KINDS.has(m.kind) ? ` ${styles.span2}` : ""}${lensDims(m) ? ` ${styles.dimlens}` : ""}`}
                  >
                    <span className={styles.blabel}>
                      {m.sheetLabel}
                      {m.required && <span className={styles.qreq}> *</span>}
                    </span>
                    {controlFor(m)}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <aside className={styles.pbBill}>
        <div className={styles.pbTitle}>The Bill</div>
        <p className={styles.pbSay}>Jump to any act.</p>
        <ul className={styles.toc}>
          {ACTS.map((act) => {
            const n = actModules(act.ids).filter((m) => !lensHides(m)).length;
            if (n === 0) return null;
            return (
              <li key={act.id}>
                <a href={`#act-${act.id}`}>
                  <span className={styles.tno}>{act.no}</span>
                  <span className={styles.tnm}>{act.title}</span>
                  <span className={styles.tct}>{n}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );

  // the editor-wide scale uses zoom (not transform) so the editor REFLOWS as it shrinks - the bento
  // grid is column-WIDTH based, so smaller = more, narrower bento columns that fill the freed space
  // (like browser zoom), never a shrink-into-the-corner with an empty void. --a rides along.
  const rootStyle: CSSProperties = {
    ...(entityAccent !== undefined ? { ["--a"]: entityAccent } : {}),
    ...(editorScale !== 1 ? { zoom: editorScale } : {}),
  };
  return (
    <div className={styles.root} style={rootStyle}>
      {/* row 1: platform lens tabs + off-target + completion chips (vs-editor-2 tabstrip) */}
      <div className={styles.tabstrip}>
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
        <span className={styles.done}>
          <span className={styles.frac}>{`${doneCount}/${chips.length}`}</span>
          {chips.map(([label, ok]) => (
            <span key={label} className={`${styles.chip}${ok ? ` ${styles.chipOk}` : ""}`}>
              {label}
            </span>
          ))}
        </span>
      </div>

      {/* row 2: back + name + version | scale + Grid/Steps + saved status (vs-editor-2 header) */}
      <div className={styles.hdr}>
        <button type="button" className={styles.back} aria-label="Close" title="Close" onClick={() => ctx.workbench.remove(piece.id, piece.kind)}>
          &#8592;
        </button>
        <b>{(text("identity.name") || piece.name).toUpperCase()}</b>
        {/* the version badge is a short label (V2, v1, 2024-final); a URL or a long string is not a
            version, so keep it out of the badge rather than blow out the header */}
        {text("identity.characterVersion") !== "" && text("identity.characterVersion").length <= 16 && (
          <span className={styles.vchip}>{text("identity.characterVersion")}</span>
        )}
        <span className={styles.hdrRight}>
          <span className={styles.escale} title="Scale the editor">
            <button type="button" className={styles.escaleStep} onClick={() => stepScale(-1)} disabled={editorScale <= SCALE_MIN} aria-label="Scale editor down" title="Smaller">
              &#8722;
            </button>
            <button type="button" className={styles.escalePct} onClick={() => setEditorScale(1)} title="Reset to 100%">
              {`${Math.round(editorScale * 100)}%`}
            </button>
            <button type="button" className={styles.escaleStep} onClick={() => stepScale(1)} disabled={editorScale >= SCALE_MAX} aria-label="Scale editor up" title="Bigger">
              &#43;
            </button>
          </span>
          {mode === "grid" && (
            <span className={styles.seg}>
              <button type="button" className={editorLayout === "bento" ? styles.on : undefined} onClick={() => setEditorLayout("bento")}>
                Bento
              </button>
              <button type="button" className={editorLayout === "playbill" ? styles.on : undefined} onClick={() => setEditorLayout("playbill")}>
                Playbill
              </button>
            </span>
          )}
          <span className={styles.seg}>
            <button type="button" className={mode === "grid" ? styles.on : undefined} onClick={() => setMode("grid")}>
              Grid
            </button>
            <button type="button" className={mode === "interview" ? styles.on : undefined} onClick={() => setMode("interview")}>
              Steps
            </button>
          </span>
          <button type="button" className={styles.save} disabled={saving || !dirty} onClick={() => void doSave()} title="Save · ctrl+s">
            {saving ? "Saving…" : dirty ? "Save" : "● Saved locally"}
          </button>
          {topRight}
        </span>
      </div>

      {mode === "grid" ? (editorLayout === "playbill" ? playbillView : bentoView) : flowView}
    </div>
  );
}
