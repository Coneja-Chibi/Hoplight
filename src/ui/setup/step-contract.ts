/**
 * The setup-step contract (CONTRACT V2, React) - folders-as-schema for the first-run wizard
 * (DECISIONS #10 build law). A STEP is a folder in src/ui/setup/steps/<name>/ whose index.tsx
 * default-exports a SetupStep. The server discovers and bundles them exactly like apps; the wizard
 * imports them, orders them, and derives EVERYTHING from the list: progress dots, "N of M",
 * defaults, skip-all, the stage zones, the summary sentence, the recap chips. Adding a step =
 * dropping a folder in; nothing central is edited. Steps render JSX now instead of building DOM.
 */
import type { ReactNode } from "react";
import type { FormatInfo } from "../app-contract";

/** One pressable answer. `value` is what lands in settings (defaults to `id`). */
export interface SetupOption {
  id: string;
  /** plain-English label ("Characters") */
  title: string;
  /** one-line explanation under the title ("The people you create.") */
  sub?: string;
  /** stored settings value when this differs from id (e.g. accent name -> hex) */
  value?: unknown;
  /** pre-pressed when the user reaches the step; exactly one per single-select step */
  isDefault?: boolean;
  /** multi-select only: pressing this clears the group ("Not sure yet") */
  clears?: boolean;
}

export interface SetupStepManifest {
  /** folder name = step id */
  id: string;
  /** screen ordering (lower = earlier); dots and "N of M" derive from the sorted list */
  order: number;
  /** the one plain question ("Light or dark?"); "\n" marks the locked line break */
  question: string;
  /** the italic reassurance line under the question */
  say: string;
  /** which StudioSettings key this step writes (use SETTING_KEYS, no magic strings) */
  settingsKey: string;
  /** multi-select group (publish targets); single-select otherwise */
  multi?: boolean;
  /** extra class on the options container so the step's own css can shape it ("pair", "swatches") */
  layoutClass?: string;
  /** the house-cap status line while this step is current ("deck standing up") */
  stageNote: string;
}

/** A summary-sentence fragment; the wizard joins them: "A [dark] workspace, starting with ..." */
export interface SummaryFragment {
  pre?: string;
  strong: string;
  post?: string;
}

/** The wizard's answers so far, keyed by settingsKey. Singles hold a value; multis hold arrays. */
export type SetupDraft = Record<string, unknown>;

/** The narrow door steps get (data-driven options; never the engine or the filesystem). */
export interface SetupContext {
  formats(): Promise<FormatInfo[]>;
}

export interface SetupStep {
  manifest: SetupStepManifest;
  /** step-owned css (its zone + its option widgets); the wizard injects it once, combined */
  css?: string;
  /** resolve options; may be data-driven via ctx (publish targets from the live format registry) */
  options(ctx: SetupContext): SetupOption[] | Promise<SetupOption[]>;
  /** whole-group options override (the accent step's shared SwatchRow); receives the live picker
   * `onPick` so the group can drive selection through the wizard's own single/multi logic instead
   * of reimplementing it. Absent = the wizard renders one card per option (renderOption / default). */
  renderOptions?(options: SetupOption[], draft: SetupDraft, onPick: (opt: SetupOption) => void): ReactNode;
  /** custom single-option card (theme's thumbnails); the wizard supplies pressed state + the click
   * handler. Absent = the standard title/sub option card. Ignored when renderOptions is set. */
  renderOption?(opt: SetupOption, pressed: boolean, onPick: () => void): ReactNode;
  /** this step's stage zone, re-rendered on every answer; render the GHOST state while the
   * draft has no value yet (unanswered = waiting in the dark). Absent = no zone. */
  renderZone?(draft: SetupDraft, options: SetupOption[]): ReactNode;
  /** CSS custom properties this step paints onto the stage root (the accent step's live --accent
   * repaint); merged from every step, in step order, each render. Absent = no stage vars. */
  stageVars?(draft: SetupDraft): Record<string, string> | undefined;
  /** The page-level theme this step's answer implies ("paper" | "stage"); the wizard applies the
   * last defined answer to the document so the wizard itself wears the pick live. */
  pageTheme?(draft: SetupDraft): string | undefined;
  /** CSS custom properties painted onto the WIZARD ROOT (the accent step's --wiz-a live repaint
   * of selection marks); merged like stageVars. Brand mark + CTAs never follow (DECISIONS #3). */
  pageVars?(draft: SetupDraft): Record<string, string> | undefined;
  /** Extra settings derived from this step's answer at completion (the makes step derives
   * firstDeck from the first pick); merged over the draft, before setupComplete. */
  deriveSettings?(draft: SetupDraft): Record<string, unknown> | undefined;
  /** fragment for the final summary sentence; null = omitted (e.g. no publish picks) */
  phrase(draft: SetupDraft, options: SetupOption[]): SummaryFragment | null;
  /** recap chip on the final screen ("theme dark"); null = omitted */
  recap(draft: SetupDraft, options: SetupOption[]): { label: string; value: string } | null;
}
