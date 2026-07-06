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
import type { JSX, ReactNode } from "react";
import type { AppContext, CoverageInfo, StudioEntitySummary } from "../../app-contract";
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

const PROSE_MONO = new Set(["firstMes", "mesExample"]);
const RENDERED_ORDER_IDS = new Set(["description", "personality", "scenario", "firstMes", "alternateGreetings", "mesExample"]);

const FIELD_HELP: Record<string, string> = {
  description: "Who the character is - the main definition block every platform reads",
  personality: "Voice and temperament; some platforms fold this into the description",
  scenario: "Where a chat starts - setting and situation",
  firstMes: "The opening message; macros run at chat time on the target platform",
  mesExample: "Example dialogue in chat format; teaches the model the voice",
};

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

/** honest rough size: prose chars / 4, labeled "~tokens" (a real tokenizer is macro-layer work) */
function tokenEstimate(draft: unknown): number {
  const paths = ["identity.description", "persona.personality", "persona.scenario", "greetings.firstMessage", "examples.exampleMessages", "prompts.systemPrompt"];
  const chars = paths.reduce((n, p) => n + str(readPath(draft, p)).length, 0);
  return Math.round(chars / 4);
}

const cardById = new Map(EDITOR_CARDS.map((c) => [c.id, c]));

/** one line glyph per card, struck in the card's hot color before the title (RC card marks) */
const glyph = (children: ReactNode): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const CARD_ICONS: Record<string, JSX.Element> = {
  identity: glyph(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>),
  casting: glyph(<><rect x="3" y="5" width="18" height="14" rx="1" /><circle cx="8" cy="11" r="2" /><path d="M13 10h5M13 14h5M6 15h5" /></>),
  description: glyph(<path d="M5 4h14M5 9h14M5 14h9M5 19h9" />),
  personality: glyph(<><path d="M12 3a9 9 0 1 0 9 9" /><path d="M8.5 15a4 4 0 0 0 7 0M9 10h.01M15 10h.01" /></>),
  scenario: glyph(<><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>),
  firstMes: glyph(<path d="M4 5h16v11H8l-4 4V5Z" />),
  mesExample: glyph(<><path d="M4 4h12v9H8l-4 4V4Z" /><path d="M9 8h11v9l-3-3" /></>),
  alternateGreetings: glyph(<><path d="M4 5h11v8H8l-4 4V5Z" /><path d="M10 9h9v7l-3-3" /></>),
  gradient: glyph(<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />),
  palette: glyph(<><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.4 1-2 2-2h1a3 3 0 0 0 3-3 8 8 0 0 0-8-9Z" /><circle cx="8" cy="10" r="1" /><circle cx="12" cy="7" r="1" /><circle cx="16" cy="10" r="1" /></>),
  background: glyph(<><rect x="3" y="5" width="18" height="14" rx="1" /><circle cx="8.5" cy="10" r="1.5" /><path d="m4 17 5-4 4 3 3-2 4 3" /></>),
  spotlight: glyph(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>),
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
      return hit ? (hit.label.split(" ")[0] ?? id) : id;
    },
    [coverage],
  );
  const verdictOf = (card: EditorCard): { off: boolean; missing: string[] } => {
    const v = lensVerdict(card.paths, targets, coverage);
    return { off: v.off, missing: v.missing.map(platformLabel) };
  };

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

  // -- card bodies -----------------------------------------------------------------------------------

  const labelAff = (help: string): ReactNode => (
    <span className={styles.kaff}>
      <span title={help}>?</span>
      <button type="button" disabled title="Per-field AI lands with the brain milestone">&#10022;</button>
    </span>
  );
  const identityBody = (
    <>
      <div className={styles.klabel}>
        <span className={styles.k}>character name *</span>
        {labelAff("The display name every platform shows first")}
      </div>
      <input className={styles.in} value={text("identity.name")} onChange={(e) => setField("identity.name", e.target.value)} />
      <div className={styles.klabel}>
        <span className={styles.k}>tagline</span>
        {labelAff("A short hook shown under the name in browse and search")}
      </div>
      <input
        className={styles.in}
        placeholder="A short, catchy description..."
        value={text("identity.tagline")}
        onChange={(e) => setField("identity.tagline", e.target.value)}
      />
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
    </>
  );

  const castingBody = (
    <div className={styles.idGrid}>
      {(
        [
          ["identity.fullName", "full name / legal name", "Legal or birth name..."],
          ["identity.title", "title / epithet", "The Magnificent, Lord of..., etc."],
          ["identity.age", "age", "Ancient, 25, Timeless..."],
          ["identity.pronouns", "pronouns", "He/Him, She/Her, They..."],
        ] as const
      ).map(([path, label, ph]) => (
        <div className={styles.field} key={path}>
          <span className={styles.k}>{label}</span>
          <input className={styles.in} placeholder={ph} value={text(path)} onChange={(e) => setField(path, e.target.value)} />
        </div>
      ))}
    </div>
  );

  const proseAff = (id: string): ReactNode => (
    <>
      <span title={FIELD_HELP[id] ?? ""}>?</span>
      <button type="button" disabled title="Per-field AI lands with the brain milestone">&#10022;</button>
      <button type="button" disabled title="Format conversion lands with the brain milestone">&#8646;</button>
    </>
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
      <div className={styles.pal}>
        {palette.map((s, i) => (
          <span className={styles.swl} key={i}>
            <span className={styles.sw} style={{ background: s.hex }} />
            {s.label ?? s.name ?? s.hex}
          </span>
        ))}
        <button type="button" className={`${styles.sw} ${styles.swAdd}`} disabled title="Palette editing lands next slice">
          +
        </button>
      </div>
      {palette.length === 0 && <span className={styles.hint}>no palette on this card yet</span>}
    </>
  );

  const bgRef = text("presentation.background.ref");
  const backgroundBody = (
    <>
      {bgRef === "" && <div className={styles.bgempty}>No default background</div>}
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
      default: return null; // portrait renders as the bespoke left card
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
        icon={CARD_ICONS[card.id]}
        aff={RENDERED_ORDER_IDS.has(card.id) && card.id !== "alternateGreetings" ? proseAff(card.id) : undefined}
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
          {topRight}
        </span>
      </div>

      {mode === "grid" ? (
        <div className={styles.bento}>
          <div className={`${styles.col} ${styles.stickyCol}`}>{leftCard}</div>
          <div className={styles.col}>{centerOrdered}</div>
          <div className={styles.col}>{rightCards}</div>
        </div>
      ) : (
        <div className={`${styles.col} ${styles.stepsWrap}`}>
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
        <div className={`${styles.col} ${styles.tailWrap}`}>
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
