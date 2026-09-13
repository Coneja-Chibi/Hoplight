/**
 * Browser-only Studio runtime for static hosting. All mutable state lives in Maps owned by this
 * page load; reload or close the tab and the studio disappears.
 */
import * as registry from "../core/registry";
import { EXTENSION_PLATFORMS } from "../formats/_shared/extension-platforms";
import { registerPackagedFormats } from "../generated/packaged-formats";
import { entityRevision } from "../entities/canonical-revision";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import type { CanonicalRegexSet } from "../entities/regex/schema";
import { memoryStudioFs } from "../studio/fs-backend";
import { StudioStore } from "../studio/store";
import { SettingsStore } from "../studio/settings";
import { CollectionsStore } from "../studio/collections";
import { applyCollectionEdit } from "../studio/collections-shape";
import { saveBundle } from "../studio/bundle";
import { portraitBytes } from "../studio/portrait";
import { APP_VERSION } from "../version";
import { EngineActionError, exportCanonical, formatMeta, inspectBytes } from "../ui/engine-actions";
import { parseCollectionEdit } from "../ui/collection-edit";
import type { DocsIndex, DocFigure } from "../ui/docs-types";
import { disableVolatileWebStorage, enableVolatileWebStorage } from "../ui/_shared/web-storage";
import { announceBrowserStudioChange } from "../browser-mode";

interface PocketData {
  manifests: unknown[];
  setupSteps: string[];
  docsIndex: DocsIndex;
  docFigures: DocFigure[];
}

declare global {
  var __HOPLIGHT_POCKET_DATA__: PocketData | undefined;
  var __HOPLIGHT_POCKET_PORTRAIT__: ((kind: string, id: string) => string | null) | undefined;
}

const STUDIO_DIR = "/hoplight-tab";
const JSON_MAX = 32 * 1024 * 1024;
const unavailable = "This control needs the installed Hoplight app and is unavailable in the temporary browser studio.";

const json = (value: unknown, status = 200): Response => Response.json(value, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
const error = (message: string, status = 400): Response => json({ error: message }, status);

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > JSON_MAX) throw new EngineActionError("payload too large", 413);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new EngineActionError("invalid JSON");
  }
}

