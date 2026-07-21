/**
 * CssWorkshop - Simple (starters/assist/source) or Advanced (code + breakdown).
 * Mode is a two-way toggle, not a fourth tab. Never applies CSS to Studio chrome.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type JSX } from "react";
import {
  appendRule,
  emitCss,
  makeRule,
  mergeCss,
  parseCss,
  removeRule,
  replaceRule,
  setProp,
  type CssDoc,
  type CssRule,
} from "./model";
import { CssAdvancedPane } from "./advanced-pane";
import { CssAssistPane } from "./assist-pane";
import {
  CSS_FILE_ACCEPT,
  looksLikeCssFile,
  readCssFile,
  summarizeImport,
} from "./import-css";
import { buildCssWorkshopSrcDoc } from "./preview";
import { CssSourcePane } from "./source-pane";
import { CssStarters } from "./starters";
import { listTargetPacks, targetPackById } from "./targets/registry";
import styles from "./styles.module.css";

/** Guided ladder under Simple mode. */
export type CssSimpleTab = "starters" | "assist" | "source";

/** Top-level editor mode. */
export type CssWorkshopMode = "simple" | "advanced";

/** @deprecated use CssSimpleTab + CssWorkshopMode */
export type CssWorkshopTab = CssSimpleTab | "advanced";

export interface CssWorkshopProps {
  value: string;
  onChange(css: string): void;
  defaultPackId?: string;
  onPackChange?(packId: string): void;
  note?: string;
  /** controlled mode; defaults internal to simple */
  mode?: CssWorkshopMode;
  onModeChange?(mode: CssWorkshopMode): void;
  /** uncontrolled initial mode */
  initialMode?: CssWorkshopMode;
  /** simple-mode ladder tab (controlled optional) */
  simpleTab?: CssSimpleTab;
  onSimpleTabChange?(tab: CssSimpleTab): void;
  initialSimpleTab?: CssSimpleTab;
}

const DEFAULT_NOTE =
  "Sealed preview only. Hoplight never applies this CSS to the app. Export keeps your full source for the host site.";

const SIMPLE_TABS: ReadonlyArray<readonly [CssSimpleTab, string]> = [
  ["starters", "Starters"],
  ["assist", "Assist"],
  ["source", "Source"],
];

