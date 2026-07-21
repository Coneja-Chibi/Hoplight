/**
 * Shared loopback-test rig: the security context + request builder every server test file uses,
 * extracted exactly once (server.test.ts and server-bundle.test.ts split at the 500-line cap).
 * Test-only module; never imported by production code.
 */
import { createSecurityContext } from "./server";
import type { UiSecurityContext } from "./server-security";

export const filledSec = (): UiSecurityContext => {
  const sec = createSecurityContext();
  sec.expectedHost = "127.0.0.1:8321";
  sec.expectedOrigin = "http://127.0.0.1:8321";
  return sec;
};

export const apiReq = (
  path: string,
  init: {
    method?: string;
    host?: string;
    origin?: string | null;
    token?: string | null;
    contentType?: string;
    body?: BodyInit | null;
    fetchSite?: string;
  } = {},
): Request => {
  const headers = new Headers();
  headers.set("host", init.host ?? "127.0.0.1:8321");
  if (init.fetchSite) headers.set("sec-fetch-site", init.fetchSite);
  if (init.origin !== null) headers.set("origin", init.origin ?? "http://127.0.0.1:8321");
  if (init.token !== null && init.token !== undefined) headers.set("x-hoplight-token", init.token);
  if (init.contentType) headers.set("content-type", init.contentType);
  return new Request(`http://127.0.0.1:8321${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body,
  });
};
