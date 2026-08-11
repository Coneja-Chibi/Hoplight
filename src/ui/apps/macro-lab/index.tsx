/**
 * Macro Lab - write macro text, see what it means and what it really resolves to.
 *
 * TWO ANSWERS, KEPT APART ON PURPOSE. The reading box is our catalog of five dialects: instant,
 * offline, and honest that it is a model. The resolved box is a real SillyTavern or Marinara engine
 * on this machine assembling the text through its own code path. Blurring them would mean printing
 * an invented value beside a real one with nothing to tell a reader which was which - so the lens
 * strip drives both, and a lens with no runtime here disables the button and says why rather than
 * quietly pretending the engine agreed.
 *
 * WHY IT IS ITS OWN APP. The same question - "what does this actually do" - comes up in the preset
 * editor, in a conversion, and on its own with no piece open at all. The last one is the common
 * case and had nowhere to live: every other surface here needs a piece first.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react";
import type { AppContext, HoplightApp, MacroEngineInfo } from "../../app-contract";
import { apiStatusIs } from "../../_shared/api-fetch";
import { MACRO_DIALECT_LABELS, type MacroDialect } from "../../../core/preset/macros";
import { BiblePane } from "./bible-pane";
import { EnginePane, IDLE_ENGINE, type EngineState } from "./engine-pane";
import { buildResolveAsk, insertToken, LAB_LENSES, type VarRow } from "./lab-core";
import { OpsPane } from "./ops-pane";
import { ReadingPane } from "./reading-pane";
import styles from "./styles.module.css";

/**
 * The reference column's three views.
 *
 * TABBED RATHER THAN STACKED. Reading is about the text you wrote; the bible and the operations
 * table are about the platform. Three of those in one scrolling column would bury the resolved
 * output, which is the thing somebody pressed a button for - so the engine box keeps its place and
 * only the reference beneath it changes.
 */
