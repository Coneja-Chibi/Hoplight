/**
 * Workshop code / stub panes: virtual script, background, package scripts, regex/lore stubs.
 * Reuses CodeEditor + SealedHtmlPreview from the house registry.
 */
import type { JSX } from "react";
import { CodeEditor } from "../../../components/code-editor";
import { SealedHtmlPreview } from "../../../components/sealed-html-preview";
import { readPath } from "../editor-core";
import { WorkshopEhead } from "./ehead";
import type { WorkshopModuleView } from "./module";
import type { WorkshopPart } from "./part";
import macroStyles from "./macros/chips.module.css";
import styles from "./styles.module.css";

export interface WorkshopCodePaneProps {
  part: Extract<WorkshopPart, "virtual" | "background" | "modlua" | "modregex" | "modlore" | "regex">;
  draft: unknown;
  setField(path: string, value: unknown): void;
  mod: WorkshopModuleView | null;
  luaCode: string;
  onLua(code: string): void;
  regexCount: number;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function WorkshopCodePane(props: WorkshopCodePaneProps): JSX.Element {
  const { part, draft, setField, mod, luaCode, onLua, regexCount } = props;

  if (part === "regex") {
    return (
      <>
        <WorkshopEhead title="Regex scripts" sub={`${regexCount} rules kept whole`} />
        <p className={styles.hint}>Full find/replace builder stays a stub for now. Counts and data are preserved on the card.</p>
      </>
    );
  }

  if (part === "virtual") {
    return (
      <>
        <WorkshopEhead title="Virtual script" sub="raw script on the card · source only, not run here" />
        <CodeEditor
          value={str(readPath(draft, "behavior.virtualScript"))}
          onChange={(v) => setField("behavior.virtualScript", v)}
          language="js"
          minRows={16}
          placeholder="type {{ for macros"
        />
      </>
    );
  }

  if (part === "background") {
    return (
      <>
        <WorkshopEhead title="Background" sub="custom HTML backdrop · sealed preview below" />
        <SealedHtmlPreview
          html={str(readPath(draft, "behavior.backgroundHTML"))}
          css={str(readPath(draft, "behavior.backgroundCSS"))}
          title="Card backdrop preview"
        />
        <p className={styles.hint}>Preview is sandboxed (no same-origin, no network). Edit source below.</p>
        <CodeEditor
          value={str(readPath(draft, "behavior.backgroundHTML"))}
          onChange={(v) => setField("behavior.backgroundHTML", v)}
          language="html"
          minRows={12}
          placeholder="backdrop HTML"
        />
      </>
    );
  }

  if (part === "modlua") {
    const hostSnips: ReadonlyArray<{ label: string; insert: string }> = [
      { label: "getChatVar", insert: 'getChatVar("name")' },
      { label: "setChatVar", insert: 'setChatVar("name", "value")' },
      { label: "log", insert: 'log("message")' },
    ];
    return (
      <>
        <WorkshopEhead
          title="Package scripts"
          sub={`${mod?.name ? `${mod.name} · ` : ""}advanced · sealed cargo`}
        />
        <p className={styles.hint}>
          Edited as source only. Runs only inside the sealed room (Run package scripts), never in the app chrome.
        </p>
        <div className={styles.hostPalette}>
          {hostSnips.map((s) => (
            <button
              key={s.label}
              type="button"
              className={macroStyles.macroChip}
              title={s.insert}
              onClick={() => onLua(`${luaCode}${luaCode.endsWith("\n") || !luaCode ? "" : "\n"}${s.insert}`)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <CodeEditor
          value={luaCode}
          onChange={onLua}
          language="lua"
          minRows={18}
          placeholder="-- package scripts"
        />
      </>
    );
  }

  if (part === "modregex") {
    return (
      <>
        <WorkshopEhead title="Module regex" sub={`${mod?.regexCount ?? 0} rows in the package`} />
        <p className={styles.hint}>Stub for now (same as card regex). Package rows stay on the module for export.</p>
      </>
    );
  }

  return (
    <>
      <WorkshopEhead title="Module lore" sub={`${mod?.lorebookCount ?? 0} entries in the package`} />
      <p className={styles.hint}>Stub for now. Full lore editor later; entries remain on the packaged module.</p>
    </>
  );
}
