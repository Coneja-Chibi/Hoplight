/**
 * Loopback API boundary: Host / Origin / token, body caps, session HTML injection.
 */
import { describe, expect, test, beforeAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StudioStore } from "../studio/store";
import { loadFormats } from "../core";
import { SettingsStore } from "../studio/settings";
import {
  checkApiRequest,
  createHandler,
  createSecurityContext,
  injectSessionMeta,
  inlineScriptHashes,
  readBodyCapped,
  INSPECT_BODY_MAX,
} from "./server";

import { apiReq, filledSec } from "./server-test-rig";

describe("UiSecurityContext", () => {
  test("two launches get different nonempty tokens", () => {
    const a = createSecurityContext();
    const b = createSecurityContext();
    expect(a.token.length).toBeGreaterThan(16);
    expect(b.token.length).toBeGreaterThan(16);
    expect(a.token).not.toBe(b.token);
  });
});

describe("injectSessionMeta", () => {
  test("injects exactly one meta tag", () => {
    const html = "<html><head><title>x</title></head><body></body></html>";
    const out = injectSessionMeta(html, "abc&\"<>");
    expect(out.match(/name="vaude-session"/g)?.length).toBe(1);
    expect(out).toContain('content="abc&amp;&quot;&lt;>"');
    expect(out).not.toContain('content="abc&"');
  });
});

describe("checkApiRequest", () => {
  test("wrong host is 403", () => {
    const sec = filledSec();
    const res = checkApiRequest(apiReq("/api/settings", { host: "evil.example" }), sec);
    expect(res?.status).toBe(403);
  });

  test("POST missing token is 403", () => {
    const sec = filledSec();
    const res = checkApiRequest(
      apiReq("/api/settings", { method: "POST", token: null, contentType: "application/json" }),
      sec,
    );
    expect(res?.status).toBe(403);
  });

  test("POST wrong origin is 403", () => {
    const sec = filledSec();
    const res = checkApiRequest(
      apiReq("/api/settings", {
        method: "POST",
        origin: "https://evil.example",
        token: sec.token,
        contentType: "application/json",
      }),
      sec,
    );
    expect(res?.status).toBe(403);
  });

  test("valid GET only needs host", () => {
    const sec = filledSec();
    expect(checkApiRequest(apiReq("/api/settings", { token: null, origin: null }), sec)).toBeNull();
  });

  // GET/HEAD can't demand the token (an <img src> cannot send a header), so a hostile background
  // tab could use image loads as a blind existence oracle. Sec-Fetch-Site is browser-set and
  // unforgeable from a page: cross-site fetches are denied, everything a legitimate user does
  // (same-origin app fetches, address-bar loads, curl - which omit or send other values) passes.
  test("cross-site GET is refused: the img-tag existence oracle closes", () => {
    const sec = filledSec();
    const res = checkApiRequest(
      apiReq("/api/studio/portrait", { token: null, origin: null, fetchSite: "cross-site" }),
      sec,
    );
    expect(res?.status).toBe(403);
  });

  test("same-origin and none Sec-Fetch-Site GETs still pass", () => {
    const sec = filledSec();
    for (const fetchSite of ["same-origin", "none"]) {
      expect(
        checkApiRequest(apiReq("/api/settings", { token: null, origin: null, fetchSite }), sec),
      ).toBeNull();
    }
  });

  test("valid POST passes", () => {
    const sec = filledSec();
    expect(
      checkApiRequest(
        apiReq("/api/settings", {
          method: "POST",
          token: sec.token,
          contentType: "application/json",
        }),
        sec,
      ),
    ).toBeNull();
  });

  // Loopback spellings are interchangeable: the gate exists for DNS-rebinding from attacker
  // hostnames, not to 403 a user's localhost bookmark.
  test("localhost host spelling passes GET", () => {
    const sec = filledSec();
    expect(
      checkApiRequest(apiReq("/api/settings", { host: "localhost:8321", token: null, origin: null }), sec),
    ).toBeNull();
  });

  test("[::1] host spelling passes GET", () => {
    const sec = filledSec();
    expect(
      checkApiRequest(apiReq("/api/settings", { host: "[::1]:8321", token: null, origin: null }), sec),
    ).toBeNull();
  });

  test("localhost on the WRONG port is still 403", () => {
    const sec = filledSec();
    const res = checkApiRequest(apiReq("/api/settings", { host: "localhost:9999" }), sec);
    expect(res?.status).toBe(403);
  });

  test("POST with localhost origin + valid token passes", () => {
    const sec = filledSec();
    expect(
      checkApiRequest(
        apiReq("/api/settings", {
          method: "POST",
          host: "localhost:8321",
          origin: "http://localhost:8321",
          token: sec.token,
          contentType: "application/json",
        }),
        sec,
      ),
    ).toBeNull();
  });

  test("https localhost origin is still 403 (scheme matters)", () => {
    const sec = filledSec();
    const res = checkApiRequest(
      apiReq("/api/settings", {
        method: "POST",
        origin: "https://localhost:8321",
        token: sec.token,
        contentType: "application/json",
      }),
      sec,
    );
    expect(res?.status).toBe(403);
  });
});

