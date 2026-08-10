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

/**
 * Did this failure come back with that HTTP status?
 *
 * NOT `instanceof`, AND THE REASON IS THE BUILD. Each app under /apps is bundled separately, so the
 * shell's copy of this module and the Workbench's copy define two different classes with the same
 * name. `ctx.api` belongs to the shell, so an error it throws is never `instanceof` the Workbench's
 * class - the check silently reads false, forever, for every app that tries it.
 *
 * It cost a real bug: the editor's conflict bar was wired to a 409 it could not recognise, so a
 * save refused because the file had changed went back to being an unexplained failure. Nothing in a
 * typecheck, a lint, or a unit test sees this; the two classes only become two at bundle time.
 */
export const apiStatusIs = (error: unknown, status: number): boolean =>
  typeof error === "object" && error !== null
  && (error as { status?: unknown }).status === status;

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
    if (res.status === 403 && msg === STALE_SESSION) reloadForNewSession();
    throw new ApiHttpError(res.status, msg);
  }
  return body as T;
}

/** Must match the server's marker exactly; see STALE_SESSION in server-security.ts. */
const STALE_SESSION = "stale session";

/** Set once, because a reload that races another reload is a page that never finishes loading. */
let reloading = false;

/**
 * The server was replaced under this page: reload, so the token in the document catches up.
 *
 * THE PAGE CANNOT RECOVER ANY OTHER WAY. The session token is read from a meta tag written when the
 * document was served, so a tab whose server has restarted will present the old one on every request
 * for as long as it stays open - and the only visible symptom is that nothing sends. Restarting
 * again cannot help, because each restart mints another token; that loop is what this exists to
 * break. A reload re-fetches the document and with it the current token.
 *
 * Nothing is lost that was not already lost: these are requests the server has just refused.
 */
function reloadForNewSession(): void {
  if (reloading) return;
  reloading = true;
  location.reload();
}
