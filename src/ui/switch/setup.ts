/**
 * Boot wiring for version switching: build the SwitchManager the trusted handler drives. Chooses the
 * engine by run mode (source checkout vs packaged binary), and injects the marker write, exit, and clock.
 * Kept out of server.ts so that core file stays small.
 */
import type { SettingsStoreLike } from "../../studio/contracts";
import { createSwitchManager, type SwitchAction, type SwitchManager } from "./manager";
import { sourceSwitch } from "./source-engine";
import { realGitRunner } from "./git-runner";
import { packagedSwitch } from "./packaged-engine";

export type SwitchPrepare = (tag: string, onProgress: (message: string) => void) => Promise<SwitchAction>;

/** The mode-appropriate preparer: source = git checkout + reinstall; packaged = download + verify + swap. */
export function makeSwitchPrepare(packaged: boolean, cwd: string): SwitchPrepare {
  if (!packaged) {
    const git = realGitRunner(cwd);
    return (tag, onProgress) => sourceSwitch(tag, { git, onProgress });
  }
  return (tag, onProgress) => packagedSwitch(tag, { onProgress });
}

/** Construct the switch manager for this launch. */
export function makeSwitchManager(
  packaged: boolean,
  cwd: string,
  installed: string,
  settings: SettingsStoreLike,
): SwitchManager {
  return createSwitchManager({
    installed,
    prepare: makeSwitchPrepare(packaged, cwd),
    writeMarker: async (marker) => {
      await settings.update({ pendingSwitch: marker });
    },
    exit: (code) => process.exit(code),
    now: () => Date.now(),
  });
}
