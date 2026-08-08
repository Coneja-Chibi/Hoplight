/**
 * UI server security: session token, Host/Origin gates, body caps, HTML CSP injection.
 * Extracted from server.ts (behavior-preserving).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { open } from "node:fs/promises";
import { ADAPTER_INPUT_MAX_BYTES } from "../core/adapter-input";
import {
  isStudioNotFoundError,
  isStudioReadError,
  isStudioValidationError,
} from "../studio/errors";
import { StudioConflictError, StudioWriteError } from "../studio/atomic-file";

/** Inspect upload ceiling (bytes): the same file ceiling every other door uses, so a file the studio
 *  accepts is never one Kit's importer refuses. JSON routes use a lower cap. */
export const INSPECT_BODY_MAX = ADAPTER_INPUT_MAX_BYTES;
export const JSON_BODY_MAX = 32 * 1024 * 1024;

export interface UiSecurityContext {
  /** Per-launch bearer; never log or persist. */
  token: string;
  /** Exact Host header expected (e.g. 127.0.0.1:8321). Filled after bind. */
  expectedHost: string;
  /** Exact Origin expected (e.g. http://127.0.0.1:8321). Filled after bind. */
  expectedOrigin: string;
}

export function createSecurityContext(): UiSecurityContext {
  return {
    token: randomBytes(32).toString("base64url"),
    expectedHost: "",
    expectedOrigin: "",
  };
}

export const json = (v: unknown, status = 200): Response =>
  new Response(JSON.stringify(v), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
export const err = (message: string, status = 400): Response => json({ error: message }, status);

/** The interchangeable spellings of the loopback host we bind. The Host/Origin gate exists to
 * stop DNS-rebinding from ATTACKER hostnames; rejecting `localhost` only paper-cuts a user with a
 * localhost bookmark while protecting nothing - all three resolve to the same loopback interface
 * the server is bound to. */
const LOOPBACK_NAMES = ["127.0.0.1", "localhost", "[::1]"] as const;

/** True when `host` is a loopback-equivalent spelling of the expected `host:port`. */
export function hostAllowed(host: string, expectedHost: string): boolean {
  if (host === expectedHost) return true;
  const port = expectedHost.split(":").pop() ?? "";
  return LOOPBACK_NAMES.some((n) => host === `${n}:${port}`);
}

/** True when `origin` is a loopback-equivalent spelling of the expected `http://host:port`. */
export function originAllowed(origin: string | null, expectedOrigin: string): boolean {
  if (origin === null) return false;
  if (origin === expectedOrigin) return true;
  const port = expectedOrigin.split(":").pop() ?? "";
  return LOOPBACK_NAMES.some((n) => origin === `http://${n}:${port}`);
}

const HTML_SECURITY_HEADERS_BASE: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

/**
 * The sha256 CSP source for every inline <script> in the served HTML. Computed from the real
 * markup, never hand-baked: a pinned hash rots the moment the import map changes, and a rotted
 * hash does not degrade - it takes the whole app down (the import map is how React resolves).
 */
export function inlineScriptHashes(html: string): string {
  const hashes: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const digest = createHash("sha256").update(m[1]!, "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes.join(" ");
}

/** Build HTML CSP; when sandboxOrigin is set, worker-src may load the distinct-origin module worker. */
export function htmlSecurityHeaders(sandboxOrigin = "", scriptHashes = ""): Record<string, string> {
  const workerExtra =
    sandboxOrigin && sandboxOrigin.startsWith("http://127.0.0.1:") ? ` ${sandboxOrigin}` : "";
  const inline = scriptHashes ? ` ${scriptHashes}` : "";
  return {
    ...HTML_SECURITY_HEADERS_BASE,
    "content-security-policy":
      // Inline scripts stay blocked except the exact hashes of what we serve (the import map).
      `default-src 'self'; script-src 'self'${inline}; style-src 'self' 'unsafe-inline'; ` +
      "img-src 'self' data: blob:; connect-src 'self'; " +
      `worker-src 'self' blob:${workerExtra}; ` +
      "font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  };
}

/** Inject per-launch session meta into served HTML. Escapes content attribute. */
export function injectSessionMeta(html: string, token: string): string {
  const safe = token.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const tag = `<meta name="vaude-session" content="${safe}">`;
  if (html.includes('name="vaude-session"')) {
    return html.replace(/<meta\s+name="vaude-session"[^>]*>/i, tag);
  }
  if (html.includes("</head>")) return html.replace("</head>", `${tag}\n</head>`);
  return tag + html;
}

/**
 * Inject sandbox origin meta (public, not a secret). Never confuses this with the session token.
 * Empty origin removes any stale tag so the UI falls back to same-origin worker.
 */
export function injectSandboxOriginMeta(html: string, sandboxOrigin: string): string {
  const re = /<meta\s+name="vaude-sandbox-origin"[^>]*>\s*/gi;
  let out = html.replace(re, "");
  const origin = sandboxOrigin.trim();
  if (!origin) return out;
  if (!origin.startsWith("http://127.0.0.1:")) {
    throw new Error("server: sandbox origin must be http://127.0.0.1:<port>");
  }
  const safe = origin.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const tag = `<meta name="vaude-sandbox-origin" content="${safe}">`;
  if (out.includes("</head>")) return out.replace("</head>", `${tag}\n</head>`);
  return tag + out;
}

function tokensEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Stream-read a request body with a hard byte cap. Returns 413 Response on overflow.
 * Checks Content-Length early when present.
 */
export async function readBodyCapped(
  req: Request,
  limit: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; response: Response }> {
  const cl = req.headers.get("content-length");
  if (cl !== null) {
    const n = Number(cl);
    if (!Number.isFinite(n) || n < 0) return { ok: false, response: err("invalid content-length", 400) };
    if (n > limit) return { ok: false, response: err("payload too large", 413) };
  }
  if (!req.body) return { ok: true, bytes: new Uint8Array(0) };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > limit) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return { ok: false, response: err("payload too large", 413) };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: err("failed to read body", 400) };
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return { ok: true, bytes: out };
}

/**
 * Stream a request body straight to a file, one chunk at a time, with a hard byte cap - never
 * holding more than one chunk in memory. readBodyCapped's `chunks: Uint8Array[]` accumulator is
 * the right tool for anything that fits comfortably in RAM (every route but one); a `.lvbak` can
 * be multi-gigabyte by design, so buffering the whole thing first would defeat the point of
 * streaming it at all. Same cap contract as readBodyCapped (413 on overflow, content-length
 * pre-check when present); the caller owns `destPath`'s lifecycle (creating its directory, and
 * removing the file whether this succeeds or fails) - this only ever writes to a path already
 * chosen for it.
 */
export async function streamBodyToFile(
  req: Request,
  destPath: string,
  limit: number,
): Promise<{ ok: true; bytes: number } | { ok: false; response: Response }> {
  const cl = req.headers.get("content-length");
  if (cl !== null) {
    const n = Number(cl);
    if (!Number.isFinite(n) || n < 0) return { ok: false, response: err("invalid content-length", 400) };
    if (n > limit) return { ok: false, response: err("payload too large", 413) };
  }
  // Owner-only: an in-flight archive holds whatever private cards/personas it carries.
  const handle = await open(destPath, "w", 0o600);
  try {
    if (!req.body) return { ok: true, bytes: 0 };
    const reader = req.body.getReader();
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > limit) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return { ok: false, response: err("payload too large", 413) };
      }
      await handle.write(value);
    }
    return { ok: true, bytes: total };
  } catch {
    return { ok: false, response: err("failed to read body", 400) };
  } finally {
    await handle.close();
  }
}

