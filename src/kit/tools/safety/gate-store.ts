/**
 * Remembering how often you want to be asked.
 *
 * `/gates` has worked since it was written, and the setting died with the session: every restart came
 * back to `guarded` and asked about everything again. A preference you have to re-state every launch
 * is not a preference, it is a prompt with extra steps.
 *
 * IT FAILS CLOSED, ALWAYS. A missing file, unreadable file, corrupt JSON, or a mode nothing defines
 * all resolve to `guarded` - the setting that asks about everything. The one direction this must
 * never fail is open: a truncated write must not be able to grant standing permission to write,
 * delete, or send, and the safest thing a damaged file can say is nothing.
 *
 * `locked` is deliberately NOT restorable. It is a panic stop somebody hit during a session about
 * that session; carrying it into the next one would leave Kit inert on launch with no obvious cause.
 */
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { configDir } from "../../providers/config";
import type { PermissionMode } from "./gate-core";

/** The setting that asks about everything. Every failure resolves here. */
export const SAFE_MODE: PermissionMode = "guarded";

/** Modes worth remembering. `locked` is a panic stop, not a preference. */
const REMEMBERED = new Set<PermissionMode>(["guarded", "autopilot", "full"]);

export const gatesFile = (): string => join(configDir(), "gates.json");

/**
 * The mode a stored value names, or the safe one.
 *
 * Pure, so the fail-closed rule is testable without a filesystem - which matters more here than
 * anywhere else in Kit, because the failure mode being guarded against is silent over-permission.
 */
export function modeFromStored(raw: unknown): PermissionMode {
  if (typeof raw !== "object" || raw === null) return SAFE_MODE;
  const mode = (raw as { mode?: unknown }).mode;
  if (typeof mode !== "string") return SAFE_MODE;
  return REMEMBERED.has(mode as PermissionMode) ? (mode as PermissionMode) : SAFE_MODE;
}

/** Read the remembered mode. Never throws; anything unreadable is `guarded`. */
export async function readGateMode(path: string = gatesFile()): Promise<PermissionMode> {
  try {
    return modeFromStored(JSON.parse(await readFile(path, "utf8")));
  } catch {
    // No file yet is the common case and not an error: a fresh install asks about everything.
    return SAFE_MODE;
  }
}

/**
 * Remember a mode. Reports whether it stuck, so the command can say so rather than implying it.
 *
 * A setting that silently fails to save is worse than one that cannot be saved at all: you would
 * believe you had turned the asking down, and find out otherwise one restart later.
 */
export async function writeGateMode(
  mode: PermissionMode,
  path: string = gatesFile(),
): Promise<boolean> {
  if (!REMEMBERED.has(mode)) return false;
  try {
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, `${JSON.stringify({ mode }, null, 2)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}
