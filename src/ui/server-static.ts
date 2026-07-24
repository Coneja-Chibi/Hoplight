/**
 * UI server static/dev plumbing: drop-in module discovery, CSS-module bundling, vendor bundles,
 * and live-reload watch. Extracted from server.ts (behavior-preserving).
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { watch as watchFs } from "node:fs";
import type { PackagedAssets } from "./assets";
import { err } from "./server-security";

export interface DiscoveredModule {
  id: string;
  entrypoint: string;
}

/** Folders-as-schema scan: <baseDir>/<id>/index.{ts,tsx}, _-prefixed skipped (templates/shared).
 * .tsx is the dev-mode twin of scripts/build-desktop.ts's widened glob (ADR-008 conversion): apps
 * and setup steps convert to React one folder at a time, and the dev server must keep finding both
 * shapes mid-conversion, or every converted folder 404s until the whole run lands. */
export async function discoverModules(baseRel: string): Promise<DiscoveredModule[]> {
  const baseDir = fileURLToPath(new URL(baseRel, import.meta.url));
  const glob = new Bun.Glob("*/index.{ts,tsx}");
  const found: DiscoveredModule[] = [];
  for await (const rel of glob.scan({ cwd: baseDir })) {
    const id = rel.split(/[\\/]/)[0]!;
    if (id.startsWith("_")) continue;
    found.push({ id, entrypoint: join(baseDir, rel) });
  }
  return found.sort((a, b) => a.id.localeCompare(b.id));
}

export const discoverApps = (): Promise<DiscoveredModule[]> => discoverModules("./apps/");
export const discoverSetupSteps = (): Promise<DiscoveredModule[]> => discoverModules("./setup/steps/");
// tours ride the SAME drop-in mechanism: src/ui/tours/<appId>/index.tsx (the shared _-prefixed infra
// files - tour-contract, tour-core - are not <id>/index folders, so the glob never sees them)
export const discoverTours = (): Promise<DiscoveredModule[]> => discoverModules("./tours/");

/** The react family stays OUT of every app/boot bundle; the page's import map resolves these to
 * the single /vendor copies (one React per page - two copies crash hooks with a null dispatcher). */
export const REACT_EXTERNALS = ["react", "react/jsx-runtime", "react-dom/client", "react-dom"];

/** name -> entry stub + externals; mirrored in scripts/build-desktop.ts for the packaged bake. */
const VENDOR_SPECS: Record<string, { entry: string; external: string[] }> = {
  "react-family": { entry: "./vendor/react-family.ts", external: [] },
  "react-dom-client": { entry: "./vendor/react-dom-client.ts", external: ["react"] },
};

/** Bundle one module for the browser, fresh every request (dev serves live edits; ~20ms a build).
 * The packaged exe never calls this - its bundles are baked. */
/** CSS Modules emit SEPARATE css artifacts; the stylesheet rides inside the module's JS as a
 * head-injected <style> (mirrors scripts/build-desktop.ts - the unstyled-interiors bug). */
export async function withCssInjected(outputs: Bun.BuildArtifact[]): Promise<string> {
  let js = "";
  let css = "";
  for (const out of outputs) {
    if (out.path.endsWith(".css")) css += await out.text();
    else js += await out.text();
  }
  if (!css) return js;
  const inject =
    `{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";` +
    `s.textContent=${JSON.stringify(css)};document.head.append(s);}\n`;
  return inject + js; // statements before import declarations are legal ESM (imports hoist)
}

export async function bundleModule(mod: DiscoveredModule): Promise<string> {
  const built = await Bun.build({
    entrypoints: [mod.entrypoint],
    target: "browser",
    format: "esm",
    external: REACT_EXTERNALS,
  });
  if (!built.success || built.outputs.length === 0) {
    throw new Error(`ui: module "${mod.id}" failed to bundle: ${built.logs.map((l) => l.message).join("; ")}`);
  }
  return withCssInjected(built.outputs);
}

