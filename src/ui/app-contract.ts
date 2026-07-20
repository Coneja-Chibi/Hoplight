/**
 * The Vaude app contract v2 (ADR-008, CONTRACT V2) - the dock's folders-as-schema, React shaped.
 * An APP is a folder in src/ui/apps/<name>/ whose index.tsx default-exports a VaudeApp. The server
 * discovers and bundles them; the client builds the dock from the manifest and renders the app's
 * Component into the Workbench canvas. Drop a folder in, the dock gains a tile - nothing central
 * lists apps, exactly like format adapters. This file is shared by server (discovery) and client
 * (mounting), so it imports react and the menu types only as `import type` - erased at build time,
 * no runtime framework dependency leaks into discovery.
 */
import type { ReactNode } from "react";
import type { ContextMenus } from "./shell/store";
import type { ParseReport, SerializeReport } from "../core/reports";

/** What the dock needs to draw a tile before the app's code is even loaded. */
export interface AppManifestEntry {
  /** folder name = app id (open string; drop-ins claim any id) */
  id: string;
  /** tile label ("The Library") */
  title: string;
  /** flat-ink SVG markup for the tile mark (family grammar: no gradients, no glow) */
  markSvg: string;
  /** the app's own accent (hex); NEVER brand rose - that stays on the beam-V and CTAs */
  accent: string;
  /** dock ordering (lower = higher) */
  order: number;
  /** the tile's mono second line ("app · home", "app · convert"); futures say "installs later" */
  subtitle?: string;
  /** pinned into the dock's foot (Settings), above the bench tray */
  dockFoot?: boolean;
  /** dimmed "installs later" tile: shown in the dock, not mountable yet */
  comingSoon?: boolean;
  /** this app is the surface a brand-new studio lands on right after setup (JOURNEY 1.1) */
  firstRunLanding?: boolean;
  /** this app is where open pieces are edited: the shell's tab strip focuses into it */
  editsPieces?: boolean;
  /** placeholder for the agent-surface plan (state selector + offered actions land later);
   * typed now so manifests can start carrying a plain-words description of the surface. */
  agentSurface?: { describe: string };
}

/** Everything an app may touch. Apps NEVER import the engine or reach the filesystem directly:
 * the shell hands them this context, and all IO goes through the local API - one engine, thin
 * shells. Theme lives in the shell store now (apps read it via useShellStore if they need it);
 * there is no `root` - a VaudeApp renders JSX, the shell owns the DOM. */
export interface AppContext {
  /** authenticated-local API base (loopback server) */
  api: {
    listEntities(kind?: string): Promise<StudioEntitySummary[]>;
    getEntity(id: string): Promise<unknown>;
    /** Persist an entity. `overwrite: true` for editor re-saves; omit for import keep-both. */
    saveEntity(entity: unknown, opts?: { overwrite?: boolean }): Promise<StudioEntitySummary>;
    /** Persist a character plus related lorebooks; rewrites keep-both knowledgeRefs. */
    saveBundle(payload: {
      entity: unknown;
      related?: { lorebooks?: unknown[] };
      overwrite?: boolean;
    }): Promise<SaveBundleResult>;
    inspectFile(file: File): Promise<InspectResult>;
    exportEntity(entity: unknown, targetId: string): Promise<ExportResult>;
    formats(): Promise<FormatInfo[]>;
    /** per-platform canonical-path coverage claims - the editor lens's ground truth (vs-editor-2) */
    coverage(): Promise<CoverageInfo[]>;
  };
  /** update the mono status bar's app segment */
  setStatus(text: string): void;
  /** every installed app's manifest (Settings needs the roster for the home-app picker) */
  apps(): AppManifestEntry[];
  /** THE right-click system (src/ui/shell/store.ts): attach targets on your elements, register
   * providers for target types; one consistent menu everywhere, extended by registration. Prefer
   * the `useContextMenu` hook for React elements (attaches on mount, detaches on unmount); `attach`
   * stays here for the shell's own imperative use (e.g. the document-level fallback target) and
   * now returns a detach function. */
  menus: ContextMenus;
  /** per-user app preferences, persisted into the studio's settings.json open record
   * (namespace your key by app id: "workbench.view"); read returns undefined when unset */
  prefs: {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
  };
  /** THE WORKBENCH's open pieces - shell-owned (they ARE the tab strip) so they persist across
   * app switches. Sending honors the user's follow setting (ask / always / never). */
  workbench: {
    pieces(): StudioEntitySummary[];
    /** the piece whose editor the Workbench shows */
    active(): StudioEntitySummary | null;
    /** the piece pinned beside the active one, or null when the stage is a single pane. ANY kind
     * can sit beside any other - the split lives in the shell, not in one editor. */
    beside(): StudioEntitySummary | null;
    /** open a piece on the Workbench (follow-prompt per settings; no-op if already open) */
    send(s: StudioEntitySummary): void;
    /** pin a piece into the second pane beside the active one (opens it first if needed) */
    openBeside(s: StudioEntitySummary): void;
    /** collapse back to a single pane; the pinned piece stays open as a tab */
    closeSplit(): void;
    /** open a batch of pieces at once (already-open ones are skipped); the follow-prompt fires
     * ONCE with the count actually opened - the multi-select commit path */
    sendMany(pieces: StudioEntitySummary[]): void;
    /** close a piece */
    remove(id: string, kind: string): void;
    /** is this piece open on the Workbench? */
    isOpen(id: string, kind: string): boolean;
    /** report an editor's unsaved state; the shell tab wears the dirty dot (the one saved/unsaved
     * indicator - no "saved locally" pill competes with it) */
    setDirty(id: string, kind: string, dirty: boolean): void;
    /** per-piece last-opened timestamps ("kind:id" -> epoch ms); merged with importedAt to rank
     * the Workbench recents rail. A copy - callers never mutate the store. */
    recents(): Record<string, number>;
    /** activate a piece's tab and go to the Workbench */
    focus(id: string, kind: string): void;
    /** subscribe to changes; returns an unsubscribe (call it in the app's cleanup) */
    onChange(cb: () => void): () => void;
  };
  /** The Press's staged queue (staging grammar: the Library stages, the Press works the set). Same
   * one-door rule as workbench: apps never import shell modules. */
  press: {
    queue(): StudioEntitySummary[];
    stage(batch: StudioEntitySummary[]): void;
    unstage(id: string, kind: string): void;
    clear(): void;
    onChange(cb: () => void): () => void;
  };
}

