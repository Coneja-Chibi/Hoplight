/**
 * Where this machine keeps its engine checkouts - the folder somebody pointed at, not the variable.
 *
 * ONE FILE, TWO FRONT DOORS. Kit in the terminal and the studio window are the same program from
 * two directions, and "I gave it to Kit and never made an interface for it" is exactly the gap this
 * closes: a root set in Settings is the root preset_verify uses in the terminal, because both read
 * engines.json out of the same studio folder. Same rule as the provider vault.
 *
 * NOT IN settings.json, and the reason is a boundary that already exists. A settings GET is served
 * to a tailed-in or LAN device (only writes are host-only), and /api/version deliberately withholds
 * the studio path from those same devices - "never leak the host filesystem path to a remote/LAN
 * device". An absolute checkout path carries the owner's username and disk layout, so it lives in
 * its own file and travels only over /api/macro-lab/*, which is host-only whole.
 *
 * FAIL-CLOSED PER KEY, like parseSettings: a malformed entry reads as absent rather than poisoning
 * the rest, and an unknown engine id is dropped. This value decides which folder a subprocess is
 * spawned against, so nothing that is not a plain non-empty string for a known engine survives.
 */
import { join } from "node:path";
import { nodeStudioFs, type StudioFs } from "./fs-backend";
import {
  applyEngineRoots,
  isRenderEngineId,
  type EngineRoots,
  type RenderEngineId,
} from "../core/preset/render/engines";

/** Lives beside settings.json in the studio folder. */
export const ENGINE_ROOTS_FILE = "engines.json";

/**
 * A path as a person supplies it, cleaned into a path a filesystem will accept.
 *
 * THE QUOTES MATTER. Windows Explorer's "Copy as path" and PowerShell's Copy-Path both yield
 * `"C:\Users\..."` WITH the quotation marks, and pasting that verbatim is the single most likely
 * thing to happen here. Without this, the most careful possible paste reports "that is not a
 * checkout" and blames the user for the clipboard.
 *
 * A trailing separator is dropped too - `C:\ST\` and `C:\ST` are the same folder, and keeping both
 * spellings would make "already set to that" untrue. A bare root (`C:\`, `/`) keeps its slash,
 * since removing it changes what the path means.
 */
export function normalizeRootInput(raw: string): string {
  let value = raw.trim();
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      value = value.slice(1, -1).trim();
    }
  }
  // A drive root or filesystem root keeps its separator; anything else loses a trailing one.
  const bare = /^[A-Za-z]:[\\/]$/.test(value) || value === "/" || value === "\\";
  if (!bare) value = value.replace(/[\\/]+$/, "");
  return value;
}

/** Tolerant reader: anything that is not a known engine naming a non-empty string is dropped. */
export function parseEngineRoots(raw: unknown): EngineRoots {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const rec = raw as Record<string, unknown>;
  const out: EngineRoots = {};
  for (const [key, value] of Object.entries(rec)) {
    if (!isRenderEngineId(key)) continue;
    if (typeof value !== "string") continue;
    const root = normalizeRootInput(value);
    if (root) out[key] = root;
  }
  return out;
}

const filePath = (dir: string): string => join(dir, ENGINE_ROOTS_FILE);

/**
 * The saved roots. A missing file is no roots; a corrupt one is no roots TOO.
 *
 * Deliberately softer than SettingsStore, which throws on corruption. Settings hold work somebody
 * did; this holds two folder names that are re-typed in a minute, and refusing to boot the Macro
 * Lab over a truncated JSON file would be a bad trade.
 */
export async function readEngineRoots(dir: string, io: StudioFs = nodeStudioFs): Promise<EngineRoots> {
  let text: string | null = null;
  try {
    text = await io.readText(filePath(dir));
  } catch {
    return {};
  }
  if (text === null) return {};
  try {
    return parseEngineRoots(JSON.parse(text));
  } catch {
    return {};
  }
}

/** Read the saved roots and hand them to core, so installRoot answers with them from here on. */
export async function loadEngineRoots(dir: string, io: StudioFs = nodeStudioFs): Promise<EngineRoots> {
  const roots = await readEngineRoots(dir, io);
  applyEngineRoots(roots);
  return roots;
}

/**
 * Every write, one at a time - the same reason SettingsStore serializes its own.
 *
 * Saving a root is read-modify-write over a file holding both engines. Two saves in flight at once
 * each read the state before the other wrote, and the second replace drops the first engine's
 * folder: you point at SillyTavern, point at Marinara, and SillyTavern is quietly gone. The window
 * disables the other buttons while one save is in flight, but a second tab does not know that, so
 * the guarantee belongs here rather than in a screen.
 */
let writeTail: Promise<unknown> = Promise.resolve();

/** Point one engine at a folder, or forget it (`null`). Returns the whole table as it now stands. */
export async function saveEngineRoot(
  dir: string,
  engine: RenderEngineId,
  root: string | null,
  io: StudioFs = nodeStudioFs,
): Promise<EngineRoots> {
  const write = async (): Promise<EngineRoots> => {
    const current = await readEngineRoots(dir, io);
    const next: EngineRoots = { ...current };
    if (root === null || normalizeRootInput(root) === "") delete next[engine];
    else next[engine] = normalizeRootInput(root);
    await io.mkdirp(dir);
    await io.writeAtomicReplace(filePath(dir), JSON.stringify(next, null, 2));
    applyEngineRoots(next);
    return next;
  };
  // Both arms run it: a save that failed must not stop the next one from being attempted.
  const work = writeTail.then(write, write);
  writeTail = work.then(() => undefined, () => undefined);
  return work;
}
