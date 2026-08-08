/**
 * handleDropInRoutes, the packaged branch: pure data, no filesystem, so it is the cheap way to
 * pin the move out of server.ts's own route table (pure code motion at the file's size cap) did
 * not change behavior. The unpackaged (source/dev) branch reads the real src/ui/apps/ tree through
 * discoverApps et al., same as it always did; nothing here mocks that.
 */
import { describe, expect, test } from "bun:test";
import type { PackagedAssets } from "./assets";
import { handleDropInRoutes } from "./server-dropins";

const packaged = (over: Partial<PackagedAssets> = {}): PackagedAssets => ({
  indexHtml: "",
  tokensCss: "",
  bootJs: "",
  faviconIcoB64: "",
  iconPngB64: "",
  apps: { library: "export const app = 1;" },
  manifests: [{ id: "library" }],
  docs: {} as PackagedAssets["docs"],
  setupSteps: { welcome: "export const step = 1;" },
  tours: { library: "export const tour = 1;" },
  vendor: {},
  ...over,
});

describe("handleDropInRoutes: packaged", () => {
  test("/api/apps returns the pre-collected manifest list verbatim", async () => {
    const res = await handleDropInRoutes("/api/apps", packaged());
    expect(res).not.toBeNull();
    expect(await res!.json()).toEqual([{ id: "library" }]);
  });

  test("/apps/<id>.js serves the bundle as no-store JavaScript; a missing id 404s", async () => {
    const hit = await handleDropInRoutes("/apps/library.js", packaged());
    expect(hit!.headers.get("content-type")).toBe("text/javascript");
    expect(hit!.headers.get("cache-control")).toBe("no-store");
    expect(await hit!.text()).toBe("export const app = 1;");

    const miss = await handleDropInRoutes("/apps/nope.js", packaged());
    expect(miss!.status).toBe(404);
  });

  test("/api/setup/steps returns sorted step ids, not insertion order", async () => {
    const res = await handleDropInRoutes(
      "/api/setup/steps",
      packaged({ setupSteps: { zeta: "z", alpha: "a" } }),
    );
    expect(await res!.json()).toEqual(["alpha", "zeta"]);
  });

  test("/setup/steps/<id>.js serves the bundle; a missing id 404s", async () => {
    const hit = await handleDropInRoutes("/setup/steps/welcome.js", packaged());
    expect(await hit!.text()).toBe("export const step = 1;");
    const miss = await handleDropInRoutes("/setup/steps/nope.js", packaged());
    expect(miss!.status).toBe(404);
  });

  test("/tours/<id>.js serves the bundle; a missing id 404s", async () => {
    const hit = await handleDropInRoutes("/tours/library.js", packaged());
    expect(await hit!.text()).toBe("export const tour = 1;");
    const miss = await handleDropInRoutes("/tours/nope.js", packaged());
    expect(miss!.status).toBe(404);
  });

  test("an unrelated path falls through to null, letting the caller's own table continue", async () => {
    expect(await handleDropInRoutes("/api/inspect", packaged())).toBeNull();
  });
});
