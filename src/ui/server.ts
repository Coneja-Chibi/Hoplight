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
import { registry } from "../core";
import type { AdapterInput, FormatAdapter } from "../core";
import type { CanonicalEntity } from "../core/canonical";
import { StudioStore } from "../studio/store";
import { buildReceipt, friendlyFormat, UNKNOWN_FILE_MESSAGE } from "./receipt";

type AnyEntity = CanonicalEntity<string, unknown>;

const json = (v: unknown, status = 200): Response =>
  new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const err = (message: string, status = 400): Response => json({ error: message }, status);

// -- app discovery (drop a folder in src/ui/apps/, the dock gains a tile) ---------------------------

interface DiscoveredApp {
  id: string;
  entrypoint: string;
}

async function discoverApps(): Promise<DiscoveredApp[]> {
  const appsDir = fileURLToPath(new URL("./apps/", import.meta.url));
  const glob = new Bun.Glob("*/index.ts");
  const found: DiscoveredApp[] = [];
  for await (const rel of glob.scan({ cwd: appsDir })) {
    const id = rel.split(/[\\/]/)[0]!;
    if (id.startsWith("_")) continue; // _-prefixed folders are templates/shared, same rule as formats
    found.push({ id, entrypoint: join(appsDir, rel) });
  }
  return found.sort((a, b) => a.id.localeCompare(b.id));
}

/** Bundle one app for the browser; cached per boot (restart to pick up edits - dev-grade is fine). */
const bundleCache = new Map<string, string>();
async function bundleApp(app: DiscoveredApp): Promise<string> {
  const hit = bundleCache.get(app.id);
  if (hit !== undefined) return hit;
  const built = await Bun.build({ entrypoints: [app.entrypoint], target: "browser", format: "esm" });
  if (!built.success || built.outputs.length === 0) {
    throw new Error(`ui: app "${app.id}" failed to bundle: ${built.logs.map((l) => l.message).join("; ")}`);
  }
  const code = await built.outputs[0]!.text();
  bundleCache.set(app.id, code);
  return code;
}

/** Manifests come from the modules themselves (server imports them once; they are DOM-free at top level). */
async function appManifests(apps: DiscoveredApp[]): Promise<unknown[]> {
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

export function createHandler(store: StudioStore): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/" || p === "/index.html") return staticFile("./index.html", "text/html; charset=utf-8");
    if (p === "/tokens.css") return staticFile("./theme/tokens.css", "text/css; charset=utf-8");
    if (p === "/boot.js") {
      const built = await Bun.build({
        entrypoints: [fileURLToPath(new URL("./boot.ts", import.meta.url))],
        target: "browser",
        format: "esm",
      });
      if (!built.success) return err("boot bundle failed", 500);
      return new Response(await built.outputs[0]!.text(), { headers: { "content-type": "text/javascript" } });
    }

    if (p === "/api/apps") return json(await appManifests(await discoverApps()));
    if (p.startsWith("/apps/") && p.endsWith(".js")) {
      const id = p.slice("/apps/".length, -".js".length);
      const app = (await discoverApps()).find((a) => a.id === id);
      if (!app) return err("no such app", 404);
      return new Response(await bundleApp(app), { headers: { "content-type": "text/javascript" } });
    }

    if (p === "/api/formats") return json(registry.all().map(formatMeta));
    if (p === "/api/inspect" && req.method === "POST") return handleInspect(req);
    if (p === "/api/export" && req.method === "POST") return handleExport(req);

    if (p === "/api/studio/list") return json(await store.list(url.searchParams.get("kind") ?? undefined));
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
export function startUi(port: number, studioDir: string): { url: string; stop: () => void } {
  const store = new StudioStore(studioDir);
  const server = Bun.serve({ port, hostname: "127.0.0.1", fetch: createHandler(store) });
  return { url: `http://127.0.0.1:${server.port}`, stop: () => server.stop() };
}
