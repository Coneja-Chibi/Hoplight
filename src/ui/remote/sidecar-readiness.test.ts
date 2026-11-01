/** A newly installed local helper becomes available without enabling mesh access. */
import { expect, test } from "bun:test";
import { createSidecarManager } from "./sidecar-manager";
test("status discovers a newly installed helper without spawning", () => {
  let installed = false;
  let spawns = 0;
  const manager = createSidecarManager({ resolveBin: () => installed ? "fixture-helper" : null,
    spawn: (() => { spawns++; throw new Error("must remain off"); }) as typeof Bun.spawn,
    untrustedUpstream: "127.0.0.1:12345", sharedSecret: "fixture", openUrl() {} });
  expect(manager.getState().phase).toBe("unavailable");
  installed = true;
  expect(manager.getState().phase).toBe("off");
  expect(spawns).toBe(0);
});
