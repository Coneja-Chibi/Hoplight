/**
 * Lifecycle routes: quit and restart, the two buttons the About page offers. Both are POST +
 * token-gated (destructive). Quit stops the server and exits. Restart stops the server FIRST so
 * the port is free, respawns this same command detached, then exits - the relaunched instance
 * binds the freed port and the page reconnects to it.
 */
import { spawn } from "node:child_process";

export interface LifecycleDeps {
  /** stop the Bun server (releases the port); filled by startUi */
  stop: () => void;
  /** process exit, injectable for tests */
  exit: (code: number) => void;
  /** respawn this same command detached, injectable for tests */
  spawnSelf: () => void;
}

export const realSpawnSelf = (): void => {
  const child = spawn(process.execPath, process.argv.slice(1), {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  });
  child.unref();
};

/** Answer first so the page gets its ok, then tear down on the next tick. */
export function handleShutdown(deps: LifecycleDeps): Response {
  setTimeout(() => {
    deps.stop();
    deps.exit(0);
  }, 80);
  return Response.json({ ok: true });
}

export function handleRestart(deps: LifecycleDeps): Response {
  setTimeout(() => {
    deps.stop(); // port freed BEFORE the child boots, so the rebind never races
    deps.spawnSelf();
    deps.exit(0);
  }, 80);
  return Response.json({ ok: true, restarting: true });
}
