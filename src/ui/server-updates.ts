/**
 * The Updates route: fetch the repo's GitHub releases list. The ONE outbound call this feature makes, and
 * only when the Updates page asks. Fixed URL (no caller input in the host/path -> no SSRF), a short
 * in-memory cache + ETag so a curious user cannot burn GitHub's 60/hr unauthenticated budget, and an
 * honest rate-limited answer. The client parses the raw payload into the timeline via the tested
 * version-history core (kept client-side, same split as the update-check row).
 */
import { json } from "./server-security";

const RELEASES_LIST_API = "https://api.github.com/repos/Coneja-Chibi/Hoplight/releases";
const PER_PAGE = 30;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  etag: string;
  body: unknown;
  at: number;
}
const cache = new Map<number, CacheEntry>();

export interface ReleasesResult {
  httpStatus: number;
  /** raw GitHub /releases array (or null on any non-200) */
  body: unknown;
  /** a full page came back, so older releases may exist beyond it */
  hasMore: boolean;
  /** seconds until the rate limit resets (set only on 403/429) */
  retryAfterSec?: number;
}

/** Validate the page param to a small int (1..50): the ONLY caller input anywhere near the fetch URL. */
export function clampPage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 50);
}

const shape = (httpStatus: number, body: unknown): ReleasesResult => ({
  httpStatus,
  body,
  hasMore: Array.isArray(body) && body.length >= PER_PAGE,
});

/** Fetch (or serve from cache) one page of releases. Injected clock for testability. */
export async function handleReleasesFetch(page: number, now: () => number = Date.now): Promise<Response> {
  const cached = cache.get(page);
  if (cached && now() - cached.at < CACHE_TTL_MS) {
    return json(shape(200, cached.body));
  }
  try {
    const url = `${RELEASES_LIST_API}?per_page=${PER_PAGE}&page=${page}`;
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "hoplight-update-check",
    };
    if (cached) headers["if-none-match"] = cached.etag;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers });

    // A 304 means our cached copy is still current: GitHub does not count it against the hourly limit.
    if (res.status === 304 && cached) {
      cache.set(page, { ...cached, at: now() });
      return json(shape(200, cached.body));
    }
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get("x-ratelimit-reset") ?? "0");
      const retryAfterSec = reset > 0 ? Math.max(0, Math.ceil(reset - now() / 1000)) : 0;
      return json({ httpStatus: res.status, body: null, hasMore: false, retryAfterSec });
    }
    if (res.status !== 200) {
      return json({ httpStatus: res.status, body: null, hasMore: false });
    }
    const body = await res.json().catch(() => null);
    const etag = res.headers.get("etag") ?? "";
    if (etag) cache.set(page, { etag, body, at: now() });
    return json(shape(200, body));
  } catch {
    return json({ httpStatus: 0, body: null, hasMore: false });
  }
}
