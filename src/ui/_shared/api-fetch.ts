/**
 * Shared UI → loopback API fetch: attaches the per-launch session token and rejects non-2xx.
 * Token is injected into index HTML as <meta name="vaude-session">; never logged.
 */

export class ApiHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
}

/** Cap used client-side before reading File into memory (matches server inspect ceiling). */
export const INSPECT_BODY_MAX_BYTES = 64 * 1024 * 1024;

const TOKEN_META = 'meta[name="vaude-session"]';

export function readSessionToken(doc: Document = document): string {
  const el = doc.querySelector(TOKEN_META);
  const t = el?.getAttribute("content")?.trim() ?? "";
  return t;
}

export type ApiFetchInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
  /** When true, require a non-empty token (all POSTs). */
  requireToken?: boolean;
};

/**
 * Fetch a same-origin /api/* URL with session token when present.
 * Throws ApiHttpError on non-2xx; never includes the token in the error message.
 */
export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  const requireToken = init.requireToken ?? (init.method !== undefined && init.method !== "GET");
  if (requireToken) {
    const token = readSessionToken();
    if (!token) throw new ApiHttpError(403, "missing session");
    headers["X-Hoplight-Token"] = token;
  }
  const { requireToken: _r, headers: _h, ...rest } = init;
  const res = await fetch(path, { ...rest, headers });
  return res;
}

export async function apiFetchJson<T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : `request failed (${res.status})`;
    throw new ApiHttpError(res.status, msg);
  }
  return body as T;
}
