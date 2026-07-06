/**
 * The visual app's local server - a THIN SHELL over the same engine the CLI uses. No format logic
 * lives here: HTTP plumbing, app discovery (folders-as-schema, mirroring the format loader), and
 * the studio store. Loopback only; stateless except the studio folder the user owns.
 *
 * Security posture: uploads parse through the same fail-closed adapters as the CLI (zip-bomb caps
 * included); scripts in entities are data; nothing is ever evaluated server-side; app bundles are
 * built from the local src tree only.
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { watch as watchFs } from "node:fs";
import { registry } from "../core";
import type { AdapterInput, FormatAdapter } from "../core";
import type { CanonicalEntity } from "../core/canonical";
import { StudioStore } from "../studio/store";
import { SettingsStore } from "../studio/settings";
import { portraitBytes } from "../studio/portrait";
import { buildReceipt, friendlyFormat, UNKNOWN_FILE_MESSAGE } from "./receipt";
import type { PackagedAssets } from "./assets";

type AnyEntity = CanonicalEntity<string, unknown>;

const json = (v: unknown, status = 200): Response =>
  new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const err = (message: string, status = 400): Response => json({ error: message }, status);

// -- drop-in module discovery (apps AND setup steps share one mechanism) ----------------------------

interface DiscoveredModule {
  id: string;
  entrypoint: string;
}

/** Folders-as-schema scan: <baseDir>/<id>/index.{ts,tsx}, _-prefixed skipped (templates/shared).
 * .tsx is the dev-mode twin of scripts/build-desktop.ts's widened glob (ADR-008 conversion): apps
 * and setup steps convert to React one folder at a time, and the dev server must keep finding both
 * shapes mid-conversion, or every converted folder 404s until the whole run lands. */
async function discoverModules(baseRel: string): Promise<DiscoveredModule[]> {
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

const discoverApps = (): Promise<DiscoveredModule[]> => discoverModules("./apps/");
const discoverSetupSteps = (): Promise<DiscoveredModule[]> => discoverModules("./setup/steps/");

/** The react family stays OUT of every app/boot bundle; the page's import map resolves these to
 * the single /vendor copies (one React per page - two copies crash hooks with a null dispatcher). */
const REACT_EXTERNALS = ["react", "react/jsx-runtime", "react-dom/client", "react-dom"];

/** name -> entry stub + externals; mirrored in scripts/build-desktop.ts for the packaged bake. */
const VENDOR_SPECS: Record<string, { entry: string; external: string[] }> = {
  react: { entry: "./vendor/react.ts", external: [] },
  "jsx-runtime": { entry: "./vendor/jsx-runtime.ts", external: ["react"] },
  "jsx-dev-runtime": { entry: "./vendor/jsx-dev-runtime.ts", external: ["react"] },
  "react-dom-client": { entry: "./vendor/react-dom-client.ts", external: ["react", "react/jsx-runtime"] },
};

/** Bundle one module for the browser, fresh every request (dev serves live edits; ~20ms a build).
 * The packaged exe never calls this - its bundles are baked. */
async function bundleModule(mod: DiscoveredModule): Promise<string> {
  const built = await Bun.build({
    entrypoints: [mod.entrypoint],
    target: "browser",
    format: "esm",
    external: REACT_EXTERNALS,
  });
  if (!built.success || built.outputs.length === 0) {
    throw new Error(`ui: module "${mod.id}" failed to bundle: ${built.logs.map((l) => l.message).join("; ")}`);
  }
  return built.outputs[0]!.text();
}

/** Dev-serve a shared vendor bundle (packaged mode reads the baked copy instead). */
async function bundleVendor(name: string): Promise<string | null> {
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

/** Watch src/ui and nudge every connected page to reload (debounced; editors fire in bursts). */
function startDevWatch(): void {
  if (watching) return;
  watching = true;
  const uiDir = fileURLToPath(new URL("./", import.meta.url));
  let timer: ReturnType<typeof setTimeout> | null = null;
  watchFs(uiDir, { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      for (const client of devClients) {
        try {
          client.enqueue(SSE.encode("data: reload\n\n"));
        } catch {
          devClients.delete(client);
        }
      }
    }, 120);
  });
}