export async function readJsonCapped(
  req: Request,
  limit = JSON_BODY_MAX,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const capped = await readBodyCapped(req, limit);
  if (!capped.ok) return capped;
  if (capped.bytes.length === 0) return { ok: true, value: null };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(capped.bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: err("invalid json", 400) };
  }
}

/** Host / Origin / token gate for /api/* routes. */
export function checkApiRequest(
  req: Request,
  sec: UiSecurityContext,
): Response | null {
  if (!sec.expectedHost || !sec.expectedOrigin || !sec.token) {
    return err("server not ready", 503);
  }
  const host = req.headers.get("host") ?? "";
  if (!hostAllowed(host, sec.expectedHost)) return err("forbidden", 403);

  if (req.method === "GET" || req.method === "HEAD") {
    // GET/HEAD cannot demand the token (an <img src> sends no headers), which would leave image
    // loads usable as a blind existence oracle from any open tab. Sec-Fetch-Site is browser-set
    // and unforgeable from a page: refuse cross-site, pass everything a legitimate user produces
    // (same-origin app fetches, address-bar "none", header-less curl/older clients).
    if ((req.headers.get("sec-fetch-site") ?? "").toLowerCase() === "cross-site") {
      return err("forbidden", 403);
    }
    return null;
  }

  if (req.method === "POST" || req.method === "PATCH") {
    const origin = req.headers.get("origin");
    // Same-origin mutations from the app should send Origin. Missing Origin fails closed.
    if (!originAllowed(origin, sec.expectedOrigin)) return err("forbidden", 403);
    const token = req.headers.get("x-hoplight-token") ?? "";
    if (!tokensEqual(token, sec.token)) return err("forbidden", 403);
    return null;
  }
  return err("method not allowed", 405);
}