/** Dev-serve a shared vendor bundle (packaged mode reads the baked copy instead). */
export async function bundleVendor(name: string): Promise<string | null> {
  const spec = VENDOR_SPECS[name];
  if (!spec) return null; // deny by absence: only the three known vendor names exist
  const built = await Bun.build({
    entrypoints: [fileURLToPath(new URL(spec.entry, import.meta.url))],
    target: "browser",
    format: "esm",
    external: spec.external,
  });
  if (!built.success || built.outputs.length === 0) return null;
  return built.outputs[0]!.text();
}

// -- dev live-reload (dev server only; the packaged exe has no source tree to watch) ----------------

const devClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
let watching = false;
const SSE = new TextEncoder();

/** One id per server process. The hello frame carries it so a page that reconnects after a server
 * restart can tell the bundle may have changed underneath it and reload itself. */
const DEV_BOOT_ID = crypto.randomUUID();

/** Watch src/ui and nudge every connected page to reload (debounced; editors fire in bursts). */
export function startDevWatch(): void {
  if (watching) return;
  watching = true;
  const uiDir = fileURLToPath(new URL("./", import.meta.url));
  let timer: ReturnType<typeof setTimeout> | null = null;
  watchFs(uiDir, { recursive: true }, (_type, filename) => {
    // Only real source files reload the page; editor lockfiles, swap files, and Windows watcher
    // noise do not. A null filename (Windows sometimes omits it) is allowed through - losing a
    // legitimate reload is worse than an extra one.
    if (filename !== null && !/\.(ts|tsx|css|html)$/i.test(String(filename))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      for (const client of devClients) {
        try {
          client.enqueue(SSE.encode("data: reload\n\n"));
        } catch {
          devClients.delete(client);
        }
      }
      // 600ms trailing quiet: an edit BURST (agent or human saving several files) folds into ONE
      // reload instead of a flashing storm; 120ms fired between keystroke-spaced saves.
    }, 600);
  });
}

/** Manifests come from the modules themselves (server imports them once; they are DOM-free at top level). */
export async function appManifests(apps: DiscoveredModule[]): Promise<unknown[]> {
  const manifests: unknown[] = [];
  for (const app of apps) {
    const mod = (await import(app.entrypoint)) as { default?: { manifest?: unknown } };
    if (mod.default?.manifest) manifests.push(mod.default.manifest);
  }
  return manifests;
}

