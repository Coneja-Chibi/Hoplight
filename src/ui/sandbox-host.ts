/**
 * Sandbox-only loopback host (ADR-009 / Plan 017).
 *
 * Distinct origin (ephemeral port on 127.0.0.1). Serves ONLY immutable sandbox bootstrap assets:
 * worker module + wasmoon glue.wasm. No /api, no session token, no studio paths, no index HTML.
 * CORS is limited to the exact UI origin so the module worker can load cross-origin.
 */

import { fileURLToPath } from "node:url";
import type { PackagedAssets } from "./assets";
import { originAllowed } from "./server-security";

export interface SandboxHostOptions {
  /** Exact UI origin allowed for CORS (e.g. http://127.0.0.1:8321). */
  allowOrigin: string;
  packaged?: PackagedAssets;
}

const SANDBOX_CSP =
  "default-src 'none'; script-src 'self'; connect-src 'self'; worker-src 'self'; " +
  "wasm-unsafe-eval 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const nosniff = { "x-content-type-options": "nosniff" as const };

// Wasmoon carries defensive dynamic imports for Node-only fallbacks. They are unreachable in a browser
// worker (which has `location`), but Bun otherwise attempts to resolve them while producing this bundle.
const WASMOON_BROWSER_EXTERNALS = ["module", "url", "fs", "path", "child_process", "crypto"];

/** Paths the sandbox authority is allowed to serve. Everything else fails closed. */
export const SANDBOX_ALLOWLIST = ["/sandbox/worker.js", "/sandbox/regex-worker.js", "/sandbox/glue.wasm"] as const;

export function isSandboxAllowlistedPath(pathname: string): boolean {
  return (SANDBOX_ALLOWLIST as readonly string[]).includes(pathname);
}

function corsHeaders(allowOrigin: string): Record<string, string> {
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    "cross-origin-resource-policy": "cross-origin",
    "vary": "Origin",
  };
}

function deny(): Response {
  return new Response(JSON.stringify({ error: "not found" }), {
    status: 404,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...nosniff,
      "content-security-policy": "default-src 'none'",
    },
  });
}

async function buildWorkerJs(packaged?: PackagedAssets): Promise<Response | null> {
  if (packaged?.sandboxWorkerJs) {
    return new Response(packaged.sandboxWorkerJs, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": SANDBOX_CSP,
        ...nosniff,
      },
    });
  }
  const entry = fileURLToPath(new URL("../sandbox/lua/worker.ts", import.meta.url));
  const built = await Bun.build({
    entrypoints: [entry],
    target: "browser",
    format: "esm",
    external: WASMOON_BROWSER_EXTERNALS,
  });
  if (!built.success || built.outputs.length === 0) return null;
  return new Response(await built.outputs[0]!.text(), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": SANDBOX_CSP,
      ...nosniff,
    },
  });
}

async function buildRegexWorkerJs(packaged?: PackagedAssets): Promise<Response | null> {
  if (packaged?.regexWorkerJs) {
    return new Response(packaged.regexWorkerJs, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": SANDBOX_CSP,
        ...nosniff,
      },
    });
  }
  const entry = fileURLToPath(new URL("../sandbox/regex/worker.ts", import.meta.url));
  const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "esm" });
  if (!built.success || built.outputs.length === 0) return null;
  return new Response(await built.outputs[0]!.text(), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": SANDBOX_CSP,
      ...nosniff,
    },
  });
}

function glueWasmResponse(): Response {
  const wasmPath = fileURLToPath(new URL("../../node_modules/wasmoon/dist/glue.wasm", import.meta.url));
  return new Response(Bun.file(wasmPath), {
    headers: {
      "content-type": "application/wasm",
      "cache-control": "public, max-age=86400",
      "content-security-policy": SANDBOX_CSP,
      ...nosniff,
    },
  });
}

/**
 * Fetch handler for the sandbox-only origin. Never injects the API token.
 * `allowOrigin` must be the exact UI origin; requests from other Origins get no ACAO (browser blocks).
 */
export function createSandboxHandler(
  opts: SandboxHostOptions,
): (req: Request) => Promise<Response> {
  const allowOrigin = opts.allowOrigin;
  if (!allowOrigin.startsWith("http://127.0.0.1:")) {
    throw new Error("sandbox-host: allowOrigin must be http://127.0.0.1:<port>");
  }

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const p = url.pathname;
    // Echo the requester's Origin ONLY when it is a loopback-equivalent spelling of the UI
    // origin (localhost / [::1] bookmarks), so the module worker loads for both. Foreign
    // origins still get the canonical ACAO they can never match - deny by mismatch.
    const reqOrigin = req.headers.get("origin");
    const acao = originAllowed(reqOrigin, allowOrigin) ? (reqOrigin as string) : allowOrigin;

    // Preflight for cross-origin module worker load from the UI origin.
    if (req.method === "OPTIONS") {
      if (!isSandboxAllowlistedPath(p)) return deny();
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(acao),
          ...nosniff,
        },
      });
    }

    if (req.method !== "GET" && req.method !== "HEAD") return deny();

    if (p === "/sandbox/worker.js") {
      const body = await buildWorkerJs(opts.packaged);
      if (!body) {
        return new Response(JSON.stringify({ error: "sandbox worker bundle failed" }), {
          status: 500,
          headers: { "content-type": "application/json", ...nosniff },
        });
      }
      // Attach CORS so UI origin can construct a module Worker from this origin.
      const headers = new Headers(body.headers);
      for (const [k, v] of Object.entries(corsHeaders(acao))) headers.set(k, v);
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }
      return new Response(body.body, { status: 200, headers });
    }

    if (p === "/sandbox/regex-worker.js") {
      const body = await buildRegexWorkerJs(opts.packaged);
      if (!body) return deny();
      const headers = new Headers(body.headers);
      for (const [k, v] of Object.entries(corsHeaders(acao))) headers.set(k, v);
      return req.method === "HEAD"
        ? new Response(null, { status: 200, headers })
        : new Response(body.body, { status: 200, headers });
    }

    if (p === "/sandbox/glue.wasm") {
      const body = glueWasmResponse();
      const headers = new Headers(body.headers);
      for (const [k, v] of Object.entries(corsHeaders(acao))) headers.set(k, v);
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }
      return new Response(body.body, { status: 200, headers });
    }

    // Fail closed: no /api, no index, no traversal aliases, no token HTML.
    return deny();
  };
}

/** Start the sandbox-only server on an ephemeral loopback port. */
export function startSandboxHost(
  opts: SandboxHostOptions,
): { origin: string; stop: () => void } {
  const handler = createSandboxHandler(opts);
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: handler,
  });
  const origin = `http://127.0.0.1:${server.port}`;
  return {
    origin,
    stop: () => {
      server.stop(true);
    },
  };
}
