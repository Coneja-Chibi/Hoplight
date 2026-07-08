/**
 * WorkshopView - the behavior/scripts side of the card as a workbench (design/vs-workspace-1.html): a left
 * rail of the card's parts, a center editor for the focused part, and a persistent Test Bench console that
 * RUNS the card's data-format triggers and shows the variables move. Sits beside the standard field editor
 * as the "Workshop" mode; shown only for cards that carry behavior.
 *
 * Every edit to a condition/effect row is an OVERLAY on the original object (overlayField), so unmodeled
 * dialect keys survive the round-trip. The console runs runDataTriggers - pure TypeScript, no eval, no
 * wasmoon - so it works in the browser today; Lua triggerlua execution rides the wasm sandbox later.
 */
import { useState, type JSX } from "react";
import { readPath } from "../editor-core";
import { classifyCondition, classifyEffect } from "../../../../entities/character/behavior";
import { setAt, appendTo, removeAt, overlayField } from "../behavior-edit";
import { runDataTriggers, type TriggerVars } from "../../../../sandbox/triggers/run-data-trigger";
import type { TriggerScript } from "../../../../entities/character/schema";
import styles from "./Workshop.module.css";

const EVENTS: ReadonlyArray<[string, string]> = [
  ["output", "After the model replies"],
  ["input", "After you send"],
  ["start", "When the chat starts"],
];
const OPS: ReadonlyArray<[string, string]> = [
  ["=", "is"], ["!=", "is not"], [">", "is greater than"], ["<", "is less than"], [">=", "is at least"], ["<=", "is at most"],
];
const SETOPS: ReadonlyArray<[string, string]> = [
  ["=", "set to"], ["+=", "add"], ["-=", "subtract"], ["*=", "multiply by"], ["/=", "divide by"],
];
const EFFECTS: ReadonlyArray<[string, string]> = [
  ["setvar", "Change a variable"], ["impersonate", "Speak as"], ["command", "Run a command"],
];
const ROLES: ReadonlyArray<[string, string]> = [["user", "the user"], ["char", "the character"]];

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const asTriggers = (v: unknown): TriggerScript[] => (Array.isArray(v) ? (v as TriggerScript[]) : []);

type LogLine = { cls: string; text: string };
type VarRow = { name: string; value: string };

export interface WorkshopViewProps {
  draft: unknown;
  setField(path: string, value: unknown): void;
}

type Part = "triggers" | "regex" | "virtual" | "background";

/** distinct variable names a trigger set touches, so the console can seed a test row per var. */
function seedVars(triggers: TriggerScript[]): VarRow[] {
  const names = new Set<string>();
  for (const t of triggers) {
    for (const c of t.conditions) {
      const v = classifyCondition(c);
      if (v.kind === "known") names.add(v.variable);
    }
    for (const e of t.effects) {
      const v = classifyEffect(e);
      if (v.kind === "setvar") names.add(v.variable);
    }
  }
  return [...names].filter(Boolean).map((name) => ({ name, value: "" }));
}