/** Open a live-reload SSE response (dev only). */
export function createDevReloadResponse(): Response {
  let ctrl: ReadableStreamDefaultController<Uint8Array>;
  let heartbeat: ReturnType<typeof setInterval>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
      devClients.add(c);
      c.enqueue(SSE.encode(`data: hello ${DEV_BOOT_ID}\n\n`));
      // keepalive comment under the server's idleTimeout (120s), or Bun chops the quiet stream
      // mid-flight (ERR_INCOMPLETE_CHUNKED_ENCODING) and live-reload dies until the tab reloads
      heartbeat = setInterval(() => {
        try {
          c.enqueue(SSE.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
          devClients.delete(c);
        }
      }, 30_000);
    },
    cancel() {
      clearInterval(heartbeat);
      devClients.delete(ctrl);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
}

export const staticFile = (rel: string, type: string): Response =>
  new Response(Bun.file(fileURLToPath(new URL(rel, import.meta.url))), {
    // no-store: heuristically cached local assets survived server restarts as stale UI
    headers: { "content-type": type, "cache-control": "no-store" },
  });

/** no-store response for served bytes (local + free, and heuristic caching served week-old bundles). */
const noStore = (body: string, type: string, extra?: Record<string, string>): Response =>
  new Response(body, { headers: { "content-type": type, "cache-control": "no-store", ...extra } });

/**
 * Static + bundled asset routes: everything the browser loads that is NOT the HTML shell (the shell
 * needs session-meta injection, so it stays in createHandler). Returns null for any non-asset path so
 * the caller's route table continues. Behavior-preserving move out of server.ts.
 */
export async function handleAssetRoutes(
  p: string,
  packaged?: PackagedAssets,
): Promise<Response | null> {
  if (p === "/tokens.css") {
    return packaged ? noStore(packaged.tokensCss, "text/css; charset=utf-8") : staticFile("./theme/tokens.css", "text/css; charset=utf-8");
  }
  if (p === "/favicon.ico" || p === "/icon-256.png") {
    const isIco = p === "/favicon.ico";
    const type = isIco ? "image/x-icon" : "image/png";
    if (packaged) {
      const b64 = isIco ? packaged.faviconIcoB64 : packaged.iconPngB64;
      return new Response(Buffer.from(b64, "base64"), { headers: { "content-type": type } });
    }
    const rel = isIco ? "../../build/vaude.ico" : "../../build/vaude-256.png";
    return new Response(Bun.file(fileURLToPath(new URL(rel, import.meta.url))), { headers: { "content-type": type } });
  }
  if (p === "/app.webmanifest") {
    return noStore(
      JSON.stringify({
        name: "Hoplight.",
        short_name: "Hoplight.",
        icons: [{ src: "/icon-256.png", sizes: "256x256", type: "image/png" }],
        display: "standalone",
        // hardcode-ok: the web-manifest spec takes literal colors, CSS vars cannot reach it
        background_color: "#faf8f3", // hardcode-ok (paper, tokens.css --paper)
        theme_color: "#e11d48", // hardcode-ok (house rose, tokens.css --host-rc)
      }),
      "application/manifest+json",
    );
  }
  if (p === "/boot.js") {
    if (packaged) return noStore(packaged.bootJs, "text/javascript");
    const built = await Bun.build({
      entrypoints: [fileURLToPath(new URL("./boot.ts", import.meta.url))],
      target: "browser",
      format: "esm",
      external: REACT_EXTERNALS,
    });
    if (!built.success) return err("boot bundle failed", 500);
    // the shell's own CSS Modules (Stamp, dialogs, tags) ride in the boot bundle as separate css
    // artifacts; without this they serve style-less in dev while the packaged exe (bundleBrowser)
    // injects - the unstyled-Import-stamp split. Boot goes through the SAME injector now.
    return new Response(await withCssInjected(built.outputs), { headers: { "content-type": "text/javascript", "cache-control": "no-store" } });
  }
  if (p.startsWith("/vendor/") && p.endsWith(".js")) {
    const name = p.slice("/vendor/".length, -".js".length);
    if (packaged) {
      const code = packaged.vendor[name];
      return code !== undefined ? noStore(code, "text/javascript") : err("no such vendor bundle", 404);
    }
    const code = await bundleVendor(name);
    return code !== null ? noStore(code, "text/javascript") : err("no such vendor bundle", 404);
  }

  // Sealed Lua Stage (browser): wasmoon glue.wasm + worker bundle. Never evaluate card code here.
  if (p === "/sandbox/glue.wasm") {
    const wasmPath = fileURLToPath(new URL("../../node_modules/wasmoon/dist/glue.wasm", import.meta.url));
    return new Response(Bun.file(wasmPath), {
      headers: {
        "content-type": "application/wasm",
        "cache-control": "public, max-age=86400",
      },
    });
  }
  if (p === "/sandbox/worker.js") {
    if (packaged?.sandboxWorkerJs) {
      return noStore(packaged.sandboxWorkerJs, "text/javascript; charset=utf-8");
    }
    const entry = fileURLToPath(new URL("../sandbox/lua/worker.ts", import.meta.url));
    const built = await Bun.build({
      entrypoints: [entry],
      target: "browser",
      format: "esm",
    });
    if (!built.success || built.outputs.length === 0) {
      return err(`sandbox worker bundle failed: ${built.logs.map((l) => l.message).join("; ")}`, 500);
    }
    return new Response(await built.outputs[0]!.text(), {
      headers: { "content-type": "text/javascript; charset=utf-8" },
    });
  }
  if (p === "/sandbox/regex-worker.js") {
    if (packaged?.regexWorkerJs) {
      return noStore(packaged.regexWorkerJs, "text/javascript; charset=utf-8");
    }
    const entry = fileURLToPath(new URL("../sandbox/regex/worker.ts", import.meta.url));
    const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "esm" });
    if (!built.success || built.outputs.length === 0) {
      return err(`regex worker bundle failed: ${built.logs.map((log) => log.message).join("; ")}`, 500);
    }
    return new Response(await built.outputs[0]!.text(), {
      headers: { "content-type": "text/javascript; charset=utf-8" },
    });
  }

  return null;
}
