/** Off revokes both a running LAN listener and a listener still being started. */
import { expect, test } from "bun:test";
import { createLanManager } from "./lan-manager";
import type { LanServerHandle } from "./lan-server";

test("disable wins over pending startup and concurrent enables share one listener", async () => {
  const ready = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<LanServerHandle>();
  let starts = 0;
  let stops = 0;
  const manager = createLanManager({ now: () => 1, port: 0, certDir: "unused", makeAppHandler: () => async () => new Response("test"), start: () => { starts++; ready.resolve(); return pending.promise; } });
  const first = manager.enable();
  const second = manager.enable();
  await ready.promise;
  await manager.disable();
  pending.resolve({ origin: "https://test", fingerprint: "test", stop: () => { stops++; } });
  await Promise.all([first, second]);
  expect(manager.status().on).toBe(false);
  expect(starts).toBe(1);
  expect(stops).toBe(1);
});

test("a fresh On waits for revoked startup cleanup and coalesces without losing intent", async () => {
  const ready = Promise.withResolvers<void>(), pending = Promise.withResolvers<LanServerHandle>();
  let starts = 0, stops = 0;
  const handle = (): LanServerHandle => ({ origin: "https://fixture", fingerprint: "fixture", stop() { stops++; } });
  const manager = createLanManager({ now: () => 1, port: 0, certDir: "unused", makeAppHandler: () => async () => new Response("fixture"),
    start: () => { starts++; if (starts === 1) { ready.resolve(); return pending.promise; } return Promise.resolve(handle()); } });
  const first = manager.enable();
  await ready.promise;
  await manager.disable();
  const fresh = manager.enable(), duplicate = manager.enable();
  pending.resolve(handle());
  const [oldState, newState, duplicateState] = await Promise.all([first, fresh, duplicate]);
  try {
    expect(oldState.on).toBe(false);
    expect(newState.on).toBe(true);
    expect(duplicateState.on).toBe(true);
    expect(manager.status().on).toBe(true);
    expect(starts).toBe(2);
    expect(stops).toBe(1);
  } finally { await manager.disable(); }
});

test("Off again cancels an On queued behind revoked startup", async () => {
  const ready = Promise.withResolvers<void>(), pending = Promise.withResolvers<LanServerHandle>();
  let starts = 0, stops = 0;
  const manager = createLanManager({ now: () => 1, port: 0, certDir: "unused", makeAppHandler: () => async () => new Response("fixture"),
    start: () => { starts++; ready.resolve(); return pending.promise; } });
  const first = manager.enable();
  await ready.promise;
  await manager.disable();
  const queued = manager.enable();
  await manager.disable();
  pending.resolve({ origin: "https://fixture", fingerprint: "fixture", stop() { stops++; } });
  const states = await Promise.all([first, queued]);
  expect(states.every((state) => !state.on)).toBe(true);
  expect(manager.status().on).toBe(false);
  expect(starts).toBe(1);
  expect(stops).toBe(1);
});
