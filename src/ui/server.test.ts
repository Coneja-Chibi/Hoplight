/**
 * Loopback API boundary: Host / Origin / token, body caps, session HTML injection.
 */
import { describe, expect, test, beforeAll } from "bun:test";
import { mkdtemp } from "node:fs/promises";
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
  readBodyCapped,
  INSPECT_BODY_MAX,
} from "./server";

const filledSec = () => {
  const sec = createSecurityContext();
  sec.expectedHost = "127.0.0.1:8321";
  sec.expectedOrigin = "http://127.0.0.1:8321";
  return sec;
};

const apiReq = (
  path: string,
  init: {
    method?: string;
    host?: string;
    origin?: string | null;
    token?: string | null;
    contentType?: string;
    body?: BodyInit | null;
  } = {},
): Request => {
  const headers = new Headers();
  headers.set("host", init.host ?? "127.0.0.1:8321");
  if (init.origin !== null) headers.set("origin", init.origin ?? "http://127.0.0.1:8321");
  if (init.token !== null && init.token !== undefined) headers.set("x-vaude-token", init.token);
  if (init.contentType) headers.set("content-type", init.contentType);
  return new Request(`http://127.0.0.1:8321${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body,
  });
};

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
  // hostnames, not to 403 the owner's localhost bookmark (bit Chi live, 2026-07-11).
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
    expect(html).toContain(sec.token);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sha256-oS0890KthXKlLAElsrB9TPYaFk7T+qY9JZeMwO31GOw=");
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
});


describe("bundle inspect/export/save", () => {
  beforeAll(async () => {
    await loadFormats();
  });

  const cardWithBook = {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Aria",
      description: "nav",
      character_book: {
        name: "Aetheria Lore",
        entries: [
          {
            id: 0,
            keys: ["skyport"],
            content: "Floating docks.",
            enabled: true,
            insertion_order: 10,
            extensions: {},
          },
        ],
      },
    },
  };

  test("inspect returns related lorebook and matching knowledgeRefs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-insp-"));
    const sec = filledSec();
    const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
    const bytes = new TextEncoder().encode(JSON.stringify(cardWithBook));
    const res = await handler(
      apiReq("/api/inspect", {
        method: "POST",
        token: sec.token,
        contentType: "application/octet-stream",
        body: bytes,
      }),
    );
    // x-filename header
    const headers = new Headers();
    headers.set("host", "127.0.0.1:8321");
    headers.set("origin", "http://127.0.0.1:8321");
    headers.set("x-vaude-token", sec.token);
    headers.set("content-type", "application/octet-stream");
    headers.set("x-filename", "aria.json");
    const res2 = await handler(
      new Request("http://127.0.0.1:8321/api/inspect", {
        method: "POST",
        headers,
        body: bytes,
      }),
    );
    expect(res2.status).toBe(200);
    const body = await res2.json() as {
      ok: boolean;
      entity: { body: { knowledgeRefs?: string[] } };
      related?: { lorebooks?: { id: string; kind: string }[] };
      receipt?: { extras: string[] };
    };
    expect(body.ok).toBe(true);
    expect(body.related?.lorebooks?.length).toBe(1);
    const bookId = body.related!.lorebooks![0]!.id;
    expect(body.entity.body.knowledgeRefs).toEqual([bookId]);
    expect(body.receipt?.extras.some((x) => x.includes("lorebook"))).toBe(true);
  });

  test("save-bundle then export re-embeds book; missing ref fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-exp-"));
    const sec = filledSec();
    const store = new StudioStore(dir);
    const handler = createHandler(store, new SettingsStore(dir), undefined, sec);

    const bytes = new TextEncoder().encode(JSON.stringify(cardWithBook));
    const headers = new Headers();
    headers.set("host", "127.0.0.1:8321");
    headers.set("origin", "http://127.0.0.1:8321");
    headers.set("x-vaude-token", sec.token);
    headers.set("content-type", "application/octet-stream");
    headers.set("x-filename", "aria.json");
    const inspected = await (
      await handler(new Request("http://127.0.0.1:8321/api/inspect", { method: "POST", headers, body: bytes }))
    ).json() as {
      entity: unknown;
      related?: { lorebooks?: unknown[] };
    };

    const saveRes = await handler(
      apiReq("/api/studio/save-bundle", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify({
          entity: inspected.entity,
          related: inspected.related,
        }),
      }),
    );
    expect(saveRes.status).toBe(200);
    const saved = await saveRes.json() as {
      ok: boolean;
      primary: { id: string; kind: string };
      related: { id: string; kind: string }[];
      knowledgeRefs: string[];
    };
    expect(saved.ok).toBe(true);
    expect(saved.related[0]?.kind).toBe("lorebook");
    expect(saved.knowledgeRefs).toEqual([saved.related[0]!.id]);

    const entity = await store.read(saved.primary.kind, saved.primary.id);
    expect(entity).not.toBeNull();

    const expRes = await handler(
      apiReq("/api/export", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify({ entity, targetId: "rolecall" }),
      }),
    );
    expect(expRes.status).toBe(200);
    const exp = await expRes.json() as { text?: string };
    const wire = JSON.parse(exp.text!);
    expect(wire.data.character_book).toBeDefined();
    expect(wire.data.character_book.entries[0].keys).toEqual(["skyport"]);

    // missing ref fails closed
    const broken = structuredClone(entity!);
    (broken.body as { knowledgeRefs: string[] }).knowledgeRefs = ["does-not-exist"];
    const miss = await handler(
      apiReq("/api/export", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify({ entity: broken, targetId: "sillytavern" }),
      }),
    );
    expect(miss.status).toBe(422);
    const missBody = await miss.json() as { error: string };
    expect(missBody.error).toContain("does-not-exist");
  });
});
