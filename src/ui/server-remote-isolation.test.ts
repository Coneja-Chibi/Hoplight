/** Concurrent studios own separate authenticated mesh upstream listeners. */
import { expect, test, spyOn } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsStore } from "../studio/settings";
import { setupRemoteAccess, type RemoteAccessHandle } from "./server-remote";
import { createSidecarManager, type SidecarManagerOptions } from "./remote/sidecar-manager";
import { createHandler } from "./server";
import { StudioStore } from "../studio/store";
import { filledSec } from "./server-test-rig";
test("simultaneous instances use unique ports, exact secrets and owned shutdown", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hoplight-remote-isolation-"));
  const handles: RemoteAccessHandle[] = [], captured: SidecarManagerOptions[] = [];
  const handlers: ReturnType<typeof createHandler>[] = [];
  try {
    for (let instance = 0; instance < 2; instance++) {
      handles.push(setupRemoteAccess({ settings: new SettingsStore(join(dir, String(instance))), studioDir: dir,
        createSidecar(opts) { captured.push(opts); return createSidecarManager({ ...opts, resolveBin: () => null }); },
        makeHandler(opts) {
          const handler = createHandler(new StudioStore(join(dir, String(instance))), new SettingsStore(join(dir, String(instance))), undefined, filledSec(), undefined, undefined, opts.remote, opts.remoteSecret);
          handlers.push(handler);
          return handler;
        },
      }));
    }
    expect(captured).toHaveLength(2);
    expect(captured.every((opts) => opts.untrustedUpstream?.startsWith("127.0.0.1:"))).toBe(true);
    expect(captured[0]!.untrustedUpstream).not.toBe(captured[1]!.untrustedUpstream);
    const request = (index: number, secret: string) => fetch("http://" + captured[index]!.untrustedUpstream + "/api/version", { headers: { "x-hoplight-sidecar-secret": secret } });
    for (let index = 0; index < 2; index++) {
      const own = await request(index, captured[index]!.sharedSecret);
      expect((await own.json()).product).toBe("hoplight");
      expect((await request(index, captured[1-index]!.sharedSecret)).status).toBe(403);
      expect((await request(index, "")).status).toBe(403);
    }
    handles[0]!.stop();
    expect(await request(0, captured[0]!.sharedSecret).then(() => false, () => true)).toBe(true);
    expect((await request(1, captured[1]!.sharedSecret)).status).toBe(200);
  } finally { for (const handle of handles) handle.stop(); for (const handler of handlers) await (handler as { close?: () => Promise<void> }).close?.(); await rm(dir, { recursive: true, force: true }); }
});

test("stopping before saved settings become readable cannot resume a helper", async () => {
  const dir = await mkdtemp(join(tmpdir(), "remote-resume-"));
  const settings = new SettingsStore(dir);
  const initial = await settings.read(), ready = Promise.withResolvers<void>();
  settings.read = async () => { await ready.promise; return { ...initial, remoteAccessEnabled: true }; };
  let enabled = 0;
  const handle = setupRemoteAccess({ settings, studioDir: dir,
    createSidecar(opts) { const manager = createSidecarManager({ ...opts, resolveBin: () => null }); return { ...manager, enable() { enabled++; } }; },
    makeHandler() { return async () => new Response("fixture"); },
  });
  try { handle.stop(); ready.resolve(); await Bun.sleep(0); expect(enabled).toBe(0); }
  finally { handle.stop(); await rm(dir, { recursive: true, force: true }); }
});

test("an optional listener failure keeps mesh unavailable without a dummy upstream", async () => {
  const dir = await mkdtemp(join(tmpdir(), "remote-bind-"));
  const serve = spyOn(Bun, "serve").mockImplementation(() => { throw new Error("fixture bind refusal"); });
  let captured: SidecarManagerOptions | undefined, handle: RemoteAccessHandle | undefined;
  try {
    handle = setupRemoteAccess({ settings: new SettingsStore(dir), studioDir: dir,
      createSidecar(opts) { captured = opts; return createSidecarManager({ ...opts, resolveBin: () => "fixture-helper" }); },
      makeHandler() { return async () => new Response("fixture"); },
    });
    expect(captured?.untrustedUpstream).toBeNull();
    expect(handle.remote.getState().phase).toBe("unavailable");
    expect(handle.remote.getState().detail).toContain("listener");
    handle.remote.enable();
    expect(handle.remote.getState().phase).toBe("unavailable");
    expect(handle.lan.status().on).toBe(false);
  } finally { serve.mockRestore(); handle?.stop(); await rm(dir, { recursive: true, force: true }); }
});

test("composition failure closes the already bound owned listener", async () => {
  const dir = await mkdtemp(join(tmpdir(), "remote-compose-"));
  let upstream: string | null = null;
  try {
    expect(() => setupRemoteAccess({ settings: new SettingsStore(dir), studioDir: dir,
      createSidecar(opts) { upstream = opts.untrustedUpstream; return createSidecarManager({ ...opts, resolveBin: () => null }); },
      makeHandler() { throw new Error("fixture composition refusal"); },
    })).toThrow("fixture composition refusal");
    expect(upstream).not.toBeNull();
    expect(await fetch("http://" + upstream).then(() => false, () => true)).toBe(true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
