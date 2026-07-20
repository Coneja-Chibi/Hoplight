/**
 * The visual app's local server - a THIN SHELL over the same engine the CLI uses. No format logic
 * lives here: HTTP plumbing, app discovery (folders-as-schema, mirroring the format loader), and
 * the studio store. Loopback only; stateless except the studio folder the user owns.
 *
 * Security posture: per-launch session token + Host/Origin checks; capped request bodies; uploads
 * parse through the same fail-closed adapters as the CLI (zip-bomb caps included); scripts in
 * entities are data; nothing is ever evaluated server-side; app bundles are built from the local
 * src tree only.
 *
 * Security helpers: server-security.ts. Discover/bundle/dev-watch: server-static.ts.
 */
import { fileURLToPath } from "node:url";
import { registry } from "../core";
import { saveBundle } from "../studio/bundle";
import type { CanonicalEntity } from "../core/canonical";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import { StudioStore } from "../studio/store";
import { SettingsStore } from "../studio/settings";
import { portraitBytes } from "../studio/portrait";
import { safeExternalUrl } from "./_shared/external-url";
import { EXTENSION_PLATFORMS } from "../formats/_shared/extension-platforms";
import type { PackagedAssets } from "./assets";
import { startSandboxHost } from "./sandbox-host";
import {
  type UiSecurityContext,
  createSecurityContext,
  json,
  err,
  htmlSecurityHeaders,
  inlineScriptHashes,
  injectSessionMeta,
  injectSandboxOriginMeta,
  readBodyCapped,
  readJsonCapped,
  checkApiRequest,
  contentTypeIs,
  studioErr,
  openInBrowser,
} from "./server-security";
import {
  REACT_EXTERNALS,
  discoverApps,
  discoverSetupSteps,
  discoverTours,
  withCssInjected,
  bundleModule,
  bundleVendor,
  startDevWatch,
  appManifests,
  createDevReloadResponse,
  staticFile,
} from "./server-static";
import { formatMeta, handleInspect, handleExport } from "./server-engine";

// Re-export security surface for tests and sandbox-host.
export {
  INSPECT_BODY_MAX,
  JSON_BODY_MAX,
  type UiSecurityContext,
  createSecurityContext,
  htmlSecurityHeaders,
  inlineScriptHashes,
  injectSessionMeta,
  injectSandboxOriginMeta,
  readBodyCapped,
  checkApiRequest,
} from "./server-security";

type AnyEntity = CanonicalEntity<string, unknown>;

// -- the route table --------------------------------------------------------------------------------

