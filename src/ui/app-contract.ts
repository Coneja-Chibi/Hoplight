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
  /** this app is the surface a brand-new studio lands on right after setup (JOURNEY 1.1) */
  firstRunLanding?: boolean;
  /** this app is where open pieces are edited: the shell's tab strip focuses into it */
  editsPieces?: boolean;
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
  /** update the mono status bar's app segment */
  setStatus(text: string): void;
  /** every installed app's manifest (Settings needs the roster for the home-app picker) */
  apps(): AppManifestEntry[];
  /** THE right-click system (src/ui/_shared/context-menu.ts): attach targets on your elements,
   * register providers for target types; one consistent menu everywhere, extended by registration */
  menus: import("./_shared/context-menu").ContextMenus;
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
    /** open a piece on the Workbench (follow-prompt per settings; no-op if already open) */
    send(s: StudioEntitySummary): void;
    /** open a batch of pieces at once (already-open ones are skipped); the follow-prompt fires
     * ONCE with the count actually opened - the multi-select commit path */
    sendMany(pieces: StudioEntitySummary[]): void;
    /** close a piece */
    remove(id: string, kind: string): void;
    /** is this piece open on the Workbench? */
    isOpen(id: string, kind: string): boolean;
    /** per-piece last-opened timestamps ("kind:id" -> epoch ms); merged with importedAt to rank
     * the Workbench recents rail. A copy - callers never mutate the store. */
    recents(): Record<string, number>;
    /** activate a piece's tab and go to the Workbench */
    focus(id: string, kind: string): void;
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
  /** source format id ("sillytavern") + its variant ("v3") for the card-type chip */
  sourceFormat?: string;
  sourceVariant?: string;
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
  /** the generic reader of a family: its cards chip as "Default", not a platform name */
  generic: boolean;
}
