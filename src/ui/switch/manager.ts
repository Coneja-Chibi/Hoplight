/**
 * The switch manager: the imperative shell that runs ONE version switch at a time. A single-flight lock
 * (a slow download must never let a second press start a racing switch), a status the client polls, and
 * the strict order that makes a switch recoverable: prepare -> write the restart-outcome marker -> relaunch
 * -> exit. The marker lands BEFORE the relaunch so the next boot can confirm the outcome even if we die
 * mid-restart. `prepare` is source-engine or packaged-engine (chosen at construction); all effects injected.
 */
import type { PendingSwitch } from "../_shared/pending-switch";

/**
 * What an engine hands back once it has prepared a switch. "restart" is the source path (relaunch this
 * process into the new version); "manual" is the packaged path (the build was downloaded, verified and its
 * folder opened, so there is nothing to auto-restart, the user runs the new build). The two must NOT share
 * the relaunch+exit flow, or a packaged user gets an app that exits and a UI hung waiting for a restart.
 */
export type SwitchAction = { kind: "restart"; run: () => void } | { kind: "manual"; message: string };

export interface SwitchStatus {
  phase: "idle" | "working" | "restarting" | "manual" | "failed";
  message: string;
  target: string | null;
}

export interface SwitchManagerDeps {
  /** the running version, stamped into the marker as `from`. */
  installed: string;
  /** prepare the switch (source or packaged); resolves with how to finish it. */
  prepare: (tag: string, onProgress: (message: string) => void) => Promise<SwitchAction>;
  /** persist the restart-outcome marker (settings.update) before relaunching. */
  writeMarker: (marker: PendingSwitch) => Promise<void>;
  exit: (code: number) => void;
  now: () => number;
}

export interface SwitchManager {
  /** Begin a switch to `target`. Returns false when one is already running (single-flight). */
  start(target: string): boolean;
  status(): SwitchStatus;
}

const IDLE: SwitchStatus = { phase: "idle", message: "", target: null };

export function createSwitchManager(deps: SwitchManagerDeps): SwitchManager {
  let running = false;
  let status: SwitchStatus = IDLE;

  const start = (target: string): boolean => {
    if (running) return false; // single-flight
    running = true;
    status = { phase: "working", message: "Preparing...", target };

    void (async () => {
      try {
        const action = await deps.prepare(target, (message) => {
          status = { phase: "working", message, target };
        });
        if (action.kind === "manual") {
          // packaged: nothing to auto-restart. No marker (no restart to confirm); a terminal status.
          status = { phase: "manual", message: action.message, target };
          running = false;
          return;
        }
        // source: marker BEFORE relaunch, so the next boot can confirm the outcome even mid-restart
        await deps.writeMarker({ from: deps.installed, to: target, at: deps.now() });
        status = { phase: "restarting", message: "Restarting Hoplight...", target };
        action.run();
        deps.exit(0);
        // a real exit ends here; nothing below runs in production
      } catch (e) {
        status = { phase: "failed", message: e instanceof Error ? e.message : "the switch failed", target };
        running = false; // a failed switch never exited, so allow a retry (a success exits above)
      }
    })();

    return true;
  };

  return { start, status: () => status };
}
