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
import type { CanonicalRegexSet } from "../entities/regex/schema";
import { entityRevision } from "../entities/canonical-revision";
import { StudioStore } from "../studio/store";
import type { StudioStoreLike, SettingsStoreLike } from "../studio/contracts";
import { SettingsStore } from "../studio/settings";
import { portraitBytes } from "../studio/portrait";
import { safeExternalUrl } from "./_shared/external-url";
import { EXTENSION_PLATFORMS } from "../formats/_shared/extension-platforms";
import type { PackagedAssets } from "./assets";
import { handleDocsRequest } from "./server-docs";
import { startSandboxHost } from "./sandbox-host";
import type { SidecarManager } from "./remote/sidecar-manager";
import type { LanManager } from "./remote/lan-manager";
import {
  handleRemoteRoutes,
  isHostOnlyRoute,
  setupRemoteAccess,
  type MakeHandler,
} from "./server-remote";
import { APP_VERSION } from "../version";
import { handleUpdateCheck } from "./server-update";
import { makeSwitchManager } from "./switch/setup";
import type { SwitchManager } from "./switch/manager";
import { handleUpdatesRoutes } from "./switch/routes";
import { handleStudioDelete, handleStudioSave } from "./server-studio-write";
import { handleStudioRead } from "./server-studio-read";
import { handleRestart, handleShutdown, realSpawnSelf, type LifecycleDeps } from "./server-lifecycle";
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
  checkRemoteApiRequest,
  checkLanApiRequest,
  contentTypeIs,
  studioErr,
  openInBrowser,
} from "./server-security";
import {
  discoverApps,
  discoverSetupSteps,
  discoverTours,
  bundleModule,
  startDevWatch,
  appManifests,
  createDevReloadResponse,
  handleAssetRoutes,
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
  store: StudioStoreLike,
  settings: SettingsStoreLike,
  packaged?: PackagedAssets,
  sec?: UiSecurityContext,
  /**
   * Live sandbox origin for HTML meta injection (ADR-009). Mutable so startUi can fill it after
   * both listeners bind. String form also accepted for tests.
   */
  sandboxOrigin?: string | { current: string },
  /** filled by startUi after the listener binds; quit/restart need the real stop */
  lifecycle?: LifecycleDeps,
  /** remote-access sidecar manager; absent in tests and when the binary is missing */
  remote?: SidecarManager,
  /** when set, this handler serves the UNTRUSTED remote listener: the /api gate requires this shared
   *  secret (stamped by the sidecar) instead of the loopback Host/Origin check. */
  remoteSecret?: string,
  /** when true, this handler serves an already-approved LAN session (the connect code + host approval
   *  gated it upstream); /api uses the CSRF token only, no Host/Origin or secret. */
  lanApproved?: boolean,
  /** the LAN manager, present only on the trusted handler (LAN management is host-only). */
  lan?: LanManager,
  /** the version-switch manager, present only on the trusted handler (switching is host-only). */
  switchManager?: SwitchManager,
): (req: Request) => Promise<Response> {
  const security = sec ?? createSecurityContext();

  // no-store on every served asset: the bytes are local and free, and heuristic browser caching
  // (no cache-control at all) let a restarted server keep serving WEEK-OLD bundles from HTTP
  // cache - "restart" then looked broken because the tab never re-fetched the fresh code
  const text = (body: string, type: string, extra?: Record<string, string>): Response =>
    new Response(body, { headers: { "content-type": type, "cache-control": "no-store", ...extra } });

  const resolveSandboxOrigin = (): string => {
    if (!sandboxOrigin) return "";
    if (typeof sandboxOrigin === "string") return sandboxOrigin;
    return sandboxOrigin.current;
  };

  const htmlResponse = (rawHtml: string): Response => {
    let html = injectSessionMeta(rawHtml, security.token);
    if (!packaged) html = html.replace("</head>", '<meta name="vaude-dev" content="1">\n</head>');
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

  // A remote handler is the untrusted Tailscale listener (remoteSecret) or an approved LAN session.
  const isRemote = remoteSecret != null || lanApproved === true;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const p = url.pathname;

    // Trusted loopback listener must never accept sidecar-proxied (remote) traffic; refuse the secret
    // header on ANY path, before routing (not just /api).
    if (!isRemote && req.headers.get("x-hoplight-sidecar-secret")) return err("refused", 403);

    // Untrusted remote listener: NOTHING is served without the sidecar secret (only the sidecar, which
    // has already gated the caller down to the studio owner, carries it). This replaces the loopback
    // Host check and stops a DNS-rebinding page from pulling the token-bearing HTML. Every path, first.
    if (remoteSecret) {
      const denied = checkRemoteApiRequest(req, security, remoteSecret);
      if (denied) return denied;
    }

    // HOST-ONLY surface: a tailed-in or LAN-served device may USE the studio, but must never reach
    // remote-access management OR host/app control (turn access off, kick devices, open a browser on
    // the host, write settings, shut down or restart). Those belong to the local host alone.
    if (isRemote && isHostOnlyRoute(p, req.method)) {
      return err("forbidden: managed on the host device", 403);
    }

    if (p === "/" || p === "/index.html") {
      if (packaged) return htmlResponse(packaged.indexHtml);
      const file = Bun.file(fileURLToPath(new URL("./index.html", import.meta.url)));
      return htmlResponse(await file.text());
    }
    // Static + bundled assets (CSS, icons, boot bundle, vendor, sealed sandbox workers). The HTML shell
    // above stays here because it needs per-launch session-meta injection.
    const assetResp = await handleAssetRoutes(p, packaged);
    if (assetResp) return assetResp;

    // /api auth gate. The untrusted Tailscale listener was already gated by its secret at the top; an
    // approved LAN session uses the CSRF token only (its Host is the LAN IP); the trusted loopback
    // listener uses Host/Origin/token. Host-only routes were already refused above.
    if (p.startsWith("/api/")) {
      if (lanApproved) {
        const denied = checkLanApiRequest(req, security);
        if (denied) return denied;
      } else if (!remoteSecret) {
        const denied = checkApiRequest(req, security);
        if (denied) return denied;
      }
    }

    const docsResponse = await handleDocsRequest(req, url, packaged);
    if (docsResponse) return docsResponse;

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
      return new Response(await bundleModule(app), { headers: { "content-type": "text/javascript", "cache-control": "no-store" } });
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
      return new Response(await bundleModule(step), { headers: { "content-type": "text/javascript", "cache-control": "no-store" } });
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
      return new Response(await bundleModule(tour), { headers: { "content-type": "text/javascript", "cache-control": "no-store" } });
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

    // mode tells the About row which UPDATE PATH applies: a packaged exe downloads the next
    // release, a source checkout runs git pull - same version math, different prescription
    if (p === "/api/version") {
      return json({
        version: APP_VERSION,
        // Never leak the host filesystem path to a remote/LAN device.
        studioDir: isRemote ? undefined : store.studioPath(),
        mode: packaged ? "packaged" : "source",
      });
    }
    // Remote access control plane (Tailscale + LAN). The /api gate above already enforced trusted-origin
    // auth, and host-only routes were refused for remote/LAN devices, so only the local owner reaches it.
    const remoteResp = await handleRemoteRoutes(req, p, { remote, lan, settings });
    if (remoteResp) return remoteResp;

    if (p === "/api/update-check") return handleUpdateCheck();
    if (switchManager) {
      const upd = await handleUpdatesRoutes(req, p, { manager: switchManager, settings, installed: APP_VERSION });
      if (upd) return upd;
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

    const studioRead = await handleStudioRead(p, url, store);
    if (studioRead) return studioRead;
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
        if (!entity) return err("not found", 404);
        return json(url.searchParams.get("revision") === "1"
          ? { entity, revision: entityRevision(entity) }
          : entity);
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
          related?: { lorebooks?: CanonicalLorebook[]; regexSets?: CanonicalRegexSet[] };
          overwrite?: boolean;
        } | null;
        if (!raw?.entity || typeof raw.entity !== "object") {
          return err("expected { entity, related? }");
        }
        const result = await saveBundle(store, {
          entity: raw.entity,
          lorebooks: raw.related?.lorebooks,
          regexSets: raw.related?.regexSets,
          overwrite: raw.overwrite === true,
        });
        return json(result, result.ok ? 200 : result.partial ? 207 : 422);
      } catch (e) {
        return studioErr(e);
      }
    }
    if (p === "/api/studio/save" && req.method === "POST") return handleStudioSave(req, store);
    if (p === "/api/studio/delete" && req.method === "POST") return handleStudioDelete(req, store);
    if (lifecycle && p === "/api/shutdown" && req.method === "POST") return handleShutdown(lifecycle);
    if (lifecycle && p === "/api/restart" && req.method === "POST") return handleRestart(lifecycle);

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
  const lifecycle: LifecycleDeps = { stop: () => {}, exit: (c) => process.exit(c), spawnSelf: realSpawnSelf };

  // Remote access (Tailscale + LAN). The handler factory is injected so server-remote.ts never imports
  // back here; setupRemoteAccess creates the managers, binds the untrusted listener, and resumes on boot.
  const makeHandler: MakeHandler = (o) =>
    createHandler(store, settings, packaged, sec, sandboxOriginRef, lifecycle, o.remote, o.remoteSecret, o.lanApproved, o.lan);
  const remoteAccess = setupRemoteAccess({ settings, studioDir, makeHandler });

  // Version switching (update/rollback). Host-only: only the trusted handler below gets the manager.
  const switchManager = makeSwitchManager(!!packaged, process.cwd(), APP_VERSION, settings);

  const handler = createHandler(
    store,
    settings,
    packaged,
    sec,
    sandboxOriginRef,
    lifecycle,
    remoteAccess.remote,
    undefined,
    undefined,
    remoteAccess.lan,
    switchManager,
  );
  // idleTimeout: Bun's default is 10s and it killed bulk imports mid-inspect (a multi-MB card
  // racing 16 adapters can sit longer than that with no bytes on the wire). 120s covers the
  // slowest real inspect observed (23MB charx) with an order of magnitude to spare.
  const server = Bun.serve({ port, hostname: "127.0.0.1", idleTimeout: 120, fetch: handler });
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

  const stop = (): void => {
    server.stop(true);
    stopSandbox?.();
    remoteAccess.stop();
  };
  lifecycle.stop = stop;

  return { url: `http://${host}`, sandboxUrl, stop };
}
