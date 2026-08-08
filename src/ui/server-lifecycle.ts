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
  /**
   * A spawn failure (a moved binary, a locked exe) arrives as an EVENT, not a throw. Unhandled,
   * Node treats it as an uncaught exception - in a process that is about to exit anyway it is
   * noise, but the listener is what stops it becoming a crash report about the wrong thing.
   */
  child.on("error", (e: Error) => {
    console.error("server: the replacement instance could not be launched:", e.message);
  });
  child.unref();
};

/**
 * Tear down without letting one failed step strand the process.
 *
 * THE FAILURE THIS PREVENTS: `stop` is four teardowns in a trench coat - the main server, the
 * sandbox host, the remote sidecar, and the staging cleanup. Any one of them throwing used to take
 * the exit call down with it, leaving the OLD instance alive and still holding the port. On restart
 * that is invisible and worse than a crash: the replacement cannot bind, so it dies, and the old
 * server keeps answering - the page reconnects, the app looks restarted, and nothing restarted. The
 * only trace is a process that outlives every window you closed.
 *
 * So the exit is the one thing that always happens. A cleanup that fails is reported and stepped
 * over, because a port released by exiting is better than a port held by a process nobody can see.
 */
const teardown = (deps: LifecycleDeps, respawn: boolean): void => {
  try {
    try {
      deps.stop(); // port freed BEFORE the child boots, so the rebind never races
    } catch (e) {
      console.error("server: shutting down anyway, cleanup failed:", e instanceof Error ? e.message : e);
    }
    if (respawn) deps.spawnSelf();
  } catch (e) {
    console.error("server: could not start a replacement:", e instanceof Error ? e.message : e);
  } finally {
    deps.exit(0);
  }
};

/** Answer first so the page gets its ok, then tear down on the next tick. */
export function handleShutdown(deps: LifecycleDeps): Response {
  setTimeout(() => teardown(deps, false), 80);
  return Response.json({ ok: true });
}

export function handleRestart(deps: LifecycleDeps): Response {
  setTimeout(() => teardown(deps, true), 80);
  return Response.json({ ok: true, restarting: true });
}
