/**
 * Drop-in module routes: apps, setup steps, and tours all share the same mechanism (DECISIONS #10
 * build law) - a folder drops in, the dock/setup/tour surface gains an entry, nothing central lists
 * them. Packaged builds serve pre-bundled code from the manifest; source runs discover and bundle
 * on request. Split out of server.ts at the file's own size cap - pure code motion, no behavior
 * change (asset serving stays server-static.ts's own concern, called before this from server.ts).
 */
import type { PackagedAssets } from "./assets";
import { err, json } from "./server-security";
import { appManifests, bundleModule, discoverApps, discoverSetupSteps, discoverTours } from "./server-static";

// no-store on every served module: the bytes are local and free, and heuristic browser caching (no
// cache-control at all) let a restarted server keep serving WEEK-OLD bundles from HTTP cache -
// "restart" then looked broken because the tab never re-fetched the fresh code.
const text = (body: string, type: string): Response =>
  new Response(body, { headers: { "content-type": type, "cache-control": "no-store" } });

/** Every drop-in module route, or null to let the caller's own table continue. */
export async function handleDropInRoutes(
  p: string,
  packaged: PackagedAssets | undefined,
): Promise<Response | null> {
  if (p === "/api/apps") {
    return json(packaged ? packaged.manifests : await appManifests(await discoverApps()));
  }
  if (p.startsWith("/apps/") && p.endsWith(".js")) {
    const id = p.slice("/apps/".length, -".js".length);
    if (packaged) {
      const code = packaged.apps[id];
      return code !== undefined ? text(code, "text/javascript") : err("no such app", 404);
    }
    const app = (await discoverApps()).find((a) => a.id === id);
    if (!app) return err("no such app", 404);
    return text(await bundleModule(app), "text/javascript");
  }

  // setup steps: same drop-in mechanism as apps (DECISIONS #10 build law)
  if (p === "/api/setup/steps") {
    return json(packaged ? Object.keys(packaged.setupSteps).sort() : (await discoverSetupSteps()).map((s) => s.id));
  }
  if (p.startsWith("/setup/steps/") && p.endsWith(".js")) {
    const id = p.slice("/setup/steps/".length, -".js".length);
    if (packaged) {
      const code = packaged.setupSteps[id];
      return code !== undefined ? text(code, "text/javascript") : err("no such step", 404);
    }
    const step = (await discoverSetupSteps()).find((s) => s.id === id);
    if (!step) return err("no such step", 404);
    return text(await bundleModule(step), "text/javascript");
  }

  // tours: one per app, same drop-in mechanism. A 404 is normal (an app with no tour), so the
  // shell treats it as "no tour" rather than an error.
  if (p.startsWith("/tours/") && p.endsWith(".js")) {
    const id = p.slice("/tours/".length, -".js".length);
    if (packaged) {
      const code = packaged.tours[id];
      return code !== undefined ? text(code, "text/javascript") : err("no such tour", 404);
    }
    const tour = (await discoverTours()).find((t) => t.id === id);
    if (!tour) return err("no such tour", 404);
    return text(await bundleModule(tour), "text/javascript");
  }

  return null;
}
