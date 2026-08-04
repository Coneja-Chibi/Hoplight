/**
 * Contract for the sidecar manager's UNAVAILABLE path: what happens when this build carries no Tailscale
 * helper binary.
 *
 * The defect these cover. `resolveSidecarBin` had a single candidate derived from `import.meta.url`,
 * which is correct from source and meaningless once compiled - inside a standalone Bun executable it
 * resolves onto the virtual filesystem (`B:\sidecar\sidecar.exe`), a path that cannot exist. So every
 * packaged studio offered a live "Enable remote access" button, spawned a path that was never there, and
 * showed the user the raw OS error: `ENOENT ... uv_spawn 'C:\...\sidecar\sidecar.exe'`.
 *
 * These tests never spawn anything. That is the point: the whole fix is that an absent binary is
 * discovered and reported WITHOUT a spawn attempt, so a resolver returning null must be enough to drive
 * every assertion here.
 */
import { describe, expect, test } from "bun:test";
import { createSidecarManager, NO_SIDECAR_DETAIL } from "./sidecar-manager";
import type { RemoteState } from "./sidecar-status";

const missing = () => null;

function makeManager(resolveBin: () => string | null): {
  manager: ReturnType<typeof createSidecarManager>;
  states: RemoteState[];
  opened: string[];
} {
  const states: RemoteState[] = [];
  const opened: string[] = [];
  const manager = createSidecarManager({
    resolveBin,
    untrustedUpstream: "127.0.0.1:8788",
    sharedSecret: "not-a-real-secret",
    openUrl: (url) => opened.push(url),
    onState: (s) => states.push(s),
  });
  return { manager, states, opened };
}

describe("no sidecar binary present", () => {
  test("reports unavailable BEFORE anything is clicked", () => {
    // The real fix: the panel must not offer a control this build cannot honour. Discovering the
    // absence only after a click is how a raw uv_spawn error reached a user's screen.
    const { manager } = makeManager(missing);
    expect(manager.getState()).toEqual({ phase: "unavailable", detail: NO_SIDECAR_DETAIL });
  });

  test("enable() stays unavailable and never claims to be starting", () => {
    const { manager, states } = makeManager(missing);
    manager.enable();
    expect(manager.getState().phase).toBe("unavailable");
    // "starting" would be a lie the UI renders as a spinner that resolves to nothing.
    expect(states.map((s) => s.phase)).not.toContain("starting");
  });

  test("the message a user sees is prose, with no path and no spawn error", () => {
    const { manager } = makeManager(missing);
    const detail = manager.getState().detail ?? "";
    expect(detail).not.toContain("ENOENT");
    expect(detail).not.toContain("uv_spawn");
    expect(detail).not.toMatch(/[A-Za-z]:\\/); // no Windows path
    expect(detail).not.toContain("/"); // no POSIX path either
    // And it names the thing that DOES work, which is on the same settings page.
    expect(detail).toContain("LAN mode");
  });

  test("the detail rides its own field, not `error`", () => {
    // /api/remote/status serves this object to remote devices. One field carrying two meanings is how
    // "not built with this feature" gets rendered as "your remote access broke".
    const { manager } = makeManager(missing);
    expect(manager.getState().error).toBeUndefined();
    expect(manager.getState().detail).toBeTruthy();
  });

  test("turning it off does not collapse unavailable into off", async () => {
    // "off" re-offers an Enable button. Unavailable describes the BUILD, not a switch position.
    const { manager } = makeManager(missing);
    await manager.disable();
    expect(manager.getState().phase).toBe("unavailable");
  });

  test("no sign-in page is ever opened", () => {
    const { manager, opened } = makeManager(missing);
    manager.enable();
    manager.openSignIn();
    expect(opened).toEqual([]);
  });

  test("kick is inert rather than throwing", () => {
    const { manager } = makeManager(missing);
    expect(() => manager.kick("node-1")).not.toThrow();
    expect(manager.getDevices()).toEqual([]);
  });
});

describe("the resolver is re-run, not cached", () => {
  test("enable() asks again instead of trusting the answer from construction", () => {
    // Why it matters: a developer who runs `bun sidecar/build.ts` while the studio is open should get a
    // working button, not an "unavailable" that only a restart clears.
    //
    // Asserted by COUNTING calls with the binary still absent, rather than by letting a resolver return
    // a fake path. A non-null path takes enable() into the real imperative edge, which sweeps orphans
    // with `taskkill /F /IM sidecar.exe` - a test must not reach for a signal that would kill a sidecar
    // the developer is actually running.
    let calls = 0;
    const { manager } = makeManager(() => {
      calls++;
      return null;
    });
    expect(calls).toBe(1); // construction, for the initial state
    manager.enable();
    expect(calls).toBe(2); // and again at the moment of use
  });
});