/**
 * Gate for the UNTRUSTED remote listener (the sidecar's data plane). Auth is the shared secret the
 * sidecar stamps on every request it forwards, and only the sidecar, which has already gated the caller
 * down to the studio owner, knows it, plus the session token on state-changing methods (CSRF). There is
 * no Host/Origin check here: the Host is the .ts.net name, and an unforgeable per-boot secret is a
 * stronger gate than a loopback host name would be. A local process hitting this port directly, or a
 * DNS-rebinding page, has no secret, so it fails closed.
 */
export function checkRemoteApiRequest(
  req: Request,
  sec: UiSecurityContext,
  secret: string,
): Response | null {
  if (!sec.token || !secret) return err("server not ready", 503);
  const presented = req.headers.get("x-hoplight-sidecar-secret") ?? "";
  if (!tokensEqual(presented, secret)) return err("forbidden", 403);

  if (req.method === "GET" || req.method === "HEAD") {
    if ((req.headers.get("sec-fetch-site") ?? "").toLowerCase() === "cross-site") {
      return err("forbidden", 403);
    }
    return null;
  }
  if (req.method === "POST" || req.method === "PATCH") {
    const token = req.headers.get("x-hoplight-token") ?? "";
    if (!tokensEqual(token, sec.token)) return err("forbidden", 403);
    return null;
  }
  return err("method not allowed", 405);
}

/**
 * Gate for the LAN listener's app requests, used ONLY after the LanHost has verified the connect code
 * AND the host approved the device (that flow is the LAN auth). Here we add only CSRF, the token on
 * state-changing methods, plus the cross-site block. No Host/Origin check: the Host is the LAN IP.
 */
export function checkLanApiRequest(req: Request, sec: UiSecurityContext): Response | null {
  if (!sec.token) return err("server not ready", 503);
  if (req.method === "GET" || req.method === "HEAD") {
    if ((req.headers.get("sec-fetch-site") ?? "").toLowerCase() === "cross-site") {
      return err("forbidden", 403);
    }
    return null;
  }
  if (req.method === "POST" || req.method === "PATCH") {
    const token = req.headers.get("x-hoplight-token") ?? "";
    if (!tokensEqual(token, sec.token)) return err("forbidden", 403);
    return null;
  }
  return err("method not allowed", 405);
}

export function contentTypeIs(req: Request, expected: string): boolean {
  const ct = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  return ct === expected;
}

const isStudioWriteError = (e: unknown): e is StudioWriteError =>
  e instanceof StudioWriteError ||
  (typeof e === "object" && e !== null && (e as { name?: string }).name === "StudioWriteError");

const isStudioConflictError = (e: unknown): e is StudioConflictError =>
  e instanceof StudioConflictError ||
  (typeof e === "object" && e !== null && (e as { name?: string }).name === "StudioConflictError");

/** Map storage failures to status codes without leaking paths. */
export const studioErr = (e: unknown): Response => {
  if (isStudioValidationError(e)) return err(e.message, 400);
  if (isStudioNotFoundError(e)) return err(e.message, 404);
  if (isStudioReadError(e)) return err(e.message, 409);
  if (isStudioConflictError(e)) return err(e.message, 409);
  if (isStudioWriteError(e)) return err(e.message, 500);
  const msg = e instanceof Error ? e.message : "internal error";
  // never echo absolute paths from unexpected errors
  if (/[A-Za-z]:\\|\/(?:Users|home|tmp|var)\//.test(msg)) return err("internal error", 500);
  return err(msg, 500);
};

/**
 * Hand a validated http(s) URL to the OS default browser. Spawns with an argv ARRAY (never a shell
 * string) so a crafted URL cannot inject a command; the caller has already scheme-validated via
 * safeExternalUrl. The launcher itself is not a boundary (it would open file:// too) - the allowlist
 * that ran before this is. Fire-and-forget; a failed launch is not worth crashing the request.
 */
export const openInBrowser = (href: string): void => {
  const argv =
    process.platform === "win32"
      ? ["rundll32", "url.dll,FileProtocolHandler", href]
      : process.platform === "darwin"
        ? ["open", href]
        : ["xdg-open", href];
  try {
    Bun.spawn(argv, { stdout: "ignore", stderr: "ignore", stdin: "ignore", windowsHide: true });
  } catch {
    // a missing launcher on an exotic OS is a degraded experience, not a server fault
  }
};

/**
 * Open a local folder/file in the OS file manager (argv array, never a shell string; fire-and-forget).
 * Used to hand a downloaded, checksum-verified build to the user. The caller passes an absolute local
 * path it produced, never untrusted input, so there is no allowlist here (unlike openInBrowser's URLs).
 */
export const openPath = (path: string): void => {
  const argv =
    process.platform === "win32"
      ? ["explorer", path]
      : process.platform === "darwin"
        ? ["open", path]
        : ["xdg-open", path];
  try {
    Bun.spawn(argv, { stdout: "ignore", stderr: "ignore", stdin: "ignore", windowsHide: true });
  } catch {
    // a missing file manager is a degraded experience, not a server fault
  }
};
