/**
 * WorkshopView shell: composes rail + center panes + Test Bench. State and pure cores only;
 * each pane is one file. Non-coder door per design/vs-workspace-3.
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { TriggerScript } from "../../../../entities/character/schema";
import { TourGuide } from "../../../components/tour-guide";
import { hasSeenTour, tourSeenKey } from "../../../tours/tour-core";
import { readPath } from "../editor-core";
import {
  exportLossWarning,
  movedNameSet,
  orderDeltaMovedFirst,
  orderVarsMovedFirst,
} from "./board";
import { WorkshopCodePane } from "./code-pane";
import { WorkshopConsole, type ConsoleDelta, type ConsoleLogLine } from "./console";
import {
  moduleLuaCode,
  readWorkshopModule,
  withModuleLuaCode,
} from "./module";
import { WorkshopNotice } from "./notice";
import { buildRailParts, defaultPart, type WorkshopPart } from "./part";
import {
  applyRecipe,
  mergeRecipeVars,
  recipeById,
  stampRecipeApply,
  undoRecipeApply,
  type RecipeApplySnap,
} from "./recipes";
import { WorkshopRail } from "./rail";
import { runDataBench, runModuleBench } from "./run";
import { WorkshopStarters } from "./starters";
import { StateGraphPane } from "./state-graph/pane";
import styles from "./styles.module.css";
import workshopTour from "./tour";
import { WorkshopTriggersPane } from "./triggers-pane";
import { formatVarLines, seedVars, type VarRow } from "./vars";
import { WorkshopVariablesPane } from "./variables-pane";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const asTriggers = (v: unknown): TriggerScript[] =>
  Array.isArray(v) ? (v as TriggerScript[]) : [];

export interface WorkshopViewProps {
  draft: unknown;
  setField(path: string, value: unknown): void;
  original?: unknown;
  setOriginal?(path: string, value: unknown): void;
  targets?: readonly string[];
  ctx?: AppContext;
}

export function WorkshopView({
  draft,
  setField,
  original,
  setOriginal,
  targets = [],
  ctx,
}: WorkshopViewProps): JSX.Element {
  const triggers = asTriggers(readPath(draft, "behavior.triggerScripts"));
  const regex = asTriggers(readPath(draft, "behavior.regexScripts"));
  const defaultVarsText = str(readPath(draft, "behavior.defaultVariables"));
  const mod = useMemo(() => readWorkshopModule(original), [original]);

  const [part, setPart] = useState<WorkshopPart>(() => defaultPart(triggers.length));
  const [event, setEvent] = useState("output");
  const [vars, setVars] = useState<VarRow[]>(() => seedVars(triggers, defaultVarsText));
  const [log, setLog] = useState<ConsoleLogLine[]>([]);
  const [delta, setDelta] = useState<ConsoleDelta[]>([]);
  const [luaBusy, setLuaBusy] = useState(false);
  const [recipeSnap, setRecipeSnap] = useState<RecipeApplySnap | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (!ctx) return;
    if (hasSeenTour(ctx.prefs.get(tourSeenKey("workshop")))) return;
    setTourOpen(true);
  }, [ctx]);

  const writeTriggers = (next: TriggerScript[]): void =>
    setField("behavior.triggerScripts", next);

  const syncVarBoardToCard = (rows: VarRow[]): void => {
    setVars(rows);
    setField("behavior.defaultVariables", formatVarLines(rows));
  };

  const benchCls = {
    skip: styles.logSkip ?? "",
    fired: styles.logFired ?? "",
    say: styles.logSay ?? "",
  };

  const applyRec = (id: string): void => {
    const recipe = recipeById(id);
    if (!recipe) return;
    setRecipeSnap(stampRecipeApply(recipe, triggers, vars));
    writeTriggers(applyRecipe(triggers, recipe));
    syncVarBoardToCard(mergeRecipeVars(vars, recipe));
    setPart("triggers");
    setLog([{ cls: benchCls.fired, text: `Starter applied: ${recipe.title}` }]);
  };

  const undoRec = (): void => {
    if (!recipeSnap) return;
    const restored = undoRecipeApply(recipeSnap);
    writeTriggers(restored.triggers);
    syncVarBoardToCard(restored.vars);
    setLog([{ cls: benchCls.skip, text: `Undid starter: ${recipeSnap.recipeTitle}` }]);
    setRecipeSnap(null);
  };

  const run = (): void => {
    const out = runDataBench(triggers, vars, event, benchCls);
    setLog(out.log);
    setDelta(orderDeltaMovedFirst(out.delta));
    setVars(orderVarsMovedFirst(out.vars, movedNameSet(out.delta)));
  };

  const runModule = async (): Promise<void> => {
    setLuaBusy(true);
    setLog([{ cls: benchCls.say, text: "> sealed room: loading package scripts (vars + card meta + fake chat)..." }]);
    try {
      const out = await runModuleBench(moduleLuaCode(mod), vars, benchCls, { body: draft });
      setLog(out.log);
      setDelta(orderDeltaMovedFirst(out.delta));
      setVars(orderVarsMovedFirst(out.vars, movedNameSet(out.delta)));
    } finally {
      setLuaBusy(false);
    }
  };

  const hasBehavior =
    triggers.length > 0 ||
    regex.length > 0 ||
    !!str(readPath(draft, "behavior.virtualScript")) ||
    !!str(readPath(draft, "behavior.backgroundHTML"));
  const lossWarn = exportLossWarning({
    hasBehavior: hasBehavior || !!mod,
    hasPackage: !!mod,
    targets,
  });

  const parts = buildRailParts({
    triggerCount: triggers.length,
    varCount: vars.filter((v) => v.name).length,
    regexCount: regex.length,
    mod,
  });

  const undoBtn = recipeSnap ? (
    <button type="button" className={styles.undo} onClick={undoRec}>
      Undo last starter
    </button>
  ) : null;

  const codeParts = new Set(["virtual", "background", "modlua", "modregex", "modlore", "regex"]);

  return (
    <div className={styles.shell}>
      <WorkshopRail parts={parts} part={part} onPart={setPart} hasPackage={!!mod} />

      <section className={styles.editor}>
        {lossWarn && <WorkshopNotice kind="warn">{lossWarn}</WorkshopNotice>}
        {part === "recipes" && (
          <WorkshopStarters
            emptyTriggers={triggers.length === 0}
            undo={undoBtn}
            onApply={applyRec}
          />
        )}
        {part === "triggers" && (
          <WorkshopTriggersPane
            triggers={triggers}
            onWrite={writeTriggers}
            undo={undoBtn}
            vars={vars}
          />
        )}
        {part === "graph" && (
          <StateGraphPane
            triggers={triggers}
            defaultVarsText={defaultVarsText}
            onApply={(nextTriggers, nextVarsText) => {
              writeTriggers(nextTriggers);
              setField("behavior.defaultVariables", nextVarsText);
              setVars(seedVars(nextTriggers, nextVarsText));
              setPart("triggers");
              setLog([{ cls: benchCls.fired, text: "State map applied as trigger rules." }]);
            }}
          />
        )}
        {part === "variables" && (
          <WorkshopVariablesPane vars={vars} onChange={syncVarBoardToCard} />
        )}
        {codeParts.has(part) && (
          <WorkshopCodePane
            part={part as "virtual" | "background" | "modlua" | "modregex" | "modlore" | "regex"}
            draft={draft}
            setField={setField}
            mod={mod}
            luaCode={moduleLuaCode(mod)}
            onLua={(v) => {
              if (!mod || !setOriginal) return;
              setOriginal("risu.unmapped.module", withModuleLuaCode(mod, v));
            }}
            regexCount={regex.length}
          />
        )}
      </section>

      <WorkshopConsole
        event={event}
        onEvent={setEvent}
        vars={vars}
        onVars={setVars}
        delta={delta}
        moved={movedNameSet(delta)}
        log={log}
        luaBusy={luaBusy}
        hasPackage={!!mod}
        onRunRules={run}
        onRunPackage={() => void runModule()}
      />

      {ctx && tourOpen && (
        <TourGuide tour={workshopTour} ctx={ctx} onClose={() => setTourOpen(false)} />
      )}
    </div>
  );
}