/** Main assisted CSS editor shell. */
export function CssWorkshop({
  value,
  onChange,
  defaultPackId = "universal",
  onPackChange,
  note = DEFAULT_NOTE,
  mode: modeProp,
  onModeChange,
  initialMode = "simple",
  simpleTab: simpleTabProp,
  onSimpleTabChange,
  initialSimpleTab = "assist",
}: CssWorkshopProps): JSX.Element {
  const modeControlled = modeProp !== undefined;
  const [modeInner, setModeInner] = useState<CssWorkshopMode>(initialMode);
  const mode = modeControlled ? modeProp! : modeInner;

  const setMode = (next: CssWorkshopMode): void => {
    if (!modeControlled) setModeInner(next);
    onModeChange?.(next);
  };

  const tabControlled = simpleTabProp !== undefined;
  const [tabInner, setTabInner] = useState<CssSimpleTab>(initialSimpleTab);
  const simpleTab = tabControlled ? simpleTabProp! : tabInner;

  const setSimpleTab = (next: CssSimpleTab): void => {
    if (!tabControlled) setTabInner(next);
    onSimpleTabChange?.(next);
  };

  const [packId, setPackId] = useState(defaultPackId);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPackId(defaultPackId);
  }, [defaultPackId]);

  const pack = targetPackById(packId) ?? listTargetPacks()[0]!;
  const doc: CssDoc = useMemo(() => parseCss(value), [value]);
  const selected: CssRule | undefined = ruleId
    ? doc.rules.find((r) => r.id === ruleId)
    : mode === "simple" && simpleTab === "assist"
      ? doc.rules[0]
      : undefined;

  const srcDoc = useMemo(
    () => buildCssWorkshopSrcDoc(pack.mockHtml, value),
    [pack.mockHtml, value],
  );

  const pushUndo = (prev: string): void => {
    setUndoStack((s) => [...s.slice(-19), prev]);
  };

  const commit = (next: string): void => {
    pushUndo(value);
    onChange(next);
  };

  const commitDoc = (nextDoc: CssDoc): void => {
    commit(emitCss(nextDoc));
  };

  const changePack = (id: string): void => {
    setPackId(id);
    onPackChange?.(id);
  };

  const applyRecipe = (css: string): void => {
    commit(mergeCss(value, css));
    setSimpleTab("source");
    setMode("simple");
  };

  const undo = (): void => {
    const prev = undoStack[undoStack.length - 1];
    if (prev === undefined) return;
    setUndoStack((s) => s.slice(0, -1));
    onChange(prev);
  };

  const addRule = (selector: string): void => {
    const sel = selector.trim() || ".card";
    const rule = makeRule(sel, [{ property: "color", value: "#e8e4ef" }], "new rule");
    commitDoc(appendRule(doc, rule));
    setRuleId(rule.id);
    setSimpleTab("assist");
    setMode("simple");
  };

  const onRuleChange = (rule: CssRule): void => {
    commitDoc(replaceRule(doc, rule));
    setRuleId(rule.id);
  };

  const applyChip = (insert: string): void => {
    if (!selected) {
      commit(mergeCss(value, `.card {\n  ${insert}\n}`));
      return;
    }
    const m = insert.match(/^([a-z-]+)\s*:\s*(.+);?\s*$/i);
    if (!m) {
      commit(`${value.trim()}\n${insert}`);
      return;
    }
    let val = m[2]!.trim();
    let important = false;
    if (/\s*!important\s*$/i.test(val)) {
      important = true;
      val = val.replace(/\s*!important\s*$/i, "").trim();
    }
    onRuleChange(setProp(selected, m[1]!, val, important));
  };

  const importFile = async (file: File): Promise<void> => {
    if (!looksLikeCssFile(file.name) && file.type && !file.type.includes("css") && !file.type.includes("text")) {
      setImportMsg("pick a .css (or plain text) file");
      return;
    }
    try {
      const text = await readCssFile(file);
      const sum = summarizeImport(text);
      pushUndo(value);
      onChange(text);
      setRuleId(null);
      setMode("advanced");
      const free = sum.freeform ? " · freeform kept" : "";
      setImportMsg(
        `imported ${file.name} · ${sum.rules} rule${sum.rules === 1 ? "" : "s"}${free}`,
      );
    } catch {
      setImportMsg("could not read that file");
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void importFile(f);
  };

  return (
    <div className={styles.root}>
      <div className={styles.banner}>
        <strong>CSS workshop.</strong> {note} Source is always real CSS you can edit.
      </div>

      <div className={styles.packRow} data-tour="css-targets">
        <span className={styles.packLabel}>Targets</span>
        <select
          className={styles.sel}
          value={pack.id}
          onChange={(e) => changePack(e.target.value)}
          aria-label="Target pack"
        >
          {listTargetPacks().map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <span className={styles.packLabel}>Mode</span>
        <div className={styles.modeToggle} role="group" aria-label="Editor mode" data-tour="css-mode">
          <button
            type="button"
            className={mode === "simple" ? `${styles.modeBtn} ${styles.modeOn}` : styles.modeBtn}
            aria-pressed={mode === "simple"}
            onClick={() => setMode("simple")}
          >
            Simple
          </button>
          <button
            type="button"
            className={mode === "advanced" ? `${styles.modeBtn} ${styles.modeOn}` : styles.modeBtn}
            aria-pressed={mode === "advanced"}
            onClick={() => setMode("advanced")}
          >
            Advanced
          </button>
        </div>

        <button
          type="button"
          className={styles.mini}
          onClick={() => fileRef.current?.click()}
          data-tour="css-import"
        >
          import .css
        </button>
        <input
          ref={fileRef}
          type="file"
          className={styles.fileInput}
          accept={CSS_FILE_ACCEPT}
          aria-label="Import CSS file"
          onChange={onFileChange}
        />
        {undoStack.length > 0 && (
          <button type="button" className={styles.mini} onClick={undo}>
            undo
          </button>
        )}
        {importMsg ? <span className={styles.importFlash}>{importMsg}</span> : null}
      </div>

      {mode === "simple" && (
        <div className={styles.tabs} role="tablist" aria-label="Simple ladder" data-tour="css-tabs">
          {SIMPLE_TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={simpleTab === id}
              className={simpleTab === id ? `${styles.tab} ${styles.tabOn}` : styles.tab}
              onClick={() => setSimpleTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.previewBlock} data-tour="css-preview">
        <iframe
          className={styles.frame}
          title="Sealed CSS preview"
          sandbox=""
          srcDoc={srcDoc}
          referrerPolicy="no-referrer"
        />
      </div>

      {mode === "simple" && simpleTab === "starters" && (
        <CssStarters packId={packId} packBlurb={pack.blurb} onApply={applyRecipe} />
      )}

      {mode === "simple" && simpleTab === "assist" && (
        <CssAssistPane
          pack={pack}
          doc={doc}
          selected={selected}
          onSelectRule={setRuleId}
          onAddRule={addRule}
          onRuleChange={onRuleChange}
          onDeleteRule={(id) => {
            commitDoc(removeRule(doc, id));
            setRuleId(null);
          }}
        />
      )}

      {mode === "simple" && simpleTab === "source" && (
        <CssSourcePane value={value} onChange={onChange} onChip={applyChip} />
      )}

      {mode === "advanced" && (
        <CssAdvancedPane
          value={value}
          onChange={onChange}
          doc={doc}
          selected={selected}
          onSelectRule={setRuleId}
          onRuleChange={onRuleChange}
          onChip={applyChip}
        />
      )}
    </div>
  );
}

export { parseCss, emitCss, mergeCss } from "./model";
export { listTargetPacks, targetPackById } from "./targets/registry";
export { listCssRecipes } from "./recipes/registry";
export { readCssFile, summarizeImport, CSS_FILE_ACCEPT, looksLikeCssFile } from "./import-css";