const contentTypeIs = (request: Request, expected: string): boolean =>
  (request.headers.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase() === expected;

function formatCoverage(): unknown[] {
  const adapters = registry.all()
    .filter((adapter) => adapter.kind === "character" && adapter.coverage && !adapter.native)
    .map((adapter) => ({
      id: adapter.id,
      label: adapter.label,
      carries: adapter.coverage!.carries,
      notes: adapter.coverage!.notes,
      lens: adapter.lens !== false,
    }));
  const ids = new Set(adapters.map((adapter) => adapter.id));
  return [
    ...adapters,
    ...EXTENSION_PLATFORMS.filter((platform) => !ids.has(platform.id)).map((platform) => ({
      id: platform.id,
      label: platform.label,
      carries: platform.carries,
      notes: platform.notes,
      lens: true,
    })),
  ];
}

export function installPocketRuntime(): () => void {
  registerPackagedFormats();
  enableVolatileWebStorage();

  const io = memoryStudioFs();
  const store = new StudioStore(STUDIO_DIR, io);
  const settings = new SettingsStore(STUDIO_DIR, io);
  const collections = new CollectionsStore(STUDIO_DIR, io);
  const portraits = new Map<string, string>();
  const originalFetch = globalThis.fetch.bind(globalThis);
  const data = globalThis.__HOPLIGHT_POCKET_DATA__;
  if (!data) throw new Error("browser studio data is missing");

  const portraitKey = (kind: string, id: string): string => `${kind}/${id}`;
  const cachePortrait = async (kind: string, id: string): Promise<void> => {
    const key = portraitKey(kind, id);
    const old = portraits.get(key);
    if (old) URL.revokeObjectURL(old);
    portraits.delete(key);
    const entity = await store.read(kind, id);
    const art = entity ? portraitBytes(entity) : null;
    if (art) portraits.set(key, URL.createObjectURL(new Blob([art.bytes as BlobPart], { type: art.mime })));
  };
  globalThis.__HOPLIGHT_POCKET_PORTRAIT__ = (kind, id) => portraits.get(portraitKey(kind, id)) ?? null;

  const list = async (kind?: string): Promise<unknown> => {
    const rows = await store.list(kind);
    await Promise.all(rows.filter((row) => row.hasPortrait).map((row) => cachePortrait(row.kind, row.id)));
    return rows;
  };

  const route = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/apps") return json(data.manifests);
      if (path === "/api/setup/steps") return json(data.setupSteps);
      if (path === "/api/docs/index") return json(data.docsIndex);
      if (path === "/api/docs/figures") return json(data.docFigures);
      if (path === "/api/docs/get") {
        const record = data.docsIndex.docs.find((doc) => doc.id === url.searchParams.get("id"));
        return record ? originalFetch(new URL(record.path, document.baseURI)) : error("doc not found", 404);
      }
      if (path === "/api/settings") {
        if (request.method === "POST") return json(await settings.save(await readJson(request)));
        if (request.method === "PATCH") return json(await settings.update(await readJson(request)));
        return json(await settings.read());
      }
      if (path === "/api/version") return json({ version: APP_VERSION, mode: "browser" });
      if (path === "/api/formats") return json(registry.all().map(formatMeta));
      if (path === "/api/coverage") return json(formatCoverage());
      if (path === "/api/studio/list") return json(await list(url.searchParams.get("kind") ?? undefined));
      if (path === "/api/studio/inventory") {
        const inventory = await store.inventory(url.searchParams.get("kind") ?? undefined);
        await Promise.all(inventory.entities.filter((row) => row.hasPortrait).map((row) => cachePortrait(row.kind, row.id)));
        return json(inventory);
      }
      if (path === "/api/studio/get") {
        const kind = url.searchParams.get("kind") ?? "";
        const id = url.searchParams.get("id") ?? "";
        const entity = await store.read(kind, id);
        if (!entity) return error("not found", 404);
        return json(url.searchParams.get("revision") === "1" ? { entity, revision: entityRevision(entity) } : entity);
      }
      if (path === "/api/studio/save" && request.method === "POST") {
        const raw = await readJson(request) as Record<string, unknown>;
        const wrapped = raw && typeof raw === "object" && raw.entity && typeof raw.entity === "object";
        const entity = wrapped ? raw.entity : raw;
        if (wrapped && typeof raw.expectedRevision === "string") {
          const result = await store.compareAndSave(entity, raw.expectedRevision);
          if (result.status !== "saved") {
            return result.status === "stale"
              ? error("piece changed since it was opened", 409)
              : error("piece no longer exists", 404);
          }
          await cachePortrait(result.summary.kind, result.summary.id);
          announceBrowserStudioChange([result.summary.kind]);
          return json({ summary: result.summary, revision: result.revision });
        }
        const summary = await store.save(entity, { overwrite: Boolean(wrapped && raw.overwrite === true) });
        await cachePortrait(summary.kind, summary.id);
        announceBrowserStudioChange([summary.kind]);
        return json(summary);
      }
      if (path === "/api/studio/delete" && request.method === "POST") {
        const raw = await readJson(request) as { kind?: unknown; id?: unknown };
        if (typeof raw.kind !== "string" || typeof raw.id !== "string") return error("expected { kind, id }");
        const deleted = await store.delete(raw.kind, raw.id);
        const key = portraitKey(raw.kind, raw.id);
        const old = portraits.get(key);
        if (old) URL.revokeObjectURL(old);
        portraits.delete(key);
        if (deleted) announceBrowserStudioChange([raw.kind]);
        return json({ deleted });
      }
      if (path === "/api/studio/save-bundle" && request.method === "POST") {
        const raw = await readJson(request) as {
          entity?: unknown;
          related?: { lorebooks?: CanonicalLorebook[]; regexSets?: CanonicalRegexSet[] };
          overwrite?: boolean;
        };
        if (!raw.entity || typeof raw.entity !== "object") return error("expected { entity, related? }");
        const result = await saveBundle(store, {
          entity: raw.entity as never,
          lorebooks: raw.related?.lorebooks,
          regexSets: raw.related?.regexSets,
          overwrite: raw.overwrite === true,
        });
        if (result.primary) await cachePortrait(result.primary.kind, result.primary.id);
        const changedKinds = [...result.related, ...(result.primary ? [result.primary] : [])].map((row) => row.kind);
        if (changedKinds.length) announceBrowserStudioChange(changedKinds);
        return json(result, result.ok ? 200 : result.partial ? 207 : 422);
      }
      if (path === "/api/inspect" && request.method === "POST") {
        if (!contentTypeIs(request, "application/octet-stream")) return error("unsupported media type", 415);
        const filename = decodeURIComponent(request.headers.get("x-filename") ?? "upload");
        return json(inspectBytes(new Uint8Array(await request.arrayBuffer()), filename));
      }
      if (path === "/api/export" && request.method === "POST") return json(await exportCanonical(store, await readJson(request)));
      if (path === "/api/collections") {
        if (request.method === "GET" || request.method === "HEAD") return json(await collections.read());
        const parsed = parseCollectionEdit(await readJson(request));
        return parsed.ok
          ? json(await collections.edit((current) => applyCollectionEdit(current, parsed.edit)))
          : error(parsed.why);
      }
      if (path === "/api/open" && request.method === "POST") {
        const raw = await readJson(request) as { url?: unknown };
        if (typeof raw.url !== "string" || !/^https?:\/\//i.test(raw.url)) return error("refused link");
        window.open(raw.url, "_blank", "noopener,noreferrer");
        return new Response(null, { status: 204 });
      }
      if (path === "/api/macro-lab/engines") return json({ engines: [] });
      if (path.startsWith("/api/")) return error(unavailable, 501);
      return originalFetch(request);
    } catch (reason) {
      if (reason instanceof EngineActionError) return error(reason.message, reason.status);
      return error(reason instanceof Error ? reason.message : "browser studio request failed", 422);
    }
  };

  const pocketFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const resolved = typeof input === "string" ? new URL(input, document.baseURI) : input;
    const request = new Request(resolved, init);
    return new URL(request.url).pathname.startsWith("/api/") ? route(request) : originalFetch(request);
  };
  globalThis.fetch = pocketFetch as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
    disableVolatileWebStorage();
    for (const url of portraits.values()) URL.revokeObjectURL(url);
    portraits.clear();
    delete globalThis.__HOPLIGHT_POCKET_PORTRAIT__;
  };
}