/** Manifests come from the modules themselves (server imports them once; they are DOM-free at top level). */
async function appManifests(apps: DiscoveredModule[]): Promise<unknown[]> {
  const manifests: unknown[] = [];
  for (const app of apps) {
    const mod = (await import(app.entrypoint)) as { default?: { manifest?: unknown } };
    if (mod.default?.manifest) manifests.push(mod.default.manifest);
  }
  return manifests;
}

// -- engine plumbing --------------------------------------------------------------------------------

function toAdapterInput(bytes: Uint8Array, filename: string): AdapterInput {
  const input: AdapterInput = { bytes, filename };
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "json" || ext === "txt" || ext === "lorebook") {
    try {
      input.text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      /* binary */
    }
  }
  return input;
}

const formatMeta = (a: FormatAdapter): Record<string, unknown> => ({
  id: a.id,
  label: a.label,
  kind: a.kind,
  outputExtensions: a.outputExtensions,
  friendly: friendlyFormat(a.id),
  native: a.native ?? false,
  generic: a.generic ?? false,
});

async function handleInspect(req: Request): Promise<Response> {
  const filename = req.headers.get("x-filename") ?? "upload";
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0) return err("empty upload");
  const input = toAdapterInput(bytes, filename);
  const adapter = registry.detect(input);
  if (!adapter) return json({ ok: false, error: UNKNOWN_FILE_MESSAGE }, 200);
  try {
    const entity = adapter.toCanonical(input) as AnyEntity;
    return json({
      ok: true,
      receipt: buildReceipt(entity, adapter.id),
      entity,
      formatId: adapter.id,
      kind: entity.kind,
    });
  } catch {
    return json(
      { ok: false, error: `This looks like a ${friendlyFormat(adapter.id)} file, but it is damaged and we could not read it safely.` },
      200,
    );
  }
}

async function handleExport(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { entity?: AnyEntity; targetId?: string } | null;
  if (!body?.entity || typeof body.targetId !== "string") return err("expected { entity, targetId }");
  const target = registry.get(body.targetId);
  if (!target) return err(`unknown format "${body.targetId}"`);
  if (body.entity.kind !== target.kind) {
    return err(`cannot write a ${body.entity.kind} as ${target.id} (a ${target.kind} format)`);
  }
  try {
    const out = (target.fromCanonical as (e: AnyEntity) => { bytes?: Uint8Array; text?: string; suggestedExtension: string })(
      body.entity,
    );
    return json({
      suggestedExtension: out.suggestedExtension,
      text: out.text,
      bytesB64: out.bytes ? Buffer.from(out.bytes).toString("base64") : undefined,
    });
  } catch (e) {
    return err(`${target.id}: ${e instanceof Error ? e.message : String(e)}`, 422);
  }
}

// -- the route table --------------------------------------------------------------------------------

const staticFile = (rel: string, type: string): Response =>
  new Response(Bun.file(fileURLToPath(new URL(rel, import.meta.url))), { headers: { "content-type": type } });

