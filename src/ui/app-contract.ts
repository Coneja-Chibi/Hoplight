/**
 * The Vaude app contract - the dock's folders-as-schema (DECISIONS #14, the locked shell).
 * An APP is a folder in src/ui/apps/<name>/ whose index.ts default-exports a VaudeApp. The server
 * discovers and bundles them; the client builds the dock from the manifest. Drop a folder in, the
 * dock gains a tile - nothing central lists apps, exactly like format adapters. This file is shared
 * by server (discovery) and client (mounting), so it stays dependency-free and DOM-light.
 */

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
  /** this app is the surface a brand-new studio lands on right after setup (JOURNEY 1.1);
   * normal boots still open the lowest-order app */
  firstRunLanding?: boolean;
}

/** Everything an app may touch. Apps NEVER import the engine or reach the filesystem directly:
 * the shell hands them this context, and all IO goes through the local API - one engine, thin shells. */
export interface AppContext {
  /** the element the app owns; the shell clears it between mounts */
  root: HTMLElement;
  /** current theme, live-updated ("paper" = light letterpress, "stage" = dark forge) */
  theme: "paper" | "stage";
  /** authenticated-local API base (loopback server) */
  api: {
    listEntities(kind?: string): Promise<StudioEntitySummary[]>;
    getEntity(id: string): Promise<unknown>;
    saveEntity(entity: unknown): Promise<StudioEntitySummary>;
    inspectFile(file: File): Promise<InspectResult>;
    exportEntity(entity: unknown, targetId: string): Promise<ExportResult>;
    formats(): Promise<FormatInfo[]>;
  };
  /** open an entity as a TAB (the shell owns the tab strip) */
  openEntity(summary: StudioEntitySummary): void;
  /** update the mono status bar's app segment */
  setStatus(text: string): void;
  /** THE BENCH - the pack being threaded, shell-owned so it persists across app switches
   * (the dock tray's decklist renders from it; the Library's "on the bench" ticks read it) */
  bench: {
    pieces(): StudioEntitySummary[];
    /** thread a piece on (no-op if already threaded) */
    thread(s: StudioEntitySummary): void;
    /** pull a piece off */
    unthread(id: string, kind: string): void;
    /** subscribe to changes; returns an unsubscribe (call it in the app's cleanup) */
    onChange(cb: () => void): () => void;
  };
}

/** The module an app folder default-exports. */
export interface VaudeApp {
  manifest: AppManifestEntry;
  /** render into ctx.root; return a cleanup called before unmount */
  mount(ctx: AppContext): void | (() => void);
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
}

export interface InspectResult {
  ok: boolean;
  /** friendly, plain-words lines for the receipt (already humanized by the server) */
  receipt?: { name: string; kindLine: string; extras: string[] };
  entity?: unknown;
  formatId?: string;
  kind?: string;
  /** plain-words failure ("We could not read this one. ...") - warm, never technical */
  error?: string;
}

export interface ExportResult {
  suggestedExtension: string;
  text?: string;
  bytesB64?: string;
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
}
