/**
 * Studio settings - the pure shape + parser (functional core; the fs store lives in settings.ts).
 * Settings are an OPEN record: the shell owns the known keys below, and drop-in setup steps may
 * write their own keys without touching this file (same open-by-design rule as format ids).
 * Parsing is fail-closed per key: a bad value drops to absent, never poisons the rest.
 */

/** Known keys, exported so steps/shell/settings share one spelling (no magic strings). */
export const SETTING_KEYS = {
  theme: "theme",
  firstDeck: "firstDeck",
  /** the deck kinds picked at setup ("what do you want to make?"); firstDeck = the first pick */
  makes: "makes",
  publishTargets: "publishTargets",
  houseAccent: "houseAccent",
  /** which app opens on boot; the user picks in Settings */
  homeApp: "homeApp",
  /** what happens after sending pieces to the Workbench: "ask" | "always" | "never" (follow) */
  workbenchFollow: "workbench.follow",
  /** per-piece last-opened epoch-ms map ("kind:id" -> ms); feeds the Workbench recents rail */
  workbenchRecents: "workbench.recents",
  /** user collapsed the app dock to marks-only (the same language as the locked narrow mode) */
  dockSlim: "shell.dockSlim",
} as const;

export interface StudioSettings {
  /** false until the first-run wizard's OPEN VAUDE */
  setupComplete: boolean;
  /** "paper" = light letterpress, "stage" = dark forge */
  theme?: "paper" | "stage";
  /** canonical kind the library opens on ("character", "lorebook", ...) */
  firstDeck?: string;
  /** friendly platform names picked at setup; empty = "not sure yet" (every format stays ready) */
  publishTargets?: string[];
  /** house accent hex for chrome/empty states; NEVER recolors the brand rose mark */
  houseAccent?: string;
  /** drop-in setup steps write their own keys here */
  [key: string]: unknown;
}

export const DEFAULT_SETTINGS: StudioSettings = { setupComplete: false };

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v);

/** Tolerant, fail-closed reader: anything malformed reads as absent, never throws. */
export function parseSettings(raw: unknown): StudioSettings {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_SETTINGS };
  const rec = raw as Record<string, unknown>;
  const out: StudioSettings = { ...rec, setupComplete: rec.setupComplete === true };
  if (rec.theme === "paper" || rec.theme === "stage") out.theme = rec.theme;
  else delete out.theme;
  if (typeof rec.firstDeck === "string" && rec.firstDeck) out.firstDeck = rec.firstDeck;
  else delete out.firstDeck;
  if (Array.isArray(rec.publishTargets)) {
    out.publishTargets = rec.publishTargets.filter((t): t is string => typeof t === "string" && t !== "");
  } else {
    delete out.publishTargets;
  }
  if (isHex(rec.houseAccent)) out.houseAccent = rec.houseAccent;
  else delete out.houseAccent;
  return out;
}