export function createHandler(
  store: StudioStore,
  settings: SettingsStore,
  packaged?: PackagedAssets,
  sec?: UiSecurityContext,
  /**
   * Live sandbox origin for HTML meta injection (ADR-009). Mutable so startUi can fill it after
   * both listeners bind. String form also accepted for tests.
   */
  sandboxOrigin?: string | { current: string },
): (req: Request) => Promise<Response> {
  const security = sec ?? createSecurityContext();

  const text = (body: string, type: string, extra?: Record<string, string>): Response =>
    new Response(body, { headers: { "content-type": type, ...extra } });

  const resolveSandboxOrigin = (): string => {
    if (!sandboxOrigin) return "";
    if (typeof sandboxOrigin === "string") return sandboxOrigin;
    return sandboxOrigin.current;
  };

  const htmlResponse = (rawHtml: string): Response => {
    let html = injectSessionMeta(rawHtml, security.token);
    const sb = resolveSandboxOrigin();
    if (sb) html = injectSandboxOriginMeta(html, sb);
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        // hashes computed from the html actually served, so an import-map edit can never rot the CSP
        ...htmlSecurityHeaders(sb, inlineScriptHashes(html)),
      },
    });
  };

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/" || p === "/index.html") {
      if (packaged) return htmlResponse(packaged.indexHtml);
      const file = Bun.file(fileURLToPath(new URL("./index.html", import.meta.url)));
      return htmlResponse(await file.text());
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
          // hardcode-ok: the web-manifest spec takes literal colors, CSS vars cannot reach it
          background_color: "#faf8f3", // hardcode-ok (paper, tokens.css --paper)
          theme_color: "#e11d48", // hardcode-ok (house rose, tokens.css --host-rc)
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
      // the shell's own CSS Modules (Stamp, dialogs, tags) ride in the boot bundle as separate css
      // artifacts; without this they serve style-less in dev while the packaged exe (bundleBrowser)
      // injects - the unstyled-Import-stamp split. Boot goes through the SAME injector now.
      return new Response(await withCssInjected(built.outputs), { headers: { "content-type": "text/javascript" } });
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
        return text(packaged.sandboxWorkerJs, "text/javascript; charset=utf-8");
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
        return text(packaged.regexWorkerJs, "text/javascript; charset=utf-8");
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

    // All /api/* routes: Host for every method; Origin+token for POST.
    if (p.startsWith("/api/")) {
      const denied = checkApiRequest(req, security);
      if (denied) return denied;
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

    // tours: one per app, same drop-in mechanism. A 404 is normal (an app with no tour), so the
    // shell treats it as "no tour" rather than an error.
    if (p.startsWith("/tours/") && p.endsWith(".js")) {
      const id = p.slice("/tours/".length, -".js".length);
      if (packaged) {
        const code = packaged.tours?.[id];
        return code !== undefined ? text(code, "text/javascript") : err("no such tour", 404);
      }
      const tour = (await discoverTours()).find((t) => t.id === id);
      if (!tour) return err("no such tour", 404);
      return new Response(await bundleModule(tour), { headers: { "content-type": "text/javascript" } });
    }

    // dev live-reload stream (404 in the packaged exe; the client goes quiet on error)
    if (p === "/dev/reload") {
      if (packaged) return err("not found", 404);
      return createDevReloadResponse();
    }

    if (p === "/api/settings") {
      try {
        if (req.method === "POST") {
          if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
          const parsed = await readJsonCapped(req);
          if (!parsed.ok) return parsed.response;
          const body = parsed.value;
          if (body === null || typeof body !== "object" || Array.isArray(body)) {
            return err("invalid settings payload", 400);
          }
          return json(await settings.save(body));
        }
        if (req.method === "PATCH") {
          if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
          const parsed = await readJsonCapped(req);
          if (!parsed.ok) return parsed.response;
          const body = parsed.value;
          if (body === null || typeof body !== "object" || Array.isArray(body)) {
            return err("invalid settings patch", 400);
          }
          return json(await settings.update(body));
        }
        return json(await settings.read());
      } catch (e) {
        return studioErr(e);
      }
    }

    if (p === "/api/formats") return json(registry.all().map(formatMeta));
    // the editor lens's ground truth: every character adapter that declared coverage (deny by
    // absence - an undeclared platform simply is not lensable yet, and the UI says so honestly)
    if (p === "/api/coverage") {
      // Full list (export honesty needs every format's carries). Strip filters lens === false.
      const adapters = registry
        .all()
        .filter((a) => a.kind === "character" && a.coverage && !a.native)
        .map((a) => ({
          id: a.id,
          label: a.label,
          carries: a.coverage!.carries,
          notes: a.coverage!.notes,
          lens: a.lens !== false,
        }));
      // Extension-map only when no character adapter already owns that id (no dual Lumiverse tabs).
      const adapterIds = new Set(adapters.map((a) => a.id));
      const extras = EXTENSION_PLATFORMS.filter((e) => !adapterIds.has(e.id)).map((e) => ({
        id: e.id,
        label: e.label,
        carries: e.carries,
        notes: e.notes,
        lens: true,
      }));
      return json([...adapters, ...extras]);
    }
    if (p === "/api/inspect" && req.method === "POST") return handleInspect(req);
    if (p === "/api/export" && req.method === "POST") {
      if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
      const parsed = await readJsonCapped(req);
      if (!parsed.ok) return parsed.response;
      return handleExport(store, parsed.value);
    }

    if (p === "/api/studio/list") {
      try {
        return json(await store.list(url.searchParams.get("kind") ?? undefined));
      } catch (e) {
        return studioErr(e);
      }
    }
    if (p === "/api/studio/portrait") {
      try {
        const entity = await store.read(
          url.searchParams.get("kind") ?? "",
          url.searchParams.get("id") ?? "",
        );
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
      } catch (e) {
        return studioErr(e);
      }
    }
    if (p === "/api/studio/get") {
      try {
        const kind = url.searchParams.get("kind") ?? "";
        const id = url.searchParams.get("id") ?? "";
        const entity = await store.read(kind, id);
        return entity ? json(entity) : err("not found", 404);
      } catch (e) {
        return studioErr(e);
      }
    }
    // the leaving-gate's enforcement boundary: open a link in the OS browser. POST-only (so embedded
    // content cannot GET-trigger it) and re-validated here - the client gate is UX, this is the gate.
    // Only http/https survive safeExternalUrl; the NORMALIZED href is what we spawn, never the raw body.
    if (p === "/api/open" && req.method === "POST") {
      if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
      const parsed = await readJsonCapped(req, 64 * 1024);
      if (!parsed.ok) return parsed.response;
      const body = parsed.value as { url?: unknown } | null;
      const raw = typeof body?.url === "string" ? body.url : "";
      const href = safeExternalUrl(raw);
      if (href === null) return err("refused: only http and https links open externally", 400);
      openInBrowser(href);
      return new Response(null, {
        status: 204,
        headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
      });
    }

    if (p === "/api/studio/save-bundle" && req.method === "POST") {
      try {
        if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
        const parsed = await readJsonCapped(req);
        if (!parsed.ok) return parsed.response;
        const raw = parsed.value as {
          entity?: AnyEntity;
          related?: { lorebooks?: CanonicalLorebook[] };
          overwrite?: boolean;
        } | null;
        if (!raw?.entity || typeof raw.entity !== "object") {
          return err("expected { entity, related? }");
        }
        const result = await saveBundle(store, {
          entity: raw.entity,
          lorebooks: raw.related?.lorebooks,
          overwrite: raw.overwrite === true,
        });
        return json(result, result.ok ? 200 : result.partial ? 207 : 422);
      } catch (e) {
        return studioErr(e);
      }
    }
    if (p === "/api/studio/save" && req.method === "POST") {
      try {
        if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
        const parsed = await readJsonCapped(req);
        if (!parsed.ok) return parsed.response;
        const raw = parsed.value as
          | AnyEntity
          | { entity?: AnyEntity; overwrite?: boolean }
          | null;
        if (!raw || typeof raw !== "object") return err("expected a canonical entity");
        // Editor re-saves wrap { entity, overwrite: true }; import posts the entity bare (keep-both).
        const wrapped = "entity" in raw && raw.entity && typeof raw.entity === "object";
        const entity = (wrapped ? raw.entity : raw) as AnyEntity;
        const overwrite = wrapped ? raw.overwrite === true : false;
        if (typeof entity.kind !== "string") return err("expected a canonical entity");
        return json(await store.save(entity, { overwrite }));
      } catch (e) {
        return studioErr(e);
      }
    }

    if (p.startsWith("/api/")) return err("not found", 404);
    return err("not found", 404);
  };
}