/** The module an app folder default-exports. Component renders the app's whole surface; the shell
 * mounts it into the Workbench canvas and hands it the context every render. */
export interface VaudeApp {
  manifest: AppManifestEntry;
  Component: (props: { ctx: AppContext }) => ReactNode;
}

// -- shared wire shapes (server <-> client) ---------------------------------------------------------

export interface StudioEntitySummary {
  id: string;
  kind: string;
  name: string;
  /** friendly source line for the receipt ("A character card, made for SillyTavern.") */
  provenance?: string;
  /** entity accent when authored */
  accent?: string;
  importedAt?: string;
  /** the entity carries displayable art at /api/studio/portrait?kind=..&id=.. */
  hasPortrait?: boolean;
  /** source format id ("sillytavern") + its variant ("v3") for the card-type chip */
  sourceFormat?: string;
  sourceVariant?: string;
  /**
   * Optional view params. Lorebooks use `focusEntry` so the same book can open beside itself
   * on two different entries (pane key is kind:id@focusEntry; dirty stays kind:id).
   */
  params?: { focusEntry?: string };
}

export interface InspectResult {
  ok: boolean;
  /** friendly, plain-words lines for the receipt (already humanized by the server) */
  receipt?: { name: string; kindLine: string; extras: string[] };
  entity?: unknown;
  /** Related entities extracted with the primary (same pass as CLI inspectBundle). */
  related?: { lorebooks?: unknown[] };
  formatId?: string;
  kind?: string;
  parseReport?: ParseReport;
  /** plain-words failure ("We could not read this one. ...") - warm, never technical */
  error?: string;
}

/** Result of POST /api/studio/save-bundle. Partial failures retain already-written related entities. */
export interface SaveBundleResult {
  ok: boolean;
  primary?: StudioEntitySummary;
  related: StudioEntitySummary[];
  knowledgeRefs?: string[];
  partial?: boolean;
  error?: string;
}

export interface ExportResult {
  suggestedExtension: string;
  text?: string;
  bytesB64?: string;
  report: SerializeReport;
}

export interface FormatInfo {
  id: string;
  label: string;
  kind: string;
  outputExtensions: string[];
  /** human platform name for receipts/pickers ("SillyTavern", "RisuAI") */
  friendly: string;
  /** Vaude's own storage format: never offered as an external publish target */
  native: boolean;
  /** the generic reader of a family: its cards chip as "Default", not a platform name */
  generic: boolean;
}

/** One platform's coverage claims (served by /api/coverage; declared in src/formats/<id>/coverage.ts).
 * The editor lens computes every dim/tag from these - the editor itself knows zero platforms. */
export interface CoverageInfo {
  id: string;
  label: string;
  /** canonical body path prefixes the platform's wire carries (dot-boundary prefix semantics) */
  carries: string[];
  notes?: Record<string, string>;
  /** false = export honesty only; omit from the editor platform strip. Default true. */
  lens?: boolean;
}
