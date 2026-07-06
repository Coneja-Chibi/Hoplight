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
} from "./editor-core";
import { FIELD_MODULES, type FieldModule } from "./fields";
import { signatureFromPng } from "../../../studio/signature-color";
import styles from "./Editor.module.css";

const PREF_TARGETS = "editor.targets";
const PREF_OFF_TARGET = "editor.offTarget";

const PROSE_MONO = new Set(["firstMes", "mesExample"]);

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
const greetingsOf = (draft: unknown): Greeting[] => {
  const raw = readPath(draft, "greetings.alternateGreetings");
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
          <RenderBox value={g.text} format="markdown">
            <textarea
              className={`${styles.ta} ${styles.mono}`}
              spellCheck={false}
              value={g.text}
              onChange={(e) => setGreetings(greetings.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            />
          </RenderBox>
        </div>
      ))}
      <button type="button" className={styles.add} onClick={() => setGreetings([...greetings, { text: "" }])}>
        + add a greeting
      </button>
    </>
  );

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
      case "greetings": return greetingsBody;
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
    }
  };

  // The guided quiz: one question per bright card (your setup's language), the character taking shape
  // on the stage beside it. Pure view over the draft; Skip/Next only move the cursor. The portrait is
  // the stage, not a question, so it drops out of the walked list.
  const flowModules = FIELD_MODULES.filter((m) => m.kind !== "portrait");
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

  // Grid presenter: the SAME field-module registry, one bento card per canonical section. Both grid and
  // stepper read FIELD_MODULES - add a field once, it shows in both. controlFor is the shared renderer.
  const GRID_SECTIONS: ReadonlyArray<readonly [prefix: string, label: string]> = [
    ["identity", "Identity"],
    ["persona", "Persona"],
    ["prompts", "Prompts"],
    ["greetings", "Greetings"],
    ["examples", "Examples"],
    ["discovery", "Discovery"],
    ["media", "Media"],
    ["presentation", "Presentation"],
    ["attribution", "Attribution"],
  ];
  const gridView = (
    <div className={styles.gridsec}>
      {GRID_SECTIONS.map(([prefix, label]) => {
        const mods = FIELD_MODULES.filter((m) => m.path.startsWith(`${prefix}.`));
        if (mods.length === 0) return null;
        return (
          <BentoCard key={prefix} title={label}>
            {mods.map((m) => (
              <div key={m.id} className={styles.gfield}>
                <span className={styles.glabel}>
                  {m.sheetLabel}
                  {m.required && <span className={styles.qreq}> *</span>}
                </span>
                {controlFor(m)}
              </div>
            ))}
          </BentoCard>
        );
      })}
    </div>
  );

  return (
    <div className={styles.root} style={entityAccent !== undefined ? ({ ["--a"]: entityAccent } as CSSProperties) : undefined}>
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
          <span className={styles.seg}>
            <button type="button" className={mode === "interview" ? styles.on : undefined} onClick={() => setMode("interview")}>
              Quiz
            </button>
            <button type="button" className={mode === "grid" ? styles.on : undefined} onClick={() => setMode("grid")}>
              Grid
            </button>
          </span>
          <button type="button" className={styles.save} disabled={saving || !dirty} onClick={() => void doSave()}>
            Save
          </button>
          {topRight}
        </span>
      </div>

      {mode === "grid" ? gridView : flowView}
    </div>
  );
}