export function createHandler(
  store: StudioStore,
  settings: SettingsStore,
  packaged?: PackagedAssets,
): (req: Request) => Promise<Response> {
  const text = (body: string, type: string): Response =>
    new Response(body, { headers: { "content-type": type } });

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/" || p === "/index.html") {
      return packaged ? text(packaged.indexHtml, "text/html; charset=utf-8") : staticFile("./index.html", "text/html; charset=utf-8");
    }
    if (p === "/tokens.css") {
      return packaged ? text(packaged.tokensCss, "text/css; charset=utf-8") : staticFile("./theme/tokens.css", "text/css; charset=utf-8");
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
      return text(
        JSON.stringify({
          name: "Vaude.",
          short_name: "Vaude.",
          icons: [{ src: "/icon-256.png", sizes: "256x256", type: "image/png" }],
          display: "standalone",
          background_color: "#faf8f3",
          theme_color: "#e11d48",
        }),
        "application/manifest+json",
      );
    }
    if (p === "/boot.js") {
      if (packaged) return text(packaged.bootJs, "text/javascript");
      const built = await Bun.build({
        entrypoints: [fileURLToPath(new URL("./boot.ts", import.meta.url))],
        target: "browser",
        format: "esm",
        external: REACT_EXTERNALS,
      });
      if (!built.success) return err("boot bundle failed", 500);
      return new Response(await built.outputs[0]!.text(), { headers: { "content-type": "text/javascript" } });
    }
    if (p.startsWith("/vendor/") && p.endsWith(".js")) {
      const name = p.slice("/vendor/".length, -".js".length);
      if (packaged) {
        const code = packaged.vendor[name];
        return code !== undefined ? text(code, "text/javascript") : err("no such vendor bundle", 404);
      }
      const code = await bundleVendor(name);
      return code !== null ? text(code, "text/javascript") : err("no such vendor bundle", 404);
    }

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
      return new Response(await bundleModule(app), { headers: { "content-type": "text/javascript" } });
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
      return new Response(await bundleModule(step), { headers: { "content-type": "text/javascript" } });
    }

    // dev live-reload stream (404 in the packaged exe; the client goes quiet on error)
    if (p === "/dev/reload") {
      if (packaged) return err("not found", 404);
      let ctrl: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          ctrl = c;
          devClients.add(c);
          c.enqueue(SSE.encode("data: hello\n\n"));
        },
        cancel() {
          devClients.delete(ctrl);
        },
      });
      return new Response(stream, {
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
      });
    }

    if (p === "/api/settings") {
      if (req.method === "POST") {
        return json(await settings.save(await req.json().catch(() => null))); // parse is fail-closed
      }
      return json(await settings.read());
    }

    if (p === "/api/formats") return json(registry.all().map(formatMeta));
    if (p === "/api/inspect" && req.method === "POST") return handleInspect(req);
    if (p === "/api/export" && req.method === "POST") return handleExport(req);

    if (p === "/api/studio/list") return json(await store.list(url.searchParams.get("kind") ?? undefined));
    if (p === "/api/studio/portrait") {
      const entity = await store.read(url.searchParams.get("kind") ?? "", url.searchParams.get("id") ?? "");
      const art = entity ? portraitBytes(entity) : null;
      return art
        ? // cast: TS's BodyInit lib type predates Uint8Array<ArrayBufferLike>; Bun accepts it fine.
          // Headers harden the untrusted-bytes serve: no sniffing, no execution, inline image only.
          new Response(art.bytes as unknown as BodyInit, {
            headers: {
              "content-type": art.mime,
              "cache-control": "no-cache",
              "content-disposition": "inline; filename=portrait",
              "x-content-type-options": "nosniff",
              "content-security-policy": "default-src 'none'; sandbox",
            },
          })
        : err("no portrait", 404);
    }
    if (p === "/api/studio/get") {
      const kind = url.searchParams.get("kind") ?? "";
      const id = url.searchParams.get("id") ?? "";
      const entity = await store.read(kind, id);
      return entity ? json(entity) : err("not found", 404);
    }
    if (p === "/api/studio/save" && req.method === "POST") {
      const entity = (await req.json().catch(() => null)) as AnyEntity | null;
      if (!entity) return err("expected a canonical entity");
      return json(await store.save(entity));
    }

    return err("not found", 404);
  };
}

/** Boot the visual app. Loopback only: a local forge, never an exposed service. */
export function startUi(port: number, studioDir: string, packaged?: PackagedAssets): { url: string; stop: () => void } {
  const store = new StudioStore(studioDir);
  const settings = new SettingsStore(studioDir);
  if (!packaged) startDevWatch(); // dev: edits to src/ui reload every open page
  const server = Bun.serve({ port, hostname: "127.0.0.1", fetch: createHandler(store, settings, packaged) });
  return { url: `http://127.0.0.1:${server.port}`, stop: () => server.stop() };
}