const VIEWS = [
  { id: "reading", label: "Reading" },
  { id: "bible", label: "Macro bible" },
  { id: "operations", label: "Operations" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

/** flask-and-braces: the family grammar is flat ink, no gradients, no glow */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">'
  + '<path d="M9 3v6.2L4.5 17.4A2 2 0 0 0 6.3 20.5h11.4a2 2 0 0 0 1.8-3.1L15 9.2V3"/>'
  + '<path d="M7.5 3h9"/><path d="M7.8 14.5h8.4"/></svg>';

const STARTER = "Hello {{char}}, I am {{user}}.";

/** One constant for both the dock tile and the room's own --a. */
const ACCENT = "#7a5cc4"; // hardcode-ok: app identity accent, not theme chrome

export function MacroLab({ ctx }: { ctx: AppContext }): JSX.Element {
  const [text, setText] = useState(STARTER);
  const [lens, setLens] = useState<MacroDialect>("sillytavern");
  const [engines, setEngines] = useState<MacroEngineInfo[]>([]);
  const [user, setUser] = useState("");
  const [char, setChar] = useState("");
  const [vars, setVars] = useState<VarRow[]>([{ key: "", value: "" }]);
  const [engineState, setEngineState] = useState<EngineState>(IDLE_ENGINE);
  const [view, setView] = useState<ViewId>("reading");
  const scratch = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Guarded like the export dialog's: an unreachable studio must say so rather than leave the
      // button looking like the feature simply is not built.
      try {
        const out = await ctx.api.macroEngines();
        if (!cancelled) setEngines(out.engines);
      } catch {
        if (!cancelled) {
          setEngineState((s) => ({
            ...s,
            problem: "Could not ask which engines are installed. The studio may be unreachable.",
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  useEffect(() => {
    ctx.setStatus(
      engines.length > 0
        ? `macro lab · ${engines.map((e) => e.label).join(" · ")} ready`
        : "macro lab · catalog only, no engine installed",
    );
  }, [ctx, engines]);

  /**
   * The engine behind the chosen lens, when this machine has one.
   *
   * The lens ids and the engine ids share a namespace on purpose - "sillytavern" is one platform,
   * not two - but the SETS differ: five lenses have catalogs, two have runtimes. This lookup is the
   * one place that difference is resolved, and it returns null rather than a nearest match, because
   * offering to resolve RoleCall text on SillyTavern's engine would answer a question nobody asked.
   */
  const engine = useMemo(
    () => engines.find((e) => e.id === lens) ?? null,
    [engines, lens],
  );

  // A render belongs to the text and lens it was asked for. Leaving a stale answer on screen while
  // the text underneath changes is the same lie as resolving on a keystroke, told more slowly.
  useEffect(() => setEngineState(IDLE_ENGINE), [text, lens, user, char, vars]);

  const resolve = useCallback(async (): Promise<void> => {
    if (!engine) return;
    setEngineState({ result: null, busy: true, problem: null });
    try {
      const result = await ctx.api.macroResolve(
        buildResolveAsk(engine.id, text, { user, char, vars }),
      );
      setEngineState({ result, busy: false, problem: null });
    } catch (e) {
      // 429 is the route refusing a second concurrent render for this engine, which is a thing to
      // say plainly rather than a failure. apiStatusIs, not instanceof: each app is bundled on its
      // own, so the shell's error class is never this chunk's class.
      const busyElsewhere = apiStatusIs(e, 429);
      setEngineState({
        result: null,
        busy: false,
        problem: busyElsewhere
          ? `${engine.label} is already resolving something. Wait for that to finish.`
          : e instanceof Error
            ? e.message
            : "the render could not be started",
      });
    }
  }, [ctx, engine, text, user, char, vars]);

  const setVar = (index: number, patch: Partial<VarRow>): void =>
    setVars(vars.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  /**
   * A macro clicked in the bible or the operations table lands at the caret.
   *
   * The caret is read off the live element rather than tracked in state, because a controlled
   * textarea's selection is the DOM's to know and mirroring it would be a second copy that goes
   * wrong on every re-render. Falling back to the end of the text is the right answer for a box
   * that has never been focused - which is the common case for somebody who opened the bible first.
   */
  const insertAtCaret = useCallback((token: string): void => {
    const box = scratch.current;
    const at = box ? box.selectionStart : text.length;
    const to = box ? box.selectionEnd : text.length;
    const next = insertToken(text, token, at, to);
    setText(next.text);
    // After React has written the new value, put the caret past what was just inserted and give the
    // box focus - otherwise the next click inserts at the old position and typing goes nowhere.
    requestAnimationFrame(() => {
      const el = scratch.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  }, [text]);

  return (
    <div className={styles.room} style={{ "--a": ACCENT } as CSSProperties}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>Macro Lab</span>
        <h1 className={styles.title}>What does this macro actually do?</h1>
        <p className={styles.lede}>
          Write macro text on the left. The right tells you what each token means on the platform you
          picked, and - when you have that platform installed - what its own engine turns your text
          into.
        </p>
      </header>

      <div className={styles.lenses} role="radiogroup" aria-label="Platform">
        {LAB_LENSES.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === lens}
            className={`${styles.lens}${id === lens ? ` ${styles.lensOn}` : ""}`}
            onClick={() => setLens(id)}
          >
            {MACRO_DIALECT_LABELS[id]}
            {engines.some((e) => e.id === id) ? " ·" : ""}
          </button>
        ))}
      </div>

      <div className={styles.boxes}>
        <section className={styles.box} aria-label="Your macro text">
          <div className={styles.boxHead}>
            <h2 className={styles.boxTitle}>Your text</h2>
            <span className={styles.boxNote}>{`${text.length} characters`}</span>
          </div>

          <textarea
            ref={scratch}
            className={styles.source}
            value={text}
            spellCheck={false}
            aria-label="Macro text"
            onChange={(e) => setText(e.target.value)}
          />

          <div className={styles.boxHead}>
            <h2 className={styles.boxTitle}>Pretend context</h2>
            <span className={styles.boxNote}>used when resolving</span>
          </div>
          <p className={styles.quiet}>
            {"A macro that names somebody needs somebody to name. Leave these empty and each engine "}
            {"falls back to its own placeholder."}
          </p>

          <div className={styles.who}>
            <label className={styles.whoLabel} htmlFor="macro-lab-user">{"{{user}} is"}</label>
            <input
              id="macro-lab-user"
              className={styles.field}
              value={user}
              placeholder="User"
              onChange={(e) => setUser(e.target.value)}
            />
            <label className={styles.whoLabel} htmlFor="macro-lab-char">{"{{char}} is"}</label>
            <input
              id="macro-lab-char"
              className={styles.field}
              value={char}
              placeholder="Character"
              onChange={(e) => setChar(e.target.value)}
            />
          </div>

          <div className={styles.vars}>
            {vars.map((row, i) => (
              <div className={styles.varRow} key={i}>
                <input
                  className={styles.field}
                  value={row.key}
                  placeholder="variable"
                  aria-label={`Variable ${i + 1} name`}
                  onChange={(e) => setVar(i, { key: e.target.value })}
                />
                <input
                  className={styles.field}
                  value={row.value}
                  placeholder="value"
                  aria-label={`Variable ${i + 1} value`}
                  onChange={(e) => setVar(i, { value: e.target.value })}
                />
                <button
                  type="button"
                  className={styles.drop}
                  aria-label={`Remove variable ${i + 1}`}
                  onClick={() => setVars(vars.length === 1 ? [{ key: "", value: "" }] : vars.filter((_, j) => j !== i))}
                >
                  x
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.more}
              onClick={() => setVars([...vars, { key: "", value: "" }])}
            >
              Add a variable
            </button>
          </div>
        </section>

        <div className={styles.stack}>
          <EnginePane
            engine={engine}
            lensLabel={MACRO_DIALECT_LABELS[lens]}
            state={engineState}
            onResolve={() => void resolve()}
          />

          <div className={styles.tabs} role="tablist" aria-label="Reference">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === view}
                className={`${styles.tab}${v.id === view ? ` ${styles.tabOn}` : ""}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {view === "reading" ? <ReadingPane text={text} lens={lens} /> : null}
          {view === "bible" ? <BiblePane lens={lens} onInsert={insertAtCaret} /> : null}
          {view === "operations" ? <OpsPane onInsert={insertAtCaret} /> : null}
        </div>
      </div>
    </div>
  );
}

const app: HoplightApp = {
  manifest: {
    id: "macro-lab",
    title: "Macro Lab",
    markSvg: MARK_SVG,
    accent: ACCENT,
    order: 55,
    subtitle: "app · macros",
    agentSurface: {
      describe:
        "The Macro Lab: a scratch pad for macro text. The reading half explains each token against "
        + "the catalog for the chosen platform and shows what it becomes on the other four. The "
        + "resolved half runs the text through that platform's real macro engine, when a checkout "
        + "of it is installed on this machine.",
      actions: [
        {
          id: "read",
          label: "Explain a macro",
          describe:
            "Say what a token does on the chosen platform, and what it becomes on the other four. "
            + "Answered from the catalogs, so it works with no engine installed.",
        },
        {
          id: "resolve",
          label: "Resolve for real",
          describe:
            "Run the text through the platform's own macro engine and report what it turned into "
            + "and what was left unexpanded. Needs a checkout of that platform on this machine.",
        },
      ],
    },
  },
  Component: MacroLab,
};

export default app;