/** Boot the visual app. Loopback only: a local forge, never an exposed service. */
export function startUi(
  port: number,
  studioDir: string,
  packaged?: PackagedAssets,
): { url: string; sandboxUrl: string | null; stop: () => void } {
  const store = new StudioStore(studioDir);
  const settings = new SettingsStore(studioDir);
  const sec = createSecurityContext();
  if (!packaged) startDevWatch(); // dev: edits to src/ui reload every open page

  // Filled after the sandbox listener binds; HTML injection reads this live.
  const sandboxOriginRef = { current: "" };
  const handler = createHandler(store, settings, packaged, sec, sandboxOriginRef);
  const server = Bun.serve({ port, hostname: "127.0.0.1", fetch: handler });
  const host = `127.0.0.1:${server.port}`;
  sec.expectedHost = host;
  sec.expectedOrigin = `http://${host}`;

  let sandboxUrl: string | null = null;
  let stopSandbox: (() => void) | null = null;
  try {
    const sandbox = startSandboxHost({
      allowOrigin: sec.expectedOrigin,
      packaged,
    });
    sandboxUrl = sandbox.origin;
    sandboxOriginRef.current = sandbox.origin;
    stopSandbox = sandbox.stop;
  } catch (e) {
    console.warn(
      "server: sandbox host failed to start; falling back to same-origin worker:",
      e instanceof Error ? e.message : e,
    );
  }

  return {
    url: `http://${host}`,
    sandboxUrl,
    stop: () => {
      server.stop(true);
      stopSandbox?.();
    },
  };
}
