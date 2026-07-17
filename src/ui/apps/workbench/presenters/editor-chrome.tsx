/**
 * Editor chrome: platform lens tabstrip + header row (name, scale, mode bar, save/export).
 * Pure presentational; state stays in Editor.tsx. Renders BOTH the desktop chrome and the
 * mobile grammar (design/vs-mobile-editors.html); Editor.module.css picks one by pane width.
 */
import type { JSX, ReactNode } from "react";
import type { CoverageInfo } from "../../../app-contract";
import { LensRail } from "../../../components/lens-rail";
import { MobileEditorHead, type MobileMenuItem } from "../../../components/mobile-editor-head";
import { PlatformTabs, type OffTarget } from "../../../components/platform-tabs";
import { ProgressChecklist } from "../../../components/progress-checklist";
import { EditorModeBar } from "./editor-modebar";

export function EditorTabstrip({
  coverage,
  targets,
  platformLabel,
  toggleTarget,
  clearTargets,
  offTarget,
  pickOffTarget,
  lensActive,
  lensVisibleCount,
  lensTotalCount,
  doneCount,
  chips,
  styles,
}: {
  coverage: CoverageInfo[];
  targets: string[];
  platformLabel(id: string): string;
  toggleTarget(id: string): void;
  clearTargets(): void;
  offTarget: OffTarget;
  pickOffTarget(m: OffTarget): void;
  lensActive: boolean;
  lensVisibleCount: number;
  lensTotalCount: number;
  doneCount: number;
  chips: ReadonlyArray<readonly [string, boolean]>;
  styles: Readonly<Record<string, string>>;
}): JSX.Element {
  const lensPlatforms = coverage
    .filter((c) => c.lens !== false)
    .map((c) => ({ id: c.id, label: platformLabel(c.id) }));
  return (
    <>
      <div className={`${styles.tabstrip} ${styles.desktopChrome}`} data-tour="lens">
        <PlatformTabs
          platforms={lensPlatforms}
          selected={targets}
          onToggle={toggleTarget}
          onClear={clearTargets}
          offTarget={offTarget}
          onOffTarget={pickOffTarget}
        />
        <span className={styles.done}>
          {lensActive && (
            <span
              className={styles.lensStat}
              title="How many body fields stay on for the selected platform(s). Off-target fields are removed."
            >
              {`Lens ${lensVisibleCount}/${lensTotalCount}`}
            </span>
          )}
          <span className={styles.frac}>{`${doneCount}/${chips.length}`}</span>
          {chips.map(([label, ok]) => (
            <span key={label} className={`${styles.chip}${ok ? ` ${styles.chipOk}` : ""}`}>
              {label}
            </span>
          ))}
        </span>
      </div>
      <div className={styles.mobileChrome}>
        <LensRail
          platforms={lensPlatforms}
          selected={targets}
          onToggle={toggleTarget}
          onClear={clearTargets}
          offTarget={offTarget}
          onOffTarget={pickOffTarget}
        />
        <ProgressChecklist
          items={chips}
          extraStat={lensActive ? `Lens ${lensVisibleCount}/${lensTotalCount}` : undefined}
        />
      </div>
    </>
  );
}

export function EditorHeader({
  name,
  version,
  onClose,
  editorScale,
  stepScale,
  setEditorScale,
  scaleMin,
  scaleMax,
  onboarded,
  mode,
  setMode,
  editorLayout,
  setEditorLayout,
  hasBehavior,
  workshop,
  setWorkshop,
  saving,
  dirty,
  doSave,
  openExport,
  topRight,
  styles,
}: {
  name: string;
  version: string;
  onClose(): void;
  editorScale: number;
  stepScale(dir: -1 | 1): void;
  setEditorScale(n: number): void;
  scaleMin: number;
  scaleMax: number;
  onboarded: boolean;
  mode: "grid" | "interview";
  setMode(m: "grid" | "interview"): void;
  editorLayout: "bento" | "playbill";
  setEditorLayout(l: "bento" | "playbill"): void;
  hasBehavior: boolean;
  workshop: boolean;
  setWorkshop(v: boolean): void;
  saving: boolean;
  dirty: boolean;
  doSave(): void;
  openExport(): void;
  topRight?: ReactNode;
  styles: Readonly<Record<string, string>>;
}): JSX.Element {
  const kebab: MobileMenuItem[] = [
    { label: "Export", onPick: openExport },
    { label: onboarded && mode === "interview" ? "Grid mode" : "Guided mode", onPick: () => setMode(mode === "interview" ? "grid" : "interview"), disabled: !onboarded },
    { label: editorLayout === "bento" ? "Playbill layout" : "Bento layout", onPick: () => setEditorLayout(editorLayout === "bento" ? "playbill" : "bento") },
    ...(hasBehavior ? [{ label: workshop ? "Leave workshop" : "Workshop", onPick: () => setWorkshop(!workshop) }] : []),
    { label: "Bigger text", onPick: () => stepScale(1), disabled: editorScale >= scaleMax },
    { label: "Smaller text", onPick: () => stepScale(-1), disabled: editorScale <= scaleMin },
    { label: "Reset scale", onPick: () => setEditorScale(1) },
  ];
  return (
    <>
    <div className={styles.mobileChrome}>
      <MobileEditorHead
        name={name}
        sub={`${version !== "" && version.length <= 16 ? `${version} · ` : ""}${saving ? "saving…" : dirty ? "unsaved changes" : "saved locally"}`}
        dirty={dirty}
        saving={saving}
        onBack={onClose}
        onSave={() => void doSave()}
        menu={kebab}
      />
    </div>
    <div className={`${styles.hdr} ${styles.desktopChrome}`}>
      <button type="button" className={styles.back} aria-label="Close" title="Close" onClick={onClose}>
        &#8592;
      </button>
      <b>{name.toUpperCase()}</b>
      {version !== "" && version.length <= 16 && (
        <span className={styles.vchip}>{version}</span>
      )}
      <span className={styles.hdrRight}>
        <span className={styles.escale} title="Scale the editor">
          <button type="button" className={styles.escaleStep} onClick={() => stepScale(-1)} disabled={editorScale <= scaleMin} aria-label="Scale editor down" title="Smaller">
            &#8722;
          </button>
          <button type="button" className={styles.escalePct} onClick={() => setEditorScale(1)} title="Reset to 100%">
            {`${Math.round(editorScale * 100)}%`}
          </button>
          <button type="button" className={styles.escaleStep} onClick={() => stepScale(1)} disabled={editorScale >= scaleMax} aria-label="Scale editor up" title="Bigger">
            &#43;
          </button>
        </span>
        <EditorModeBar
          onboarded={onboarded}
          mode={mode}
          setMode={setMode}
          editorLayout={editorLayout}
          setEditorLayout={setEditorLayout}
          hasBehavior={hasBehavior}
          workshop={workshop}
          setWorkshop={setWorkshop}
          styles={styles}
        />
        <button type="button" className={styles.save} data-tour="save" disabled={saving || !dirty} onClick={() => void doSave()} title="Save · ctrl+s">
          {saving ? "Saving…" : dirty ? "Save" : "● Saved locally"}
        </button>
        <button
          type="button"
          className={styles.save}
          onClick={openExport}
          title="Export to a platform file"
        >
          Export
        </button>
        {topRight}
      </span>
    </div>
    </>
  );
}