export function WorkshopView({ draft, setField }: WorkshopViewProps): JSX.Element {
  const triggers = asTriggers(readPath(draft, "behavior.triggerScripts"));
  const regex = asTriggers(readPath(draft, "behavior.regexScripts")); // count only, slice 1
  const [part, setPart] = useState<Part>("triggers");
  const [event, setEvent] = useState<string>("output");
  const [vars, setVars] = useState<VarRow[]>(() => seedVars(triggers));
  const [log, setLog] = useState<LogLine[]>([]);
  const [delta, setDelta] = useState<{ name: string; before: string; after: string; moved: boolean }[]>([]);

  const writeTriggers = (next: TriggerScript[]): void => setField("behavior.triggerScripts", next);

  const editTrigger = (ti: number, patch: Partial<TriggerScript>): void =>
    writeTriggers(setAt(triggers, ti, { ...triggers[ti]!, ...patch }));
  const editCond = (ti: number, ci: number, key: string, value: unknown): void =>
    editTrigger(ti, { conditions: setAt(triggers[ti]!.conditions, ci, overlayField(triggers[ti]!.conditions[ci], key, value)) });
  const editEffect = (ti: number, ei: number, key: string, value: unknown): void =>
    editTrigger(ti, { effects: setAt(triggers[ti]!.effects, ei, overlayField(triggers[ti]!.effects[ei], key, value)) });

  const select = (opts: ReadonlyArray<[string, string]>, value: string, on: (v: string) => void): JSX.Element => (
    <select className={styles.mini} value={value} onChange={(e) => on(e.target.value)}>
      {opts.map(([v, label]) => (<option key={v} value={v}>{label}</option>))}
    </select>
  );

  const structured = (t: TriggerScript): boolean =>
    t.conditions.every((c) => classifyCondition(c).kind === "known") &&
    t.effects.every((e) => classifyEffect(e).kind !== "advanced");

  const effectRow = (ti: number, e: unknown, ei: number): JSX.Element => {
    const view = classifyEffect(e);
    return (
      <div className={styles.ruleRow} key={ei}>
        {select(EFFECTS, str((view.raw as { type?: string }).type) || "setvar", (v) => editEffect(ti, ei, "type", v))}
        {view.kind === "setvar" && (
          <>
            <input className={styles.var} value={view.variable} placeholder="variable" onChange={(ev) => editEffect(ti, ei, "var", ev.target.value)} />
            {select(SETOPS, view.operator || "=", (v) => editEffect(ti, ei, "operator", v))}
            <input className={styles.val} value={view.value} placeholder="value or {{macro}}" onChange={(ev) => editEffect(ti, ei, "value", ev.target.value)} />
          </>
        )}
        {view.kind === "impersonate" && (
          <>
            {select(ROLES, view.role || "user", (v) => editEffect(ti, ei, "role", v))}
            <input className={styles.val} value={view.value} placeholder="what they say" onChange={(ev) => editEffect(ti, ei, "value", ev.target.value)} />
          </>
        )}
        {view.kind === "command" && (
          <input className={styles.val} value={view.value} placeholder="/command" onChange={(ev) => editEffect(ti, ei, "value", ev.target.value)} />
        )}
        <button type="button" className={styles.rm} onClick={() => editTrigger(ti, { effects: removeAt(triggers[ti]!.effects, ei) })}>&times;</button>
      </div>
    );
  };

  const triggerCard = (t: TriggerScript, ti: number): JSX.Element => (
    <div className={`${styles.trig}${structured(t) ? "" : ` ${styles.adv}`}`} key={ti}>
      <div className={styles.th}>
        <input className={styles.name} value={str(t.label)} placeholder="name" onChange={(e) => editTrigger(ti, { label: e.target.value })} />
        <span className={styles.kw}>WHEN</span>
        {select(EVENTS, t.event || "output", (v) => editTrigger(ti, { event: v }))}
        <span style={{ marginLeft: "auto" }} />
        {!structured(t) && <span className={styles.advtag}>advanced &middot; code</span>}
        <button type="button" className={styles.rm} onClick={() => writeTriggers(removeAt(triggers, ti))}>&times;</button>
      </div>
      <div className={styles.body}>
        {structured(t) ? (
          <>
            <div className={`${styles.block} ${styles.blockIf}`}>
              <span className={`${styles.kw} ${styles.kwIf}`}>IF</span>
              {t.conditions.map((c, ci) => {
                const v = classifyCondition(c);
                if (v.kind !== "known") return null;
                return (
                  <div className={styles.ruleRow} key={ci}>
                    <input className={styles.var} value={v.variable} placeholder="variable" onChange={(e) => editCond(ti, ci, "var", e.target.value)} />
                    {select(OPS, v.operator || "=", (val) => editCond(ti, ci, "operator", val))}
                    <input className={styles.val} value={v.value} placeholder="value" onChange={(e) => editCond(ti, ci, "value", e.target.value)} />
                    <button type="button" className={styles.rm} onClick={() => editTrigger(ti, { conditions: removeAt(t.conditions, ci) })}>&times;</button>
                  </div>
                );
              })}
              <button type="button" className={styles.addmini} onClick={() => editTrigger(ti, { conditions: appendTo(t.conditions, { type: "var", var: "", operator: "=", value: "" }) })}>+ add condition</button>
            </div>
            <div className={`${styles.block} ${styles.blockThen}`}>
              <span className={`${styles.kw} ${styles.kwThen}`}>THEN</span>
              {t.effects.map((e, ei) => effectRow(ti, e, ei))}
              <button type="button" className={styles.addmini} onClick={() => editTrigger(ti, { effects: appendTo(t.effects, { type: "setvar", var: "", operator: "=", value: "" }) })}>+ add action</button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.hint}>this rule uses a macro expression, so it opens as code (never run)</p>
            <div className={styles.codeline}>
              {t.conditions.map((c) => `IF ${str((c as { var?: string }).var)} ${str((c as { operator?: string }).operator)} ${str((c as { value?: string }).value)}`).join("\n")}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const run = (): void => {
    const varsMap: TriggerVars = {};
    for (const v of vars) if (v.name) varsMap[v.name] = v.value;
    const before = { ...varsMap };
    const result = runDataTriggers(triggers, varsMap, event);
    const lines: LogLine[] = [];
    if (result.fired.length === 0) lines.push({ cls: styles.logSkip ?? "", text: "No rule fired for this event." });
    result.fired.forEach((f) => lines.push({ cls: styles.logFired ?? "", text: `▶ "${f}" fired` }));
    result.log.forEach((l) => lines.push({ cls: styles.logSay ?? "", text: `  ${l}` }));
    setLog(lines);
    const keys = new Set([...Object.keys(before), ...Object.keys(result.vars)]);
    setDelta([...keys].map((name) => ({ name, before: before[name] ?? "", after: result.vars[name] ?? "", moved: before[name] !== result.vars[name] })));
    // reflect the run's ending state back into the console rows
    setVars([...keys].map((name) => ({ name, value: result.vars[name] ?? "" })));
  };

  const parts: ReadonlyArray<{ id: Part; ico: string; label: string; count?: number; sealed?: boolean }> = [
    { id: "triggers", ico: "◆", label: "Triggers", count: triggers.length },
    { id: "regex", ico: "⇄", label: "Regex", count: regex.length },
    { id: "virtual", ico: "</>", label: "Virtual script", sealed: true },
    { id: "background", ico: "■", label: "Background", sealed: true },
  ];

  return (
    <div className={styles.shell}>
      <nav className={styles.rail}>
        <div className={styles.railhead}>The card</div>
        {parts.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.part}${p.id === part ? ` ${styles.partOn}` : ""}${p.sealed ? ` ${styles.sealed}` : ""}`}
            onClick={() => setPart(p.id)}
          >
            <span className={styles.ico}>{p.ico}</span> {p.label}
            {p.count !== undefined && <span className={styles.ct}>{p.count}</span>}
          </button>
        ))}
      </nav>

      <section className={styles.editor}>
        {part === "triggers" && (
          <>
            <div className={styles.ehead}><h2>Triggers</h2><span className={styles.sub}>when this happens, do that</span></div>
            {triggers.map((t, ti) => triggerCard(t, ti))}
            <button type="button" className={styles.add} onClick={() => writeTriggers(appendTo(triggers, { label: "new rule", event: "output", conditions: [{ type: "var", var: "", operator: "=", value: "" }], effects: [{ type: "setvar", var: "", operator: "=", value: "" }] }))}>+ add a trigger rule</button>
          </>
        )}
        {part === "regex" && (
          <>
            <div className={styles.ehead}><h2>Regex scripts</h2><span className={styles.sub}>find and replace, {regex.length} rules</span></div>
            <p className={styles.hint}>The find/replace editor lands in the next slice; the rules are kept whole meanwhile.</p>
          </>
        )}
        {(part === "virtual" || part === "background") && (
          <>
            <div className={styles.ehead}><h2>{part === "virtual" ? "Virtual script" : "Background"}</h2><span className={styles.sub}>sealed code &middot; never run here</span></div>
            <p className={styles.hint}>The assisted-code editor lands in the next slice; this content is kept whole and re-emitted on export.</p>
          </>
        )}
      </section>

      <aside className={styles.console}>
        <div className={styles.conhead}>
          <span className={styles.dot} /> Test Bench
          {select(EVENTS, event, setEvent)}
          <button type="button" className={styles.runBtn} onClick={run}>&#9654; Run</button>
        </div>
        <div className={styles.vars}>
          <div className={styles.vlabel}>Variables &middot; the world before Run</div>
          {vars.map((v, i) => (
            <div className={styles.varRow} key={i}>
              <input className={`${styles.vin} ${styles.vinName}`} value={v.name} placeholder="name" onChange={(e) => setVars(setAt(vars, i, { ...v, name: e.target.value }))} />
              <input className={styles.vin} value={v.value} placeholder="value" onChange={(e) => setVars(setAt(vars, i, { ...v, value: e.target.value }))} />
              <button type="button" className={styles.rm} onClick={() => setVars(removeAt(vars, i))}>&times;</button>
            </div>
          ))}
          <button type="button" className={styles.addmini} style={{ width: "100%" }} onClick={() => setVars(appendTo(vars, { name: "", value: "" }))}>+ add variable</button>
          {delta.length > 0 && (
            <>
              <div className={styles.vlabel} style={{ marginTop: "0.7rem" }}>After Run</div>
              <div className={styles.delta}>
                {delta.map((d) => (
                  <span key={d.name} className={`${styles.vpill}${d.moved ? ` ${styles.vpillMoved}` : ""}`}>
                    <b>{d.name}</b> {d.moved ? `${d.before || "0"} → ` : ""}{d.after}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className={styles.log}>
          {log.length === 0 ? "› press Run to fire the current event." : log.map((l, i) => (<div key={i} className={l.cls}>{l.text}</div>))}
        </div>
      </aside>
    </div>
  );
}
