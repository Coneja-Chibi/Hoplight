/**
 * CSS Workshop room: head, actions, stage with shared CssWorkshop leaf, optional tour.
 * Mode (simple | advanced) is owned here and mirrored in the leaf toggle.
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import {
  CssWorkshop,
  type CssSimpleTab,
  type CssWorkshopMode,
  CSS_FILE_ACCEPT,
  looksLikeCssFile,
  readCssFile,
  summarizeImport,
} from "../../components/css-workshop";
import { InkDialog } from "../../components/ink-dialog";
import { TourGuide } from "../../components/tour-guide";
import { hasSeenTour, tourSeenKey } from "../../tours/tour-core";
import { copyText, downloadCss } from "./actions";
import {
  asPrefString,
  DEFAULT_PACK_ID,
  PREF_DRAFT,
  PREF_PACK,
  STARTER_CSS,
} from "./prefs";
import cssWorkshopTour from "./tour";
import styles from "./styles.module.css";

const NOTE =
  "Standalone draft. Hoplight never applies this to the app chrome. Copy or download to paste on Chub, Janitor, Risu, or anywhere that takes CSS. Card-bound CSS still lives on the piece in the Workbench.";

const PREF_MODE = "css-workshop.mode";

const asMode = (v: unknown): CssWorkshopMode => (v === "advanced" ? "advanced" : "simple");

export interface CssWorkshopRoomProps {
  ctx: AppContext;
}

/** Full app canvas for the CSS Workshop dock tile. */
export function CssWorkshopRoom({ ctx }: CssWorkshopRoomProps): JSX.Element {
  const [css, setCss] = useState(() => asPrefString(ctx.prefs.get(PREF_DRAFT), STARTER_CSS));
  const [packId, setPackId] = useState(() =>
    asPrefString(ctx.prefs.get(PREF_PACK), DEFAULT_PACK_ID),
  );
  const [mode, setMode] = useState<CssWorkshopMode>(() => asMode(ctx.prefs.get(PREF_MODE)));
  const [simpleTab, setSimpleTab] = useState<CssSimpleTab>(() =>
    asPrefString(ctx.prefs.get(PREF_DRAFT), STARTER_CSS).trim() === "" ? "starters" : "assist",
  );
  const [flash, setFlash] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ctx.setStatus(mode === "advanced" ? "css workshop · advanced" : "css workshop · simple");
  }, [ctx, mode]);

  useEffect(() => {
    if (hasSeenTour(ctx.prefs.get(tourSeenKey("css-workshop")))) return;
    const t = window.setTimeout(() => setTourOpen(true), 400);
    return () => window.clearTimeout(t);
  }, [ctx]);

  const persist = useCallback(
    (next: string) => {
      setCss(next);
      ctx.prefs.set(PREF_DRAFT, next);
    },
    [ctx],
  );

  const persistPack = useCallback(
    (id: string) => {
      setPackId(id);
      ctx.prefs.set(PREF_PACK, id);
    },
    [ctx],
  );

  const persistMode = useCallback(
    (next: CssWorkshopMode) => {
      setMode(next);
      ctx.prefs.set(PREF_MODE, next);
    },
    [ctx],
  );

  const onCopy = async (): Promise<void> => {
    const ok = await copyText(css);
    setFlash(ok ? "copied plain CSS" : "copy failed - open Source and copy manually");
    ctx.setStatus(ok ? "css workshop · copied" : "css workshop · copy failed");
  };

  const onDownload = (): void => {
    downloadCss(css, "vaude-style.css");
    setFlash("downloaded vaude-style.css");
    ctx.setStatus("css workshop · downloaded");
  };

  const onClear = (): void => {
    setClearOpen(false);
    persist("");
    persistMode("simple");
    setSimpleTab("starters");
    setFlash("draft cleared");
    ctx.setStatus("css workshop · cleared");
  };

  const onImportFile = async (file: File): Promise<void> => {
    if (!looksLikeCssFile(file.name) && file.type && !file.type.includes("css") && !file.type.includes("text")) {
      setFlash("pick a .css file");
      return;
    }
    try {
      const text = await readCssFile(file);
      const sum = summarizeImport(text);
      persist(text);
      persistMode("advanced");
      const free = sum.freeform ? " · freeform kept" : "";
      setFlash(`imported ${file.name} · ${sum.rules} rule${sum.rules === 1 ? "" : "s"}${free}`);
      ctx.setStatus(`css workshop · imported ${sum.rules} rules`);
    } catch {
      setFlash("could not read that file");
      ctx.setStatus("css workshop · import failed");
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void onImportFile(f);
  };

  return (
    <div className={styles.room}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>App · style</span>
          <h1 className={styles.title}>CSS Workshop</h1>
          <p className={styles.lede}>
            Simple mode is the guided ladder. Advanced is code plus rule breakdown. Flip anytime.
            Import a .css file to load it into Advanced.
          </p>
        </div>
        <div className={styles.actions}>
          <div className={styles.modeToggle} role="group" aria-label="Editor mode">
            <button
              type="button"
              className={mode === "simple" ? `${styles.modeBtn} ${styles.modeOn}` : styles.modeBtn}
              aria-pressed={mode === "simple"}
              onClick={() => persistMode("simple")}
            >
              Simple
            </button>
            <button
              type="button"
              className={mode === "advanced" ? `${styles.modeBtn} ${styles.modeOn}` : styles.modeBtn}
              aria-pressed={mode === "advanced"}
              onClick={() => persistMode("advanced")}
            >
              Advanced
            </button>
          </div>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void onCopy()}
          >
            copy CSS
          </button>
          <button type="button" className={styles.btn} onClick={onDownload}>
            download .css
          </button>
          <button type="button" className={styles.btn} onClick={() => fileRef.current?.click()}>
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
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => setClearOpen(true)}
          >
            clear draft
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => setTourOpen(true)}
          >
            tour
          </button>
          {flash ? <span className={styles.flash}>{flash}</span> : null}
        </div>
      </header>

      <div className={styles.stage}>
        <CssWorkshop
          value={css}
          onChange={persist}
          defaultPackId={packId}
          onPackChange={persistPack}
          note={NOTE}
          mode={mode}
          onModeChange={persistMode}
          simpleTab={simpleTab}
          onSimpleTabChange={setSimpleTab}
        />
      </div>

      {tourOpen && (
        <TourGuide tour={cssWorkshopTour} ctx={ctx} onClose={() => setTourOpen(false)} />
      )}

      {clearOpen && (
        <InkDialog onDismiss={() => setClearOpen(false)} ariaLabel="Clear the draft">
          <div className={styles.clearSheet}>
            <b className={styles.clearTitle}>Clear the draft?</b>
            <p className={styles.clearBody}>Your unsaved CSS goes away.</p>
            <div className={styles.clearActs}>
              <button type="button" className={styles.clearGo} onClick={onClear}>
                Clear
              </button>
              <button type="button" className={styles.clearKeep} onClick={() => setClearOpen(false)}>
                Keep
              </button>
            </div>
          </div>
        </InkDialog>
      )}
    </div>
  );
}