describe("readBodyCapped", () => {
  test("rejects oversized content-length", async () => {
    const req = new Request("http://127.0.0.1/x", {
      method: "POST",
      headers: { "content-length": String(INSPECT_BODY_MAX + 1) },
      body: "x",
    });
    const r = await readBodyCapped(req, INSPECT_BODY_MAX);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });

  test("accepts body at limit", async () => {
    const body = new Uint8Array(16);
    const req = new Request("http://127.0.0.1/x", { method: "POST", body });
    const r = await readBodyCapped(req, 16);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bytes.length).toBe(16);
  });
});

describe("/api/version reports the run mode (the update prescription fork)", () => {
  test("no packaged assets = source; packaged assets = packaged", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-srv-"));
    const sec = filledSec();
    const source = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
    const a = (await (await source(apiReq("/api/version"))).json()) as { version: string; mode: string };
    expect(a.mode).toBe("source");
    expect(a.version.length).toBeGreaterThan(0);
    // the version route never reads the bundle contents, only its presence
    const packaged = createHandler(
      new StudioStore(dir),
      new SettingsStore(dir),
      {} as Parameters<typeof createHandler>[2],
      sec,
    );
    const b = (await (await packaged(apiReq("/api/version"))).json()) as { mode: string };
    expect(b.mode).toBe("packaged");
    await rm(dir, { recursive: true, force: true });
  });
});

describe("createHandler security", () => {
  test("settings POST rejects text/plain before save", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-srv-"));
    const sec = filledSec();
    const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
    const res = await handler(
      apiReq("/api/settings", {
        method: "POST",
        token: sec.token,
        contentType: "text/plain",
        body: JSON.stringify({ setupComplete: true }),
      }),
    );
    expect(res.status).toBe(415);
  });

  test("settings POST null body is 400", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-srv-"));
    const sec = filledSec();
    const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
    const res = await handler(
      apiReq("/api/settings", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: "null",
      }),
    );
    expect(res.status).toBe(400);
  });

  test("index HTML includes session meta and no-store", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-srv-"));
    const sec = filledSec();
    const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
    const res = await handler(new Request("http://127.0.0.1:8321/"));
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain('name="vaude-session"');
    expect(html).toContain('name="vaude-dev"');
    expect(html).toContain(sec.token);
    const csp = res.headers.get("content-security-policy") ?? "";
    // The hash is COMPUTED from the served html, never pinned by hand: a hand pin rotted the moment
    // the import map changed, and a rotted hash took the whole app down (React resolves through it).
    const hashes = inlineScriptHashes(html);
    expect(hashes).toContain("sha256-");
    expect(csp).toContain(`script-src 'self' ${hashes};`);
    expect(csp).not.toContain("unsafe-inline'; style-src");
  });

  test("valid settings read works", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-srv-"));
    const sec = filledSec();
    const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
    const res = await handler(apiReq("/api/settings"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { setupComplete?: boolean };
    expect(typeof body.setupComplete).toBe("boolean");
  });

  test("settings PATCH composes independent concurrent changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-srv-"));
    const sec = filledSec();
    const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
    const patch = (body: object): Promise<Response> => handler(
      apiReq("/api/settings", {
        method: "PATCH",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify(body),
      }),
    );
    const [theme, deck] = await Promise.all([
      patch({ theme: "stage" }),
      patch({ firstDeck: "lorebook" }),
    ]);
    expect(theme.status).toBe(200);
    expect(deck.status).toBe(200);
    const saved = await new SettingsStore(dir).read();
    expect(saved.theme).toBe("stage");
    expect(saved.firstDeck).toBe("lorebook");
  });
});


